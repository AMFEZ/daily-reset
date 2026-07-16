"use client";

import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import {
  useMemo,
  useState,
  useTransition,
} from "react";

export type WeightUnit = "lbs" | "kg";

export type DisplayDensity =
  | "comfortable"
  | "compact";

export type UserSettings = {
  protein_target: number;
  weight_unit: WeightUnit;
  timezone: string;
  display_density: DisplayDensity;
  reduced_motion: boolean;
  updated_at: string | null;
};

type SettingsAccountPanelProps = {
  userEmail: string;
  initialSettings: UserSettings;
};

type SavedSettingsRow = {
  setting_user_id: string;
  setting_protein_target: number | string;
  setting_weight_unit: WeightUnit;
  setting_timezone: string;
  setting_display_density: DisplayDensity;
  setting_reduced_motion: boolean;
  setting_updated_at: string;
};

const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "UTC",
];

export function SettingsAccountPanel({
  userEmail,
  initialSettings,
}: SettingsAccountPanelProps) {
  const supabase = createClient();
  const router = useRouter();

  const [settings, setSettings] =
    useState<UserSettings>(
      normalizeSettings(initialSettings)
    );
  const [newPassword, setNewPassword] =
    useState("");
  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");
  const [settingsMessage, setSettingsMessage] =
    useState<string | null>(null);
  const [settingsError, setSettingsError] =
    useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] =
    useState<string | null>(null);
  const [passwordError, setPasswordError] =
    useState<string | null>(null);
  const [isSaving, startSaving] =
    useTransition();
  const [
    isChangingPassword,
    startPasswordChange,
  ] = useTransition();

  const deviceTimezone = useMemo(
    () =>
      Intl.DateTimeFormat().resolvedOptions()
        .timeZone || "America/New_York",
    []
  );

  function updateSetting<K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) {
    setSettingsMessage(null);
    setSettingsError(null);

    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function useDeviceTimezone() {
    updateSetting("timezone", deviceTimezone);
  }

  function saveSettings() {
    setSettingsMessage(null);
    setSettingsError(null);

    const proteinTarget = Number(
      settings.protein_target
    );

    if (
      !Number.isFinite(proteinTarget) ||
      proteinTarget < 1 ||
      proteinTarget > 500
    ) {
      setSettingsError(
        "Protein target must be between 1 and 500 grams."
      );
      return;
    }

    if (!isValidTimeZone(settings.timezone)) {
      setSettingsError(
        "Enter a valid IANA timezone, such as America/New_York."
      );
      return;
    }

    startSaving(async () => {
      const { data: rawData, error } =
        await supabase
          .rpc("save_daily_reset_settings", {
            target_protein_target:
              proteinTarget,
            target_weight_unit:
              settings.weight_unit,
            target_timezone:
              settings.timezone.trim(),
            target_display_density:
              settings.display_density,
            target_reduced_motion:
              settings.reduced_motion,
          })
          .single();

      if (error) {
        console.error(
          "Settings save failed:",
          error.message
        );
        setSettingsError(error.message);
        return;
      }

      if (!rawData) {
        setSettingsError(
          "Settings saved, but no updated record was returned."
        );
        return;
      }

      const row =
        rawData as unknown as SavedSettingsRow;

      const savedSettings: UserSettings = {
        protein_target: Number(
          row.setting_protein_target
        ),
        weight_unit:
          row.setting_weight_unit,
        timezone: row.setting_timezone,
        display_density:
          row.setting_display_density,
        reduced_motion: Boolean(
          row.setting_reduced_motion
        ),
        updated_at:
          row.setting_updated_at,
      };

      setSettings(savedSettings);
      setSettingsMessage(
        "Preferences synced to Supabase."
      );

      window.dispatchEvent(
        new CustomEvent(
          "daily-reset-settings-updated",
          {
            detail: savedSettings,
          }
        )
      );

      window.dispatchEvent(
        new CustomEvent(
          "daily-reset-timezone-updated",
          {
            detail: savedSettings.timezone,
          }
        )
      );

      router.refresh();
    });
  }

  function changePassword() {
    setPasswordMessage(null);
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError(
        "Use at least 8 characters for the new password."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(
        "The password confirmation does not match."
      );
      return;
    }

    startPasswordChange(async () => {
      const { error } =
        await supabase.auth.updateUser({
          password: newPassword,
        });

      if (error) {
        console.error(
          "Password update failed:",
          error.message
        );
        setPasswordError(error.message);
        return;
      }

      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage(
        "Password updated for this account."
      );
    });
  }

  return (
    <section className="border border-[#242424] bg-[#050505]">
      <div className="border-b border-[#242424] bg-[#0d0d0d] px-3 py-2">
        <p className="terminal-green text-xs uppercase tracking-[0.2em]">
          &gt; settings.account
        </p>
      </div>

      <div className="p-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric
            label="ACCOUNT"
            value="AUTHENTICATED"
            green
          />

          <Metric
            label="TIMEZONE"
            value={settings.timezone}
            green
          />

          <Metric
            label="DISPLAY"
            value={
              settings.display_density ===
              "compact"
                ? "COMPACT"
                : "COMFORTABLE"
            }
          />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <section className="border border-[#242424] bg-[#080808] p-3">
            <p className="terminal-green text-xs uppercase tracking-[0.18em]">
              &gt; app.preferences
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Protein target">
                <div className="flex">
                  <input
                    type="number"
                    min={1}
                    max={500}
                    inputMode="numeric"
                    value={
                      settings.protein_target
                    }
                    onChange={(event) =>
                      updateSetting(
                        "protein_target",
                        Number(
                          event.target.value
                        )
                      )
                    }
                    className={`${inputClassName} rounded-none`}
                  />

                  <span className="flex min-h-[48px] items-center border border-l-0 border-[#242424] bg-[#050505] px-3 text-xs text-[#8a8a8a]">
                    grams
                  </span>
                </div>
              </Field>

              <Field label="Preferred weight unit">
                <select
                  value={settings.weight_unit}
                  onChange={(event) =>
                    updateSetting(
                      "weight_unit",
                      event.target
                        .value as WeightUnit
                    )
                  }
                  className={inputClassName}
                >
                  <option value="lbs">
                    Pounds (lbs)
                  </option>
                  <option value="kg">
                    Kilograms (kg)
                  </option>
                </select>
              </Field>

              <Field label="Display density">
                <select
                  value={
                    settings.display_density
                  }
                  onChange={(event) =>
                    updateSetting(
                      "display_density",
                      event.target
                        .value as DisplayDensity
                    )
                  }
                  className={inputClassName}
                >
                  <option value="comfortable">
                    Comfortable
                  </option>
                  <option value="compact">
                    Compact
                  </option>
                </select>
              </Field>

              <Field label="Motion">
                <button
                  type="button"
                  role="switch"
                  aria-checked={
                    settings.reduced_motion
                  }
                  onClick={() =>
                    updateSetting(
                      "reduced_motion",
                      !settings.reduced_motion
                    )
                  }
                  className={[
                    "min-h-[48px] w-full border px-3 text-left text-xs uppercase tracking-[0.12em]",
                    settings.reduced_motion
                      ? "border-[#39ff88] text-[#39ff88]"
                      : "border-[#242424] text-[#8a8a8a]",
                  ].join(" ")}
                >
                  {settings.reduced_motion
                    ? "REDUCED MOTION ON"
                    : "NORMAL MOTION"}
                </button>
              </Field>
            </div>

            <Field label="Timezone">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  type="text"
                  list="daily-reset-timezones"
                  value={settings.timezone}
                  onChange={(event) =>
                    updateSetting(
                      "timezone",
                      event.target.value
                    )
                  }
                  className={inputClassName}
                />

                <button
                  type="button"
                  onClick={useDeviceTimezone}
                  className="min-h-[48px] border border-[#242424] px-3 text-xs text-[#e5e5e5] transition hover:border-[#39ff88] hover:text-[#39ff88]"
                >
                  use device
                </button>
              </div>

              <datalist id="daily-reset-timezones">
                {COMMON_TIMEZONES.map(
                  (timeZone) => (
                    <option
                      key={timeZone}
                      value={timeZone}
                    />
                  )
                )}
              </datalist>
            </Field>

            <button
              type="button"
              onClick={saveSettings}
              disabled={isSaving}
              className="mt-4 min-h-[48px] w-full border border-[#39ff88] bg-[#050505] px-4 py-3 text-left text-sm text-[#39ff88] transition hover:bg-[#0d0d0d] disabled:cursor-not-allowed disabled:opacity-50"
            >
              &gt;{" "}
              {isSaving
                ? "syncing_preferences..."
                : "save_preferences"}
            </button>

            {settingsMessage ? (
              <p className="terminal-green mt-3 text-xs leading-6">
                &gt; {settingsMessage}
              </p>
            ) : null}

            {settingsError ? (
              <p className="mt-3 text-xs leading-6 text-[#ff6b6b]">
                &gt; {settingsError}
              </p>
            ) : null}
          </section>

          <section className="border border-[#242424] bg-[#080808] p-3">
            <p className="terminal-green text-xs uppercase tracking-[0.18em]">
              &gt; account.security
            </p>

            <div className="mt-4 border border-[#242424] bg-[#050505] p-3">
              <p className="terminal-muted text-[10px] uppercase tracking-[0.14em]">
                Signed in as
              </p>

              <p className="mt-2 break-all text-sm text-[#e5e5e5]">
                {userEmail}
              </p>
            </div>

            <div className="mt-4 space-y-3">
              <Field label="New password">
                <input
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) =>
                    setNewPassword(
                      event.target.value
                    )
                  }
                  className={inputClassName}
                  placeholder="At least 8 characters"
                />
              </Field>

              <Field label="Confirm password">
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(
                      event.target.value
                    )
                  }
                  className={inputClassName}
                  placeholder="Repeat new password"
                />
              </Field>
            </div>

            <button
              type="button"
              onClick={changePassword}
              disabled={isChangingPassword}
              className="mt-4 min-h-[48px] w-full border border-[#ffb020] bg-[#050505] px-4 py-3 text-left text-sm text-[#ffb020] transition hover:bg-[#0d0d0d] disabled:cursor-not-allowed disabled:opacity-50"
            >
              &gt;{" "}
              {isChangingPassword
                ? "updating_password..."
                : "change_password"}
            </button>

            {passwordMessage ? (
              <p className="terminal-green mt-3 text-xs leading-6">
                &gt; {passwordMessage}
              </p>
            ) : null}

            {passwordError ? (
              <p className="mt-3 text-xs leading-6 text-[#ff6b6b]">
                &gt; {passwordError}
              </p>
            ) : null}

            <p className="terminal-muted mt-4 border-t border-[#242424] pt-3 text-xs leading-6">
              &gt; Password changes apply to the
              current Supabase account across devices.
            </p>
          </section>
        </div>

        <div className="terminal-muted mt-4 border-t border-[#242424] pt-3 text-xs leading-6">
          <p>
            &gt; Preference changes sync to Supabase
            and are restored after login on another
            device.
          </p>

          <p>
            &gt; Existing weight records keep the unit
            originally stored with each log.
          </p>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mt-3 block first:mt-0">
      <span className="terminal-muted text-[10px] uppercase tracking-[0.14em]">
        {label}
      </span>

      <span className="mt-2 block">
        {children}
      </span>
    </label>
  );
}

function Metric({
  label,
  value,
  green = false,
}: {
  label: string;
  value: string;
  green?: boolean;
}) {
  return (
    <div className="border border-[#242424] bg-[#080808] p-3">
      <p className="terminal-muted text-[10px] uppercase tracking-[0.18em]">
        {label}
      </p>

      <p
        className={
          green
            ? "terminal-green mt-2 break-words text-sm"
            : "mt-2 break-words text-sm text-[#e5e5e5]"
        }
      >
        {value}
      </p>
    </div>
  );
}

const inputClassName =
  "min-h-[48px] w-full border border-[#242424] bg-[#050505] px-3 text-sm text-[#e5e5e5] outline-none transition placeholder:text-[#555555] focus:border-[#39ff88]";

function normalizeSettings(
  settings: UserSettings
): UserSettings {
  return {
    protein_target: Number(
      settings.protein_target ?? 150
    ),
    weight_unit:
      settings.weight_unit === "kg"
        ? "kg"
        : "lbs",
    timezone:
      settings.timezone ||
      "America/New_York",
    display_density:
      settings.display_density ===
      "compact"
        ? "compact"
        : "comfortable",
    reduced_motion: Boolean(
      settings.reduced_motion
    ),
    updated_at: settings.updated_at,
  };
}

function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", {
      timeZone: value.trim(),
    }).format();

    return true;
  } catch {
    return false;
  }
}
