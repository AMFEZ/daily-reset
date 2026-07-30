"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  OFFLINE_QUEUE_EVENT,
  cleanupOrphanedOfflineAudio,
  getOfflineOperationCount,
  syncOfflineQueue,
  type OfflineQueueStatus,
} from "@/lib/offlineStore";
import { dispatchDailyResetDataChanged } from "@/lib/dailyResetEvents";

export function OfflineSyncRuntime() {
  const [isOnline, setIsOnline] =
    useState(true);
  const [pending, setPending] =
    useState(0);
  const [isSyncing, setIsSyncing] =
    useState(false);
  const [lastError, setLastError] =
    useState<string | null>(null);

  const runSync =
    useCallback(async () => {
      await cleanupOrphanedOfflineAudio();
      const summary =
        await syncOfflineQueue();

      if (
        summary.syncedKinds.length >
        0
      ) {
        const scopes = new Set<
          | "habits"
          | "analytics"
          | "body"
          | "nutrition"
          | "journal"
          | "shadow"
        >();

        for (
          const kind of
          summary.syncedKinds
        ) {
          if (kind === "habit") {
            scopes.add("habits");
            scopes.add(
              "analytics"
            );
          }

          if (
            kind === "protein"
          ) {
            scopes.add(
              "nutrition"
            );
            scopes.add(
              "analytics"
            );
          }

          if (
            kind === "weight"
          ) {
            scopes.add("body");
          }

          if (
            kind === "journal" ||
            kind === "journal-delete" ||
            kind === "audio-upload"
          ) {
            scopes.add("journal");
            scopes.add("shadow");
            scopes.add("analytics");
          }
        }

        dispatchDailyResetDataChanged(
          {
            scopes:
              Array.from(scopes),
            source: "unknown",
          }
        );
      }
    }, []);

  useEffect(() => {
    const updateConnection =
      () => {
        const online =
          navigator.onLine;

        setIsOnline(online);

        if (online) {
          void runSync();
        }
      };

    const updatePending =
      async () => {
        try {
          setPending(
            await getOfflineOperationCount()
          );
        } catch {
          setPending(0);
        }
      };

    const handleQueueStatus =
      (event: Event) => {
        const detail =
          (
            event as CustomEvent<OfflineQueueStatus>
          ).detail;

        if (!detail) return;

        setPending(
          detail.pending
        );
        setIsSyncing(
          detail.syncing
        );
        setLastError(
          detail.lastError
        );
      };

    updateConnection();
    void updatePending();

    window.addEventListener(
      "online",
      updateConnection
    );
    window.addEventListener(
      "offline",
      updateConnection
    );
    const handleFocus = () => {
      if (navigator.onLine) {
        void runSync();
      }
    };

    const handleVisibility = () => {
      if (
        document.visibilityState ===
          "visible" &&
        navigator.onLine
      ) {
        void runSync();
      }
    };

    window.addEventListener(
      OFFLINE_QUEUE_EVENT,
      handleQueueStatus
    );
    window.addEventListener(
      "focus",
      handleFocus
    );
    window.addEventListener(
      "pageshow",
      handleFocus
    );
    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    const interval =
      window.setInterval(
        () => {
          if (
            navigator.onLine
          ) {
            void runSync();
          }
        },
        30_000
      );

    return () => {
      window.removeEventListener(
        "online",
        updateConnection
      );
      window.removeEventListener(
        "offline",
        updateConnection
      );
      window.removeEventListener(
        OFFLINE_QUEUE_EVENT,
        handleQueueStatus
      );
      window.removeEventListener(
        "focus",
        handleFocus
      );
      window.removeEventListener(
        "pageshow",
        handleFocus
      );
      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
      window.clearInterval(
        interval
      );
    };
  }, [runSync]);

  if (
    isOnline &&
    pending === 0 &&
    !isSyncing &&
    !lastError
  ) {
    return null;
  }

  const message = !isOnline
    ? `OFFLINE — ${pending} CHANGE${
        pending === 1 ? "" : "S"
      } PENDING`
    : isSyncing
      ? `SYNCING ${pending} PENDING CHANGE${
          pending === 1
            ? ""
            : "S"
        }`
      : lastError
        ? `${pending} CHANGE${
            pending === 1
              ? ""
              : "S"
          } SAVED LOCALLY — RETRYING`
        : `${pending} CHANGE${
            pending === 1
              ? ""
              : "S"
          } WAITING TO SYNC`;

  return (
    <div
      role="status"
      aria-live="polite"
      className={
        lastError
          ? "border-b border-[#5a4218] bg-[#120d04] px-3 py-2 text-[11px] text-[#ffb020] sm:px-4"
          : "border-b border-[#365341] bg-[#06110a] px-3 py-2 text-[11px] text-[#9fd8b5] sm:px-4"
      }
    >
      &gt; {message}
    </div>
  );
}
