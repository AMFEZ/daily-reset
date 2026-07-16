"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

export type ReminderKey =
  | "morning"
  | "daily"
  | "night"
  | "sleep_boundary";

export type ReminderSetting = {
  id: string;
  reminder_key: ReminderKey;
  label: string;
  time_local: string;
  enabled: boolean;
  timezone: string;
  sort_order: number;
  updated_at: string;
};

type ReminderSettingsPanelProps = {
  initialReminders: ReminderSetting[];
};

type PermissionState =
  | NotificationPermission
  | "unsupported";

type SavedReminderRow = {
  id: string;
  reminder_key: ReminderKey;
  label: string;
  time_local: string;
  enabled: boolean;
  timezone: string;
  sort_order: number;
  updated_at: string;
};

const DEFAULT_TIMES: Record<ReminderKey, string> = {
  morning: "08:30",
  daily: "14:00",
  night: "21:30",
  sleep_boundary: "23:00",
};

const REMINDER_DESCRIPTIONS: Record<
  ReminderKey,
  string
> = {
  morning:
    "Start the Morning Reset before the day takes control.",
  daily:
    "Check the Daily Protocols and protect the middle of the day.",
  night:
    "Begin the Shutdown Protocol and close open loops.",
  sleep_boundary:
    "Protect the sleep boundary and move the phone away from bed.",
};

export function ReminderSettingsPanel({
  initialReminders,
}: ReminderSettingsPanelProps) {
  const [reminders, setReminders] =
    useState<ReminderSetting[]>(
      normalizeReminders(initialReminders)
    );
  const [permission, setPermission] =
    useState<PermissionState>("unsupported");
  const [statusMessage, setStatusMessage] =
    useState<string | null>(null);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);
  const [isSaving, startSaving] =
    useTransition();
  const [isTesting, startTesting] =
    useTransition();

  const deviceTimezone = useMemo(
    () =>
      Intl.DateTimeFormat().resolvedOptions()
        .timeZone || "America/New_York",
    []
  );

  const enabledCount = reminders.filter(
    (reminder) => reminder.enabled
  ).length;

  const nextReminder = useMemo(
    () =>
      findNextReminder(
        reminders,
        new Date(),
        deviceTimezone
      ),
    [reminders, deviceTimezone]
  );

  useEffect(() => {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }

    setPermission(Notification.permission);
  }, []);

  function updateReminder(
    reminderKey: ReminderKey,
    patch: Partial<ReminderSetting>
  ) {
    setStatusMessage(null);
    setErrorMessage(null);

    setReminders((current) =>
      current.map((reminder) =>
        reminder.reminder_key === reminderKey
          ? { ...reminder, ...patch }
          : reminder
      )
    );
  }

  function restoreDefaults() {
    setStatusMessage(null);
    setErrorMessage(null);

    setReminders((current) =>
      current.map((reminder) => ({
        ...reminder,
        time_local:
          DEFAULT_TIMES[reminder.reminder_key],
        enabled: true,
      }))
    );
  }

  function requestNotificationPermission() {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      setErrorMessage(
        "This browser does not support system notifications."
      );
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);

    void Notification.requestPermission().then(
      (result) => {
        setPermission(result);

        if (result === "granted") {
          setStatusMessage(
            "Notification permission enabled on this device."
          );
        } else if (result === "denied") {
          setErrorMessage(
            "Notifications are blocked in this browser's site settings."
          );
        }
      }
    );
  }

  function saveSettings() {
    setErrorMessage(null);
    setStatusMessage(null);

    startSaving(async () => {
      const payload = reminders.map(
        (reminder) => ({
          reminder_key:
            reminder.reminder_key,
          time_local: normalizeTime(
            reminder.time_local
          ),
          enabled: reminder.enabled,
        })
      );

      try {
        const response = await fetch(
          "/api/reminders",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            credentials: "same-origin",
            cache: "no-store",
            body: JSON.stringify({
              reminders: payload,
              timezone: deviceTimezone,
            }),
          }
        );

        const responsePayload =
          (await response
            .json()
            .catch(() => null)) as
            | {
                reminders?: SavedReminderRow[];
                error?: string;
              }
            | null;

        if (!response.ok) {
          throw new Error(
            responsePayload?.error ??
              "Reminder schedule could not be saved."
          );
        }

        const savedRows =
          responsePayload?.reminders ?? [];

        if (savedRows.length === 0) {
          throw new Error(
            "The reminder schedule saved, but no updated rows were returned."
          );
        }

        const normalized =
          normalizeReminders(savedRows);

        setReminders(normalized);
        setStatusMessage(
          "Reminder schedule synced to Supabase."
        );

        window.dispatchEvent(
          new CustomEvent(
            "daily-reset-reminders-updated",
            {
              detail: normalized,
            }
          )
        );
      } catch (error) {
        console.error(
          "Reminder settings save failed:",
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Reminder schedule could not be saved."
        );
      }
    });
  }

  function testNotification() {
    setErrorMessage(null);
    setStatusMessage(null);

    startTesting(async () => {
      if (!("Notification" in window)) {
        setErrorMessage(
          "This browser does not support system notifications."
        );
        return;
      }

      if (Notification.permission !== "granted") {
        setErrorMessage(
          "Enable notification permission before running a test."
        );
        return;
      }

      try {
        await showSystemNotification({
          title: "Daily Reset",
          body: "Reminder system online. Your schedule is connected.",
          tag: "daily-reset-test",
          url: "/#reminder-center",
        });

        setStatusMessage(
          "Test notification sent to this device."
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "The test notification could not be displayed."
        );
      }
    });
  }

  return (
    <section className="border border-[#242424] bg-[#050505]">
      <div className="border-b border-[#242424] bg-[#0d0d0d] px-3 py-2">
        <p className="terminal-green text-xs uppercase tracking-[0.2em]">
          &gt; reminder.settings
        </p>
      </div>

      <div className="p-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric
            label="ACTIVE"
            value={`${enabledCount} / 4`}
            green={enabledCount > 0}
          />

          <Metric
            label="PERMISSION"
            value={formatPermission(permission)}
            green={permission === "granted"}
            warning={permission === "denied"}
          />

          <Metric
            label="NEXT SIGNAL"
            value={
              nextReminder
                ? `${nextReminder.label} / ${formatTime(
                    nextReminder.time_local
                  )}`
                : "DISABLED"
            }
            green={Boolean(nextReminder)}
          />
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {reminders.map((reminder) => (
            <ReminderCard
              key={reminder.reminder_key}
              reminder={reminder}
              onUpdate={(patch) =>
                updateReminder(
                  reminder.reminder_key,
                  patch
                )
              }
            />
          ))}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <button
            type="button"
            onClick={requestNotificationPermission}
            disabled={permission === "granted"}
            className="min-h-[48px] border border-[#39ff88] bg-[#080808] px-3 py-3 text-left text-xs text-[#39ff88] transition hover:bg-[#0d0d0d] disabled:cursor-not-allowed disabled:border-[#242424] disabled:text-[#6a6a6a]"
          >
            &gt;{" "}
            {permission === "granted"
              ? "permission_enabled"
              : "enable_notifications"}
          </button>

          <button
            type="button"
            onClick={testNotification}
            disabled={
              isTesting ||
              permission !== "granted"
            }
            className="min-h-[48px] border border-[#242424] bg-[#080808] px-3 py-3 text-left text-xs text-[#e5e5e5] transition hover:border-[#39ff88] hover:text-[#39ff88] disabled:cursor-not-allowed disabled:opacity-50"
          >
            &gt;{" "}
            {isTesting
              ? "testing..."
              : "test_notification"}
          </button>

          <button
            type="button"
            onClick={restoreDefaults}
            disabled={isSaving}
            className="min-h-[48px] border border-[#242424] bg-[#080808] px-3 py-3 text-left text-xs text-[#e5e5e5] transition hover:border-[#ffb020] hover:text-[#ffb020] disabled:cursor-not-allowed disabled:opacity-50"
          >
            &gt; restore_default_times
          </button>

          <button
            type="button"
            onClick={saveSettings}
            disabled={isSaving}
            className="min-h-[48px] border border-[#39ff88] bg-[#080808] px-3 py-3 text-left text-xs text-[#39ff88] transition hover:bg-[#0d0d0d] disabled:cursor-not-allowed disabled:opacity-50"
          >
            &gt;{" "}
            {isSaving
              ? "syncing..."
              : "save_schedule"}
          </button>
        </div>

        {statusMessage ? (
          <p className="terminal-green mt-4 text-xs leading-6">
            &gt; {statusMessage}
          </p>
        ) : null}

        {errorMessage ? (
          <p className="mt-4 text-xs leading-6 text-[#ff6b6b]">
            &gt; {errorMessage}
          </p>
        ) : null}

        <div className="terminal-muted mt-4 border-t border-[#242424] pt-3 text-xs leading-6">
          <p>
            &gt; Schedule timezone:{" "}
            <span className="text-[#e5e5e5]">
              {deviceTimezone}
            </span>
          </p>

          <p>
            &gt; Settings sync across devices. Each device
            must grant its own notification permission.
          </p>
        </div>
      </div>
    </section>
  );
}

function ReminderCard({
  reminder,
  onUpdate,
}: {
  reminder: ReminderSetting;
  onUpdate: (
    patch: Partial<ReminderSetting>
  ) => void;
}) {
  return (
    <article
      className={[
        "border p-3 transition",
        reminder.enabled
          ? "border-[#39ff88] bg-[#08100b]"
          : "border-[#242424] bg-[#080808]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className={
              reminder.enabled
                ? "terminal-green text-sm"
                : "text-sm text-[#e5e5e5]"
            }
          >
            {reminder.label}
          </p>

          <p className="terminal-muted mt-2 text-xs leading-5">
            {
              REMINDER_DESCRIPTIONS[
                reminder.reminder_key
              ]
            }
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={reminder.enabled}
          onClick={() =>
            onUpdate({
              enabled: !reminder.enabled,
            })
          }
          className={[
            "min-h-[44px] min-w-[78px] border px-3 text-xs uppercase tracking-[0.12em]",
            reminder.enabled
              ? "border-[#39ff88] text-[#39ff88]"
              : "border-[#242424] text-[#7a7a7a]",
          ].join(" ")}
        >
          {reminder.enabled ? "ON" : "OFF"}
        </button>
      </div>

      <label className="mt-4 block">
        <span className="terminal-muted text-[10px] uppercase tracking-[0.16em]">
          Local reminder time
        </span>

        <input
          type="time"
          value={normalizeTime(
            reminder.time_local
          )}
          onChange={(event) =>
            onUpdate({
              time_local: event.target.value,
            })
          }
          disabled={!reminder.enabled}
          className="mt-2 min-h-[48px] w-full border border-[#242424] bg-[#050505] px-3 text-base text-[#e5e5e5] outline-none transition focus:border-[#39ff88] disabled:cursor-not-allowed disabled:opacity-45"
        />
      </label>
    </article>
  );
}

function Metric({
  label,
  value,
  green = false,
  warning = false,
}: {
  label: string;
  value: string;
  green?: boolean;
  warning?: boolean;
}) {
  const valueClassName = green
    ? "terminal-green"
    : warning
      ? "text-[#ffb020]"
      : "text-[#e5e5e5]";

  return (
    <div className="border border-[#242424] bg-[#080808] p-3">
      <p className="terminal-muted text-[10px] uppercase tracking-[0.18em]">
        {label}
      </p>

      <p className={`mt-2 text-sm ${valueClassName}`}>
        {value}
      </p>
    </div>
  );
}

function normalizeReminders(
  reminders: ReminderSetting[]
) {
  return [...reminders]
    .map((reminder) => ({
      ...reminder,
      time_local: normalizeTime(
        reminder.time_local
      ),
    }))
    .sort((a, b) => a.sort_order - b.sort_order);
}

function normalizeTime(value: string) {
  const [hours = "00", minutes = "00"] =
    value.split(":");

  return `${hours.padStart(
    2,
    "0"
  )}:${minutes.padStart(2, "0")}`;
}

function formatTime(value: string) {
  const [hours, minutes] = normalizeTime(
    value
  )
    .split(":")
    .map(Number);

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatPermission(
  permission: PermissionState
) {
  if (permission === "granted") {
    return "ENABLED";
  }

  if (permission === "denied") {
    return "BLOCKED";
  }

  if (permission === "default") {
    return "NOT REQUESTED";
  }

  return "UNSUPPORTED";
}

function findNextReminder(
  reminders: ReminderSetting[],
  now: Date,
  timeZone: string
) {
  const clock = getClockParts(now, timeZone);
  const nowMinutes =
    clock.hour * 60 + clock.minute;

  const enabled = reminders.filter(
    (reminder) => reminder.enabled
  );

  const today = enabled
    .map((reminder) => ({
      reminder,
      minute: timeToMinutes(
        reminder.time_local
      ),
    }))
    .filter((item) => item.minute >= nowMinutes)
    .sort((a, b) => a.minute - b.minute);

  if (today.length > 0) {
    return today[0].reminder;
  }

  return [...enabled].sort(
    (a, b) =>
      timeToMinutes(a.time_local) -
      timeToMinutes(b.time_local)
  )[0] ?? null;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = normalizeTime(
    value
  )
    .split(":")
    .map(Number);

  return hours * 60 + minutes;
}

function getClockParts(
  date: Date,
  timeZone: string
) {
  const parts = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone,
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
    hour: Number(values.hour ?? 0),
    minute: Number(values.minute ?? 0),
  };
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
