"use client";

export const DAILY_RESET_DATA_CHANGED_EVENT =
  "daily-reset:data-changed";

export type DailyResetDataScope =
  | "habits"
  | "analytics"
  | "body"
  | "nutrition"
  | "journal"
  | "shadow";

export type DailyResetMetricPatch = {
  todayProtein?: number;
  latestWeight?: number | null;
  weightUnit?: "lbs" | "kg";
};

export type DailyResetDataChangedDetail = {
  scopes: DailyResetDataScope[];
  source:
    | "manual-habit"
    | "weight"
    | "breakfast-protein"
    | "dream"
    | "shadow"
    | "reconnect"
    | "unknown";
  date?: string;
  habitId?: string;
  habitName?: string;
  completed?: boolean;
  metrics?: DailyResetMetricPatch;
};

export function dispatchDailyResetDataChanged(
  detail: DailyResetDataChangedDetail
) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<DailyResetDataChangedDetail>(
      DAILY_RESET_DATA_CHANGED_EVENT,
      { detail }
    )
  );
}
