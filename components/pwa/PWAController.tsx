"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

const DISMISS_KEY =
  "daily-reset-pwa-install-dismissed-v1";

export function PWAController() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(
      null
    );
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] =
    useState(false);
  const [isDismissed, setIsDismissed] =
    useState(true);
  const [isInstalling, setIsInstalling] =
    useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia(
        "(display-mode: standalone)"
      ).matches ||
      Boolean(
        (
          window.navigator as Navigator & {
            standalone?: boolean;
          }
        ).standalone
      );

    const ios =
      /iphone|ipad|ipod/i.test(
        window.navigator.userAgent
      ) && !standalone;

    setIsStandalone(standalone);
    setIsIOS(ios);
    setIsDismissed(
      window.localStorage.getItem(DISMISS_KEY) ===
        "true"
    );

    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") {
        void navigator.serviceWorker
          .register("/sw.js", { scope: "/" })
          .catch((error) => {
            console.error(
              "Service worker registration failed:",
              error
            );
          });
      } else {
        // A service worker registered by a previous production test can
        // keep intercepting localhost during development. Remove it so
        // Next.js dev navigation always uses the current source files.
        void navigator.serviceWorker
          .getRegistrations()
          .then((registrations) =>
            Promise.all(
              registrations.map((registration) =>
                registration.unregister()
              )
            )
          )
          .catch((error) => {
            console.error(
              "Development service worker cleanup failed:",
              error
            );
          });

        if ("caches" in window) {
          void window.caches
            .keys()
            .then((keys) =>
              Promise.all(
                keys
                  .filter((key) =>
                    key.startsWith("daily-reset-static-")
                  )
                  .map((key) =>
                    window.caches.delete(key)
                  )
              )
            )
            .catch((error) => {
              console.error(
                "Development cache cleanup failed:",
                error
              );
            });
        }
      }
    }

    function handleInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(
        event as BeforeInstallPromptEvent
      );
      setIsDismissed(false);
    }

    function handleInstalled() {
      setInstallPrompt(null);
      setIsStandalone(true);
    }

    window.addEventListener(
      "beforeinstallprompt",
      handleInstallPrompt
    );
    window.addEventListener(
      "appinstalled",
      handleInstalled
    );

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleInstallPrompt
      );
      window.removeEventListener(
        "appinstalled",
        handleInstalled
      );
    };
  }, []);

  function dismissPrompt() {
    window.localStorage.setItem(DISMISS_KEY, "true");
    setIsDismissed(true);
  }

  async function installApp() {
    if (!installPrompt) {
      return;
    }

    setIsInstalling(true);

    try {
      await installPrompt.prompt();
      const choice =
        await installPrompt.userChoice;

      if (choice.outcome === "accepted") {
        setInstallPrompt(null);
      }
    } finally {
      setIsInstalling(false);
    }
  }

  if (
    isStandalone ||
    isDismissed ||
    (!installPrompt && !isIOS)
  ) {
    return null;
  }

  return (
    <aside
      className="fixed inset-x-3 bottom-3 z-50 border border-[#39ff88] bg-[#050505] p-3 shadow-2xl sm:hidden"
      style={{
        paddingBottom:
          "max(0.75rem, env(safe-area-inset-bottom))",
      }}
      aria-label="Install Daily Reset"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="terminal-green text-xs uppercase tracking-[0.18em]">
            &gt; install.daily_reset
          </p>

          <p className="terminal-muted mt-2 text-xs leading-5">
            {isIOS
              ? "In Safari, tap Share, then Add to Home Screen."
              : "Install the app for a full-screen phone experience."}
          </p>
        </div>

        <button
          type="button"
          onClick={dismissPrompt}
          className="min-h-[44px] min-w-[44px] border border-[#242424] text-[#8a8a8a]"
          aria-label="Dismiss install prompt"
        >
          ×
        </button>
      </div>

      {!isIOS ? (
        <button
          type="button"
          onClick={installApp}
          disabled={isInstalling}
          className="mt-3 min-h-[48px] w-full border border-[#39ff88] bg-[#080808] px-4 py-3 text-left text-sm text-[#39ff88] disabled:cursor-not-allowed disabled:opacity-60"
        >
          &gt;{" "}
          {isInstalling
            ? "installing..."
            : "install_app"}
        </button>
      ) : null}
    </aside>
  );
}
