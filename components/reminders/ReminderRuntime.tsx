"use client";

import type {
  ReminderKey,
  ReminderSetting,
} from "@/components/reminders/ReminderSettingsPanel";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type ReminderUpdateEvent = CustomEvent<
  ReminderSetting[]
>;

type TimezoneUpdateEvent =
  CustomEvent<string>;

type ActiveReminder = {
  key: ReminderKey;
  label: string;
  body: string;
  url: string;
};

const CHECK_INTERVAL_MILLISECONDS = 30_000;
const REMINDER_GRACE_MINUTES = 180;
const STORAGE_PREFIX =
  "daily-reset-reminder-delivered";

const REMINDER_CONTENT: Record<
  ReminderKey,
  {
    body: string;
    url: string;
  }
> = {
  morning: {
    body: "Morning Reset is ready. Run the first signal.",
    url: "/#morning",
  },
  daily: {
    body: "Check the Daily Protocols and protect the middle of the day.",
    url: "/#daily",
  },
  night: {
    body: "Begin the Shutdown Protocol and close the day intentionally.",
    url: "/#night",
  },
  sleep_boundary: {
    body: "Protect the sleep boundary. Move the phone away from bed.",
    url: "/#trust_based",
  },
};

export function ReminderRuntime({
  initialReminders,
}: {
  initialReminders: ReminderSetting[];
}) {
  const [reminders, setReminders] =
    useState<ReminderSetting[]>(
      initialReminders
    );
  const [activeReminder, setActiveReminder] =
    useState<ActiveReminder | null>(null);

  const remindersRef =
    useRef<ReminderSetting[]>(
      initialReminders
    );

  useEffect(() => {
    remindersRef.current = reminders;
  }, [reminders]);

  const checkReminders = useCallback(
    async () => {
      if (document.visibilityState === "hidden") {
        return;
      }

      const now = new Date();

      for (const reminder of remindersRef.current) {
        if (!reminder.enabled) {
          continue;
        }

        const dueState = getReminderDueState(
          reminder,
          now
        );

        if (!dueState.isDue) {
          continue;
        }

        const deliveryKey = [
          STORAGE_PREFIX,
          reminder.reminder_key,
          dueState.dateKey,
        ].join(":");

        if (
          window.localStorage.getItem(deliveryKey) ===
          "true"
        ) {
          continue;
        }

        window.localStorage.setItem(
          deliveryKey,
          "true"
        );

        const content =
          REMINDER_CONTENT[
            reminder.reminder_key
          ];

        const active = {
          key: reminder.reminder_key,
          label: reminder.label,
          body: content.body,
          url: content.url,
        };

        setActiveReminder(active);

        if (
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          try {
            await showSystemNotification({
              title: `Daily Reset — ${reminder.label}`,
              body: content.body,
              tag: `daily-reset-${reminder.reminder_key}`,
              url: content.url,
            });
          } catch (error) {
            console.error(
              "Reminder notification failed:",
              error
            );
          }
        }
      }

      cleanOldDeliveryKeys(now);
    },
    []
  );

  useEffect(() => {
    function handleReminderUpdate(
      event: Event
    ) {
      const customEvent =
        event as ReminderUpdateEvent;

      setReminders(customEvent.detail);
    }

    function handleTimezoneUpdate(
      event: Event
    ) {
      const customEvent =
        event as TimezoneUpdateEvent;

      setReminders((current) =>
        current.map((reminder) => ({
          ...reminder,
          timezone: customEvent.detail,
        }))
      );
    }

    function handleVisibilityChange() {
      if (
        document.visibilityState === "visible"
      ) {
        void checkReminders();
      }
    }

    window.addEventListener(
      "daily-reset-reminders-updated",
      handleReminderUpdate
    );
    window.addEventListener(
      "daily-reset-timezone-updated",
      handleTimezoneUpdate
    );
    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    void checkReminders();

    const intervalId = window.setInterval(
      () => {
        void checkReminders();
      },
      CHECK_INTERVAL_MILLISECONDS
    );

    return () => {
      window.removeEventListener(
        "daily-reset-reminders-updated",
        handleReminderUpdate
      );
      window.removeEventListener(
        "daily-reset-timezone-updated",
        handleTimezoneUpdate
      );
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
      window.clearInterval(intervalId);
    };
  }, [checkReminders]);

  if (!activeReminder) {
    return null;
  }

  return (
    <aside
      className="fixed inset-x-3 bottom-3 z-[60] border border-[#39ff88] bg-[#050505] p-3 shadow-2xl sm:left-auto sm:right-4 sm:w-[390px]"
      style={{
        paddingBottom:
          "max(0.75rem, env(safe-area-inset-bottom))",
      }}
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="terminal-green text-xs uppercase tracking-[0.18em]">
            &gt; reminder.signal
          </p>

          <p className="mt-2 text-sm text-[#e5e5e5]">
            {activeReminder.label}
          </p>

          <p className="terminal-muted mt-2 text-xs leading-5">
            {activeReminder.body}
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setActiveReminder(null)
          }
          className="min-h-[44px] min-w-[44px] border border-[#242424] text-[#8a8a8a]"
          aria-label="Dismiss reminder"
        >
          ×
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          window.location.href =
            activeReminder.url;
          setActiveReminder(null);
        }}
        className="mt-3 min-h-[48px] w-full border border-[#39ff88] bg-[#080808] px-4 py-3 text-left text-sm text-[#39ff88]"
      >
        &gt; open_protocol
      </button>
    </aside>
  );
}

function getReminderDueState(
  reminder: ReminderSetting,
  now: Date
) {
  const parts = getDateTimeParts(
    now,
    reminder.timezone
  );

  const nowMinutes =
    parts.hour * 60 + parts.minute;
  const scheduledMinutes = timeToMinutes(
    reminder.time_local
  );
  const minutesLate =
    nowMinutes - scheduledMinutes;

  return {
    dateKey: parts.dateKey,
    isDue:
      minutesLate >= 0 &&
      minutesLate <= REMINDER_GRACE_MINUTES,
  };
}

function getDateTimeParts(
  date: Date,
  timeZone: string
) {
  const parts = new Intl.DateTimeFormat(
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

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    dateKey: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour ?? 0),
    minute: Number(values.minute ?? 0),
  };
}

function timeToMinutes(value: string) {
  const [hours = "0", minutes = "0"] =
    value.split(":");

  return Number(hours) * 60 + Number(minutes);
}

async function showSystemNotification({
  title,
  body,
  tag,
  url,
}: {
  title: string;
  body: string;
  tag: string;
  url: string;
}) {
  const options: NotificationOptions = {
    body,
    tag,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url },
  };

  if ("serviceWorker" in navigator) {
    const registration =
      await navigator.serviceWorker.getRegistration();

    if (registration) {
      await registration.showNotification(
        title,
        options
      );
      return;
    }
  }

  new Notification(title, options);
}

function cleanOldDeliveryKeys(now: Date) {
  const cutoff = new Date(
    now.getTime() - 8 * 24 * 60 * 60 * 1000
  );

  for (
    let index = 0;
    index < window.localStorage.length;
    index += 1
  ) {
    const key =
      window.localStorage.key(index);

    if (
      !key ||
      !key.startsWith(STORAGE_PREFIX)
    ) {
      continue;
    }

    const dateKey = key.slice(-10);
    const deliveryDate = new Date(
      `${dateKey}T00:00:00`
    );

    if (
      Number.isFinite(deliveryDate.getTime()) &&
      deliveryDate < cutoff
    ) {
      window.localStorage.removeItem(key);
    }
  }
}
