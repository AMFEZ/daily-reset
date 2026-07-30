"use client";

import {
  useEffect,
  useState,
} from "react";
import type {
  RealtimeChannel,
  SupabaseClient,
} from "@supabase/supabase-js";
import type {
  Database,
} from "@/types/database.types";

type BrowserSupabaseClient =
  SupabaseClient<Database>;

export type DailyResetRealtimeStatus =
  | "connecting"
  | "live"
  | "degraded";

type RealtimeRow =
  Record<string, unknown>;

type RealtimeChangePayload = {
  new: RealtimeRow;
  old: RealtimeRow;
};

type RealtimeSubscribeStatus =
  | "SUBSCRIBED"
  | "TIMED_OUT"
  | "CLOSED"
  | "CHANNEL_ERROR";

type DailyResetRealtimeOptions = {
  supabase: BrowserSupabaseClient;
  date: string;
  onHabitUpsert: (
    row: RealtimeRow
  ) => void;
  onHabitDelete: () => void;
  onWeightChange: () => void;
  onProteinChange: () => void;
};

const CONNECTION_TIMEOUT_MS =
  8_000;

export function useDailyResetRealtime({
  supabase,
  date,
  onHabitUpsert,
  onHabitDelete,
  onWeightChange,
  onProteinChange,
}: DailyResetRealtimeOptions) {
  const [status, setStatus] =
    useState<DailyResetRealtimeStatus>(
      "connecting"
    );

  useEffect(() => {
    let active = true;
    let attempt = 0;
    let channel:
      | RealtimeChannel
      | null = null;
    let connectionTimer:
      | number
      | null = null;

    function clearConnectionTimer() {
      if (
        connectionTimer !==
        null
      ) {
        window.clearTimeout(
          connectionTimer
        );
        connectionTimer = null;
      }
    }

    async function removeCurrentChannel() {
      const current =
        channel;
      channel = null;

      if (current) {
        try {
          await supabase.removeChannel(
            current
          );
        } catch (error) {
          console.error(
            "Realtime channel cleanup failed:",
            error
          );
        }
      }
    }

    async function subscribe() {
      const currentAttempt =
        ++attempt;

      clearConnectionTimer();

      if (!navigator.onLine) {
        await removeCurrentChannel();

        if (
          active &&
          currentAttempt ===
            attempt
        ) {
          setStatus(
            "degraded"
          );
        }

        return;
      }

      setStatus("connecting");

      await removeCurrentChannel();

      if (
        !active ||
        currentAttempt !==
          attempt
      ) {
        return;
      }

      let session:
        | Awaited<
            ReturnType<
              typeof supabase.auth.getSession
            >
          >["data"]["session"]
        | null = null;

      try {
        const result =
          await supabase.auth.getSession();

        if (result.error) {
          throw result.error;
        }

        session =
          result.data.session;
      } catch (error) {
        if (
          active &&
          currentAttempt ===
            attempt
        ) {
          console.error(
            "Realtime authentication failed:",
            error
          );
          setStatus(
            "degraded"
          );
        }

        return;
      }

      if (
        !active ||
        currentAttempt !==
          attempt
      ) {
        return;
      }

      const user =
        session?.user ?? null;

      if (!user) {
        console.error(
          "Realtime authentication failed: No authenticated user."
        );
        setStatus("degraded");
        return;
      }

      const userFilter =
        `user_id=eq.${user.id}`;

      connectionTimer =
        window.setTimeout(
          () => {
            if (
              active &&
              currentAttempt ===
                attempt
            ) {
              setStatus(
                "degraded"
              );
            }
          },
          CONNECTION_TIMEOUT_MS
        );

      channel = supabase
        .channel(
          `daily-reset:${user.id}:${date}`
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table:
              "habit_logs",
            filter:
              userFilter,
          },
          (
            payload:
              RealtimeChangePayload
          ) => {
            onHabitUpsert(
              payload.new
            );
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table:
              "habit_logs",
            filter:
              userFilter,
          },
          (
            payload:
              RealtimeChangePayload
          ) => {
            onHabitUpsert(
              payload.new
            );
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table:
              "habit_logs",
          },
          () => {
            onHabitDelete();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table:
              "weight_logs",
            filter:
              userFilter,
          },
          onWeightChange
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table:
              "weight_logs",
            filter:
              userFilter,
          },
          onWeightChange
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table:
              "weight_logs",
          },
          onWeightChange
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table:
              "protein_logs",
            filter:
              userFilter,
          },
          onProteinChange
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table:
              "protein_logs",
            filter:
              userFilter,
          },
          onProteinChange
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table:
              "protein_logs",
          },
          onProteinChange
        )
        .subscribe(
          (
            nextStatus:
              RealtimeSubscribeStatus
          ) => {
            if (
              !active ||
              currentAttempt !==
                attempt
            ) {
              return;
            }

            if (
              nextStatus ===
              "SUBSCRIBED"
            ) {
              clearConnectionTimer();
              setStatus("live");
              return;
            }

            if (
              nextStatus ===
                "CHANNEL_ERROR" ||
              nextStatus ===
                "TIMED_OUT" ||
              nextStatus ===
                "CLOSED"
            ) {
              clearConnectionTimer();
              setStatus(
                "degraded"
              );
            }
          }
        );
    }

    function handleOffline() {
      attempt += 1;
      clearConnectionTimer();
      setStatus("degraded");
      void removeCurrentChannel();
    }

    function handleOnline() {
      void subscribe();
    }

    function handleVisibilityChange() {
      if (
        document.visibilityState ===
          "visible" &&
        navigator.onLine
      ) {
        void subscribe();
      }
    }

    window.addEventListener(
      "offline",
      handleOffline
    );
    window.addEventListener(
      "online",
      handleOnline
    );
    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    void subscribe();

    return () => {
      active = false;
      attempt += 1;
      clearConnectionTimer();

      window.removeEventListener(
        "offline",
        handleOffline
      );
      window.removeEventListener(
        "online",
        handleOnline
      );
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      void removeCurrentChannel();
    };
  }, [
    date,
    onHabitDelete,
    onHabitUpsert,
    onProteinChange,
    onWeightChange,
    supabase,
  ]);

  return status;
}
