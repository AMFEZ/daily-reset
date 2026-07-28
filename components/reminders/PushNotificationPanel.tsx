"use client";

import {
  useEffect,
  useState,
  useTransition,
} from "react";

type PushStatus =
  | "checking"
  | "unsupported"
  | "needs_home_screen"
  | "blocked"
  | "disabled"
  | "enabled";

const PUSH_ENABLED_STORAGE_KEY =
  "daily-reset:push-enabled";

export function PushNotificationPanel() {
  const [status, setStatus] =
    useState<PushStatus>("checking");
  const [message, setMessage] =
    useState<string | null>(null);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);
  const [isPending, startTransition] =
    useTransition();

  useEffect(() => {
    let isActive = true;

    void inspectPushState().then(
      (nextStatus) => {
        if (!isActive) {
          return;
        }

        setStatus(nextStatus);
        writePushFlag(
          nextStatus === "enabled"
        );
      }
    );

    return () => {
      isActive = false;
    };
  }, []);

  function enablePush() {
    setMessage(null);
    setErrorMessage(null);

    startTransition(async () => {
      try {
        if (
          isIOSBrowser() &&
          !isStandaloneMode()
        ) {
          setStatus(
            "needs_home_screen"
          );
          throw new Error(
            "On iPhone, open Daily Reset from its Home Screen icon before enabling notifications."
          );
        }

        if (
          !supportsPush() ||
          !window.isSecureContext
        ) {
          setStatus("unsupported");
          throw new Error(
            "This device does not support secure Web Push."
          );
        }

        const registration =
          await ensureServiceWorker();

        const permission =
          await Notification.requestPermission();

        if (permission === "denied") {
          setStatus("blocked");
          throw new Error(
            "Notifications are blocked in this device's settings."
          );
        }

        if (permission !== "granted") {
          setStatus("disabled");
          throw new Error(
            "Notification permission was not granted."
          );
        }

        const publicKeyResponse =
          await fetch(
            "/api/push/public-key",
            {
              cache: "no-store",
              credentials:
                "same-origin",
            }
          );

        const publicKeyPayload =
          (await publicKeyResponse
            .json()
            .catch(() => null)) as
            | {
                publicKey?: string;
                error?: string;
              }
            | null;

        if (
          !publicKeyResponse.ok ||
          !publicKeyPayload?.publicKey
        ) {
          throw new Error(
            publicKeyPayload?.error ??
              "The server push key is unavailable."
          );
        }

        let subscription =
          await registration.pushManager.getSubscription();

        if (!subscription) {
          subscription =
            await registration.pushManager.subscribe(
              {
                userVisibleOnly: true,
                applicationServerKey:
                  urlBase64ToUint8Array(
                    publicKeyPayload.publicKey
                  ),
              }
            );
        }

        await saveSubscription(
          subscription
        );

        writePushFlag(true);
        setStatus("enabled");
        setMessage(
          "Closed-app notifications enabled on this device."
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Push notifications could not be enabled."
        );
      }
    });
  }

  function disablePush() {
    setMessage(null);
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const registration =
          await navigator.serviceWorker.getRegistration(
            "/"
          );
        const subscription =
          await registration?.pushManager.getSubscription();

        if (subscription) {
          const response = await fetch(
            "/api/push/subscriptions",
            {
              method: "DELETE",
              headers: {
                "Content-Type":
                  "application/json",
              },
              credentials:
                "same-origin",
              cache: "no-store",
              body: JSON.stringify({
                endpoint:
                  subscription.endpoint,
              }),
            }
          );

          const payload =
            (await response
              .json()
              .catch(() => null)) as
              | {
                  error?: string;
                }
              | null;

          if (!response.ok) {
            throw new Error(
              payload?.error ??
                "The server subscription could not be removed."
            );
          }

          await subscription.unsubscribe();
        }

        writePushFlag(false);
        setStatus("disabled");
        setMessage(
          "Closed-app notifications disabled on this device."
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Push notifications could not be disabled."
        );
      }
    });
  }

  function testPush() {
    setMessage(null);
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch(
          "/api/push/test",
          {
            method: "POST",
            credentials:
              "same-origin",
            cache: "no-store",
          }
        );

        const payload =
          (await response
            .json()
            .catch(() => null)) as
            | {
                sent?: number;
                failed?: number;
                error?: string;
              }
            | null;

        if (!response.ok) {
          throw new Error(
            payload?.error ??
              "The test push could not be sent."
          );
        }

        setMessage(
          `Test push sent to ${payload?.sent ?? 1} device${(payload?.sent ?? 1) === 1 ? "" : "s"}.`
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "The test push could not be sent."
        );
      }
    });
  }

  return (
    <section className="mt-4 border border-[#242424] bg-[#080808] p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="terminal-green text-xs">
            &gt; closed_app_notifications
          </p>

          <p className="terminal-muted mt-1 text-[10px] uppercase tracking-[0.14em]">
            {formatStatus(status)}
          </p>
        </div>

        <span
          className={[
            "border px-2 py-1 text-[10px] uppercase tracking-[0.12em]",
            status === "enabled"
              ? "border-[#39ff88] text-[#39ff88]"
              : status === "blocked"
                ? "border-[#ff6b6b] text-[#ff6b6b]"
                : "border-[#242424] text-[#8a8a8a]",
          ].join(" ")}
        >
          {status === "enabled"
            ? "ONLINE"
            : "OFFLINE"}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={enablePush}
          disabled={
            isPending ||
            status === "enabled"
          }
          className="min-h-[46px] border border-[#39ff88] bg-[#050505] px-3 py-2 text-left text-xs text-[#39ff88] disabled:cursor-not-allowed disabled:border-[#242424] disabled:text-[#626262]"
        >
          &gt; enable_push
        </button>

        <button
          type="button"
          onClick={testPush}
          disabled={
            isPending ||
            status !== "enabled"
          }
          className="min-h-[46px] border border-[#242424] bg-[#050505] px-3 py-2 text-left text-xs text-[#e5e5e5] disabled:cursor-not-allowed disabled:opacity-45"
        >
          &gt; test_push
        </button>

        <button
          type="button"
          onClick={disablePush}
          disabled={
            isPending ||
            status !== "enabled"
          }
          className="min-h-[46px] border border-[#242424] bg-[#050505] px-3 py-2 text-left text-xs text-[#e5e5e5] disabled:cursor-not-allowed disabled:opacity-45"
        >
          &gt; disable_push
        </button>
      </div>

      {message ? (
        <p className="terminal-green mt-3 text-xs leading-5">
          &gt; {message}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="mt-3 text-xs leading-5 text-[#ff6b6b]">
          &gt; {errorMessage}
        </p>
      ) : null}
    </section>
  );
}

async function inspectPushState():
  Promise<PushStatus> {
  if (
    !supportsPush() ||
    !window.isSecureContext
  ) {
    return "unsupported";
  }

  if (
    isIOSBrowser() &&
    !isStandaloneMode()
  ) {
    return "needs_home_screen";
  }

  if (
    Notification.permission ===
    "denied"
  ) {
    return "blocked";
  }

  const registration =
    await ensureServiceWorker();
  const subscription =
    await registration.pushManager.getSubscription();

  if (!subscription) {
    return "disabled";
  }

  try {
    await saveSubscription(
      subscription
    );
  } catch (error) {
    console.error(
      "Push subscription sync failed:",
      error
    );
  }

  return "enabled";
}

function supportsPush() {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function isIOSBrowser() {
  return /iphone|ipad|ipod/i.test(
    navigator.userAgent
  );
}

function isStandaloneMode() {
  return (
    window.matchMedia(
      "(display-mode: standalone)"
    ).matches ||
    Boolean(
      (
        navigator as Navigator & {
          standalone?: boolean;
        }
      ).standalone
    )
  );
}

async function ensureServiceWorker() {
  const registration =
    await navigator.serviceWorker.register(
      "/sw.js",
      {
        scope: "/",
        updateViaCache: "none",
      }
    );

  await navigator.serviceWorker.ready;
  return registration;
}

async function saveSubscription(
  subscription: PushSubscription
) {
  const response = await fetch(
    "/api/push/subscriptions",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({
        subscription:
          subscription.toJSON(),
      }),
    }
  );

  const payload =
    (await response
      .json()
      .catch(() => null)) as
      | {
          error?: string;
        }
      | null;

  if (!response.ok) {
    throw new Error(
      payload?.error ??
        "The push subscription could not be saved."
    );
  }
}

function urlBase64ToUint8Array(
  value: string
) {
  const padding =
    "=".repeat(
      (4 - (value.length % 4)) % 4
    );
  const base64 =
    (value + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");
  const decoded =
    window.atob(base64);
  const bytes =
    new Uint8Array(
      decoded.length
    );

  for (
    let index = 0;
    index < decoded.length;
    index += 1
  ) {
    bytes[index] =
      decoded.charCodeAt(index);
  }

  return bytes;
}

function writePushFlag(
  enabled: boolean
) {
  try {
    window.localStorage.setItem(
      PUSH_ENABLED_STORAGE_KEY,
      enabled ? "true" : "false"
    );
  } catch {
    // Storage is optional. Push itself
    // remains active through the browser.
  }
}

function formatStatus(
  status: PushStatus
) {
  switch (status) {
    case "enabled":
      return "Scheduled alerts work while the app is closed";
    case "needs_home_screen":
      return "Open the installed Home Screen app to enable";
    case "blocked":
      return "Permission blocked in device settings";
    case "unsupported":
      return "Web Push unavailable on this device";
    case "checking":
      return "Checking this device";
    default:
      return "Not enabled on this device";
  }
}
