"use client";

import {
  useEffect,
  useState,
} from "react";

const STORAGE_KEY =
  "daily-reset-settings-hub-open";

export function SettingsHub({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] =
    useState(false);
  const [hasMounted, setHasMounted] =
    useState(false);

  useEffect(() => {
    setHasMounted(true);

    const stored =
      window.localStorage.getItem(
        STORAGE_KEY
      );

    if (stored === "true") {
      setIsOpen(true);
    }
  }, []);

  function toggleOpen() {
    setIsOpen((current) => {
      const next = !current;

      window.localStorage.setItem(
        STORAGE_KEY,
        String(next)
      );

      return next;
    });
  }

  const openState =
    hasMounted && isOpen;

  return (
    <section
      id="settings-hub"
      className="mt-4 border border-[#242424] bg-[#050505]"
    >
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={openState}
        aria-controls="settings-hub-content"
        className="flex min-h-[58px] w-full items-center justify-between gap-4 bg-[#0d0d0d] px-3 py-3 text-left transition hover:bg-[#111111] sm:px-4"
      >
        <span>
          <span className="terminal-green block text-xs uppercase tracking-[0.2em]">
            &gt; settings.hub
          </span>

          <span className="terminal-muted mt-1 block text-[10px] leading-5 sm:text-xs">
            Reminders, protocols, account,
            data, release, deployment, and
            analytics
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-3">
          <span className="hidden border border-[#242424] px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-[#8a8a8a] sm:inline">
            7 modules
          </span>

          <span
            className={[
              "terminal-green text-lg transition-transform",
              openState
                ? "rotate-180"
                : "",
            ].join(" ")}
            aria-hidden="true"
          >
            ⌄
          </span>
        </span>
      </button>

      {openState ? (
        <div
          id="settings-hub-content"
          className="border-t border-[#242424] p-3 sm:p-4"
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}