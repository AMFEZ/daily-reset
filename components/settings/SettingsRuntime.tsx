"use client";

import type { UserSettings } from "@/components/settings/SettingsAccountPanel";
import { useEffect, useState } from "react";

type SettingsUpdateEvent =
  CustomEvent<UserSettings>;

export function SettingsRuntime({
  initialSettings,
}: {
  initialSettings: UserSettings;
}) {
  const [settings, setSettings] =
    useState(initialSettings);

  useEffect(() => {
    function handleSettingsUpdate(
      event: Event
    ) {
      const customEvent =
        event as SettingsUpdateEvent;

      setSettings(customEvent.detail);
    }

    window.addEventListener(
      "daily-reset-settings-updated",
      handleSettingsUpdate
    );

    return () => {
      window.removeEventListener(
        "daily-reset-settings-updated",
        handleSettingsUpdate
      );
    };
  }, []);

  useEffect(() => {
    const root =
      document.documentElement;

    root.dataset.dailyResetDensity =
      settings.display_density;

    root.classList.toggle(
      "daily-reset-reduced-motion",
      settings.reduced_motion
    );

    window.localStorage.setItem(
      "daily-reset-weight-unit",
      settings.weight_unit
    );
    window.localStorage.setItem(
      "daily-reset-timezone",
      settings.timezone
    );
  }, [settings]);

  return (
    <style>{`
      html[data-daily-reset-density="compact"]
        .terminal-window
        .terminal-line {
        padding-top: 0.35rem !important;
        padding-bottom: 0.35rem !important;
      }

      html[data-daily-reset-density="compact"]
        .terminal-window
        .p-3 {
        padding: 0.6rem !important;
      }

      html.daily-reset-reduced-motion *,
      html.daily-reset-reduced-motion *::before,
      html.daily-reset-reduced-motion *::after {
        animation-duration: 0.001ms !important;
        animation-iteration-count: 1 !important;
        scroll-behavior: auto !important;
        transition-duration: 0.001ms !important;
      }
    `}</style>
  );
}
