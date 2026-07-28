import type {
  SupabaseClient,
} from "@supabase/supabase-js";
import {
  createAdminClient,
} from "@/utils/supabase/admin";
import {
  getPushErrorMessage,
  isExpiredPushSubscription,
  sendPushNotification,
} from "@/lib/pushNotifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ReminderKey =
  | "morning"
  | "daily"
  | "night"
  | "sleep_boundary";

type ReminderRow = {
  user_id: string;
  reminder_key: ReminderKey;
  label: string;
  time_local: string;
  timezone: string;
};

type SubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth_secret: string;
};

const GRACE_MINUTES = 15;

const REMINDER_CONTENT: Record<
  ReminderKey,
  {
    body: string;
    url: string;
  }
> = {
  morning: {
    body:
      "Morning Reset is ready. Run the first signal.",
    url: "/#morning",
  },
  daily: {
    body:
      "Check the Daily Protocols and protect the middle of the day.",
    url: "/#daily",
  },
  night: {
    body:
      "Begin the Shutdown Protocol and close the day intentionally.",
    url: "/#night",
  },
  sleep_boundary: {
    body:
      "Protect the sleep boundary. Move the phone away from bed.",
    url: "/#trust_based",
  },
};

export async function GET(
  request: Request
) {
  return dispatchPushReminders(
    request
  );
}

export async function POST(
  request: Request
) {
  return dispatchPushReminders(
    request
  );
}

async function dispatchPushReminders(
  request: Request
) {
  const expectedSecret =
    process.env.CRON_SECRET;
  const authorization =
    request.headers.get(
      "authorization"
    );

  if (
    !expectedSecret ||
    authorization !==
      `Bearer ${expectedSecret}`
  ) {
    return Response.json(
      {
        error: "Unauthorized.",
      },
      {
        status: 401,
        headers: noStoreHeaders(),
      }
    );
  }

  const admin =
    createAdminClient() as SupabaseClient;

  const [
    reminderResult,
    subscriptionResult,
  ] = await Promise.all([
    admin
      .from("daily_reset_reminders")
      .select(
        "user_id, reminder_key, label, time_local, timezone"
      )
      .eq("enabled", true),
    admin
      .from(
        "daily_reset_push_subscriptions"
      )
      .select(
        "id, user_id, endpoint, p256dh, auth_secret"
      )
      .eq("enabled", true),
  ]);

  if (reminderResult.error) {
    return Response.json(
      {
        error:
          reminderResult.error.message,
      },
      {
        status: 500,
        headers: noStoreHeaders(),
      }
    );
  }

  if (subscriptionResult.error) {
    return Response.json(
      {
        error:
          subscriptionResult.error.message,
      },
      {
        status: 500,
        headers: noStoreHeaders(),
      }
    );
  }

  const reminders =
    (reminderResult.data ??
      []) as ReminderRow[];
  const subscriptions =
    (subscriptionResult.data ??
      []) as SubscriptionRow[];

  const subscriptionsByUser =
    new Map<
      string,
      SubscriptionRow[]
    >();

  for (
    const subscription of
    subscriptions
  ) {
    const current =
      subscriptionsByUser.get(
        subscription.user_id
      ) ?? [];

    current.push(subscription);
    subscriptionsByUser.set(
      subscription.user_id,
      current
    );
  }

  const now = new Date();
  let due = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const reminder of reminders) {
    const localDate =
      getDueLocalDate(
        reminder,
        now
      );

    if (!localDate) {
      continue;
    }

    const userSubscriptions =
      subscriptionsByUser.get(
        reminder.user_id
      ) ?? [];

    for (
      const subscription of
      userSubscriptions
    ) {
      due += 1;

      const {
        error: claimError,
      } = await admin
        .from(
          "daily_reset_push_deliveries"
        )
        .insert({
          subscription_id:
            subscription.id,
          user_id:
            reminder.user_id,
          reminder_key:
            reminder.reminder_key,
          local_date: localDate,
          status: "processing",
          attempt_count: 1,
        });

      if (claimError) {
        if (
          claimError.code === "23505"
        ) {
          skipped += 1;
          continue;
        }

        failed += 1;
        console.error(
          "Push delivery claim failed:",
          claimError.message
        );
        continue;
      }

      const content =
        REMINDER_CONTENT[
          reminder.reminder_key
        ];

      try {
        await sendPushNotification(
          subscription,
          {
            title:
              `Daily Reset — ${reminder.label}`,
            body: content.body,
            tag: [
              "daily-reset",
              reminder.reminder_key,
              localDate,
            ].join("-"),
            url: content.url,
            timestamp: now.getTime(),
          }
        );

        sent += 1;

        await admin
          .from(
            "daily_reset_push_deliveries"
          )
          .update({
            status: "sent",
            delivered_at:
              new Date().toISOString(),
            error_message: null,
          })
          .eq(
            "subscription_id",
            subscription.id
          )
          .eq(
            "reminder_key",
            reminder.reminder_key
          )
          .eq(
            "local_date",
            localDate
          );
      } catch (sendError) {
        failed += 1;

        const message =
          getPushErrorMessage(
            sendError
          );

        console.error(
          "Push delivery failed:",
          message
        );

        if (
          isExpiredPushSubscription(
            sendError
          )
        ) {
          await Promise.all([
            admin
              .from(
                "daily_reset_push_subscriptions"
              )
              .update({
                enabled: false,
              })
              .eq(
                "id",
                subscription.id
              ),
            admin
              .from(
                "daily_reset_push_deliveries"
              )
              .update({
                status: "failed",
                error_message:
                  "Subscription expired.",
              })
              .eq(
                "subscription_id",
                subscription.id
              )
              .eq(
                "reminder_key",
                reminder.reminder_key
              )
              .eq(
                "local_date",
                localDate
              ),
          ]);
        } else {
          // Remove the claim so the next
          // minute can retry a transient
          // delivery failure.
          await admin
            .from(
              "daily_reset_push_deliveries"
            )
            .delete()
            .eq(
              "subscription_id",
              subscription.id
            )
            .eq(
              "reminder_key",
              reminder.reminder_key
            )
            .eq(
              "local_date",
              localDate
            );
        }
      }
    }
  }

  return Response.json(
    {
      checkedReminders:
        reminders.length,
      activeSubscriptions:
        subscriptions.length,
      due,
      sent,
      skipped,
      failed,
      checkedAt:
        now.toISOString(),
    },
    {
      status: 200,
      headers: noStoreHeaders(),
    }
  );
}

function getDueLocalDate(
  reminder: ReminderRow,
  now: Date
) {
  let current;

  try {
    current = getZonedClock(
      now,
      reminder.timezone
    );
  } catch {
    return null;
  }

  const targetMinutes =
    timeToMinutes(
      reminder.time_local
    );
  const currentMinutes =
    current.hour * 60 +
    current.minute;

  let elapsed =
    currentMinutes -
    targetMinutes;
  let localDate =
    current.dateKey;

  if (elapsed < 0) {
    elapsed += 24 * 60;
    localDate =
      getZonedClock(
        new Date(
          now.getTime() -
            24 * 60 * 60 * 1000
        ),
        reminder.timezone
      ).dateKey;
  }

  if (
    elapsed < 0 ||
    elapsed >= GRACE_MINUTES
  ) {
    return null;
  }

  return localDate;
}

function timeToMinutes(
  value: string
) {
  const [
    hours = "0",
    minutes = "0",
  ] = value.split(":");

  return (
    Number(hours) * 60 +
    Number(minutes)
  );
}

function getZonedClock(
  date: Date,
  timeZone: string
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }
    ).formatToParts(date);

  const values =
    Object.fromEntries(
      parts
        .filter(
          (part) =>
            part.type !== "literal"
        )
        .map((part) => [
          part.type,
          part.value,
        ])
    );

  return {
    dateKey: [
      values.year,
      values.month,
      values.day,
    ].join("-"),
    hour: Number(
      values.hour ?? 0
    ),
    minute: Number(
      values.minute ?? 0
    ),
  };
}

function noStoreHeaders() {
  return {
    "Cache-Control":
      "no-store, max-age=0",
  };
}
