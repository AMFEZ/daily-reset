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
    let channel:
      | RealtimeChannel
      | null = null;

    async function subscribe() {
      setStatus("connecting");

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      const user = session?.user ?? null;

      if (!active) {
        return;
      }

      if (error || !user) {
        console.error(
          "Realtime authentication failed:",
          error?.message ??
            "No authenticated user."
        );
        setStatus("degraded");
        return;
      }

      const userFilter =
        `user_id=eq.${user.id}`;

      channel = supabase
        .channel(
          `daily-reset:${user.id}:${date}`
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "habit_logs",
            filter: userFilter,
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
            table: "habit_logs",
            filter: userFilter,
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
            table: "habit_logs",
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
            table: "weight_logs",
            filter: userFilter,
          },
          onWeightChange
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "weight_logs",
            filter: userFilter,
          },
          onWeightChange
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "weight_logs",
          },
          onWeightChange
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "protein_logs",
            filter: userFilter,
          },
          onProteinChange
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "protein_logs",
            filter: userFilter,
          },
          onProteinChange
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "protein_logs",
          },
          onProteinChange
        )
        .subscribe((
          nextStatus:
            RealtimeSubscribeStatus
        ) => {
          if (!active) {
            return;
          }

          if (
            nextStatus ===
            "SUBSCRIBED"
          ) {
            setStatus("live");
            return;
          }

          if (
            nextStatus ===
              "CHANNEL_ERROR" ||
            nextStatus === "TIMED_OUT" ||
            nextStatus === "CLOSED"
          ) {
            setStatus("degraded");
          }
        });
    }

    void subscribe();

    return () => {
      active = false;

      if (channel) {
        void supabase.removeChannel(
          channel
        );
      }
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
