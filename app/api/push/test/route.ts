import type {
  SupabaseClient,
} from "@supabase/supabase-js";
import {
  createClient,
} from "@/utils/supabase/server";
import {
  getPushErrorMessage,
  isExpiredPushSubscription,
  sendPushNotification,
} from "@/lib/pushNotifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth_secret: string;
};

export async function POST() {
  const authClient =
    await createClient();

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user) {
    return Response.json(
      {
        error:
          "Authentication required.",
      },
      {
        status: 401,
        headers: noStoreHeaders(),
      }
    );
  }

  const database =
    authClient as unknown as SupabaseClient;

  const {
    data,
    error,
  } = await database
    .from(
      "daily_reset_push_subscriptions"
    )
    .select(
      "id, endpoint, p256dh, auth_secret"
    )
    .eq("user_id", user.id)
    .eq("enabled", true);

  if (error) {
    return Response.json(
      {
        error: error.message,
      },
      {
        status: 500,
        headers: noStoreHeaders(),
      }
    );
  }

  const subscriptions =
    (data ?? []) as SubscriptionRow[];

  if (subscriptions.length === 0) {
    return Response.json(
      {
        error:
          "No active push subscription was found for this account.",
      },
      {
        status: 404,
        headers: noStoreHeaders(),
      }
    );
  }

  let sent = 0;
  const failures: string[] = [];

  for (const subscription of subscriptions) {
    try {
      await sendPushNotification(
        subscription,
        {
          title: "Daily Reset",
          body:
            "Closed-app notifications are online.",
          tag:
            "daily-reset-push-test",
          url: "/#reminder-center",
          timestamp: Date.now(),
        }
      );

      sent += 1;
    } catch (sendError) {
      failures.push(
        getPushErrorMessage(sendError)
      );

      if (
        isExpiredPushSubscription(
          sendError
        )
      ) {
        await database
          .from(
            "daily_reset_push_subscriptions"
          )
          .delete()
          .eq("id", subscription.id)
          .eq("user_id", user.id);
      }
    }
  }

  if (sent === 0) {
    return Response.json(
      {
        error:
          failures[0] ??
          "The test push could not be sent.",
      },
      {
        status: 502,
        headers: noStoreHeaders(),
      }
    );
  }

  return Response.json(
    {
      sent,
      failed: failures.length,
    },
    {
      status: 200,
      headers: noStoreHeaders(),
    }
  );
}

function noStoreHeaders() {
  return {
    "Cache-Control":
      "no-store, max-age=0",
  };
}
