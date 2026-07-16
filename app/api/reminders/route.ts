import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

type ReminderKey =
  | "morning"
  | "daily"
  | "night"
  | "sleep_boundary";

type ReminderInput = {
  reminder_key: ReminderKey;
  time_local: string;
  enabled: boolean;
};

const REMINDER_CONFIG: Record<
  ReminderKey,
  {
    label: string;
    sortOrder: number;
  }
> = {
  morning: {
    label: "Morning Reset",
    sortOrder: 10,
  },
  daily: {
    label: "Daily Protocols",
    sortOrder: 20,
  },
  night: {
    label: "Shutdown Protocol",
    sortOrder: 30,
  },
  sleep_boundary: {
    label: "Sleep Boundary",
    sortOrder: 40,
  },
};

export async function POST(
  request: Request
) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return Response.json(
      {
        error: "Authentication required.",
      },
      {
        status: 401,
        headers: noStoreHeaders(),
      }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        error:
          "The reminder request was not valid JSON.",
      },
      {
        status: 400,
        headers: noStoreHeaders(),
      }
    );
  }

  const parsed = parseRequest(body);

  if (!parsed.ok) {
    return Response.json(
      {
        error: parsed.error,
      },
      {
        status: 400,
        headers: noStoreHeaders(),
      }
    );
  }

  const rows = parsed.reminders.map(
    (reminder) => {
      const config =
        REMINDER_CONFIG[
          reminder.reminder_key
        ];

      return {
        user_id: user.id,
        reminder_key:
          reminder.reminder_key,
        label: config.label,
        time_local:
          `${reminder.time_local}:00`,
        enabled: reminder.enabled,
        timezone: parsed.timezone,
        sort_order: config.sortOrder,
      };
    }
  );

  const {
    data: savedRows,
    error: saveError,
  } = await supabase
    .from("daily_reset_reminders")
    .upsert(rows, {
      onConflict: "user_id,reminder_key",
    })
    .select(
      "id, reminder_key, label, time_local, enabled, timezone, sort_order, updated_at"
    )
    .order("sort_order", {
      ascending: true,
    });

  if (saveError) {
    console.error(
      "Reminder API save failed:",
      saveError.message
    );

    return Response.json(
      {
        error: saveError.message,
      },
      {
        status: 500,
        headers: noStoreHeaders(),
      }
    );
  }

  return Response.json(
    {
      reminders: (savedRows ?? []).map(
        (reminder) => ({
          ...reminder,
          time_local: String(
            reminder.time_local ??
              "00:00"
          ).slice(0, 5),
        })
      ),
    },
    {
      status: 200,
      headers: noStoreHeaders(),
    }
  );
}

function parseRequest(
  body: unknown
):
  | {
      ok: true;
      timezone: string;
      reminders: ReminderInput[];
    }
  | {
      ok: false;
      error: string;
    } {
  if (
    !body ||
    typeof body !== "object"
  ) {
    return {
      ok: false,
      error:
        "Reminder settings are required.",
    };
  }

  const candidate =
    body as Record<string, unknown>;

  const timezone =
    typeof candidate.timezone ===
    "string"
      ? candidate.timezone.trim()
      : "";

  if (!isValidTimeZone(timezone)) {
    return {
      ok: false,
      error:
        "A valid timezone is required.",
    };
  }

  if (
    !Array.isArray(
      candidate.reminders
    )
  ) {
    return {
      ok: false,
      error:
        "Reminder settings must be an array.",
    };
  }

  const reminders: ReminderInput[] = [];

  for (
    const item of candidate.reminders
  ) {
    if (
      !item ||
      typeof item !== "object"
    ) {
      return {
        ok: false,
        error:
          "A reminder entry is invalid.",
      };
    }

    const reminder =
      item as Record<string, unknown>;
    const key =
      reminder.reminder_key;
    const time =
      reminder.time_local;
    const enabled =
      reminder.enabled;

    if (
      typeof key !== "string" ||
      !(key in REMINDER_CONFIG)
    ) {
      return {
        ok: false,
        error:
          "A reminder key is invalid.",
      };
    }

    if (
      typeof time !== "string" ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(
        time
      )
    ) {
      return {
        ok: false,
        error:
          `The time for ${key} is invalid.`,
      };
    }

    if (typeof enabled !== "boolean") {
      return {
        ok: false,
        error:
          `The enabled state for ${key} is invalid.`,
      };
    }

    reminders.push({
      reminder_key:
        key as ReminderKey,
      time_local: time,
      enabled,
    });
  }

  if (reminders.length === 0) {
    return {
      ok: false,
      error:
        "At least one reminder is required.",
    };
  }

  return {
    ok: true,
    timezone,
    reminders,
  };
}

function isValidTimeZone(
  value: string
) {
  try {
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: value,
      }
    ).format();

    return true;
  } catch {
    return false;
  }
}

function noStoreHeaders() {
  return {
    "Cache-Control":
      "private, no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "X-Content-Type-Options":
      "nosniff",
  };
}
