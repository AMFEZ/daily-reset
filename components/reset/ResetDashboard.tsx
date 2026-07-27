"use client";

import { ResetScorePanel } from "@/components/reset/ResetScorePanel";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  DAILY_RESET_DATA_CHANGED_EVENT,
  dispatchDailyResetDataChanged,
  type DailyResetDataChangedDetail,
} from "@/lib/dailyResetEvents";
import {
  useDailyResetRealtime,
} from "@/lib/useDailyResetRealtime";

type RoutineType =
  | "morning"
  | "daily"
  | "night"
  | "trust_based";

type Habit = {
  id: string;
  name: string;
  category: string;
  section: string;
  routine_type: RoutineType;
  sort_order: number;
};

type HabitLog = {
  habit_id: string;
  completed: boolean;
  completion_status:
    | "complete"
    | "mostly"
    | "skipped"
    | "pending";
};

type ResetLockRow = {
  lock_date: string;
  lock_state: boolean;
  lock_timestamp: string | null;
};

type SystemStatusTone =
  | "ready"
  | "saving"
  | "success"
  | "warning"
  | "error";

type ResetDashboardProps = {
  userEmail: string;
  habits: Habit[];
  logs: HabitLog[];
  totalProtocols: number;
  initialHasResetRecord: boolean;
  initialIsLocked: boolean;
  initialLockedAt: string | null;
  timeZone: string;
  currentStreak: number;
  todayProtein: number;
  proteinTarget: number;
  latestWeight: number | null;
  weightUnit: "lbs" | "kg";
  activeGoalCount: number;
  children?: React.ReactNode;
};

const routineLabels: Record<RoutineType, string> = {
  morning: "morning_reset.list",
  daily: "daily_protocols.list",
  night: "shutdown_protocol.list",
  trust_based: "sleep_boundary.confirm",
};

const routineTitles: Record<RoutineType, string> = {
  morning: "Morning Reset",
  daily: "Daily Protocols",
  night: "Shutdown Protocol",
  trust_based: "Sleep Boundary",
};

export function ResetDashboard({
  userEmail,
  habits,
  logs,
  totalProtocols,
  initialHasResetRecord,
  initialIsLocked,
  initialLockedAt,
  timeZone,
  currentStreak,
  todayProtein,
  proteinTarget,
  latestWeight,
  weightUnit,
  activeGoalCount,
  children,
}: ResetDashboardProps) {
  const supabase = useMemo(
    () => createClient(),
    []
  );
  const saveSuccessTimer =
    useRef<number | null>(null);
  const habitRefreshTimer =
    useRef<number | null>(null);
  const habitRefreshRequestId =
    useRef(0);
  const metricRefreshTimers =
    useRef<{
      weight: number | null;
      protein: number | null;
    }>({
      weight: null,
      protein: null,
    });
  const metricRefreshRequestIds =
    useRef({
      weight: 0,
      protein: 0,
    });
  const isMountedRef =
    useRef(true);
  const pendingHabitIdsRef =
    useRef<Set<string>>(new Set());
  const [pendingHabitIds, setPendingHabitIds] =
    useState<Set<string>>(() => new Set());
  const [isLockPending, setIsLockPending] =
    useState(false);
  const [saveError, setSaveError] =
    useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] =
    useState<string | null>(null);
  const [failedHabit, setFailedHabit] =
    useState<Habit | null>(null);
  const [isOnline, setIsOnline] =
    useState(true);
  const [syncMessage, setSyncMessage] =
    useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lockError, setLockError] =
    useState<string | null>(null);
  const [hasResetRecord, setHasResetRecord] =
    useState(initialHasResetRecord);
  const [isLocked, setIsLocked] =
    useState(initialIsLocked);
  const [lockedAt, setLockedAt] =
    useState<string | null>(initialLockedAt);
  const [liveTodayProtein, setLiveTodayProtein] =
    useState(todayProtein);
  const [liveLatestWeight, setLiveLatestWeight] =
    useState<number | null>(latestWeight);
  const [liveWeightUnit, setLiveWeightUnit] =
    useState<"lbs" | "kg">(weightUnit);
  const [analyticsDirty, setAnalyticsDirty] =
    useState(false);
  const todayKey = useMemo(
    () => getTodayKey(timeZone),
    [timeZone]
  );

  const [completedMap, setCompletedMap] = useState<
    Record<string, boolean>
  >(() =>
    logs.reduce<Record<string, boolean>>(
      (accumulator, log) => {
        accumulator[log.habit_id] = log.completed;
        return accumulator;
      },
      {}
    )
  );

  const showSaveSuccess = useCallback(
    (message: string) => {
      if (saveSuccessTimer.current) {
        window.clearTimeout(
          saveSuccessTimer.current
        );
      }

      setSaveSuccess(message);

      saveSuccessTimer.current =
        window.setTimeout(() => {
          setSaveSuccess(null);
          saveSuccessTimer.current = null;
        }, 2200);
    },
    []
  );

  const refreshHabitLogs = useCallback(async () => {
    const requestId =
      ++habitRefreshRequestId.current;

    if (isMountedRef.current) {
      setIsSyncing(true);
    }

    let refreshTimeout:
      | number
      | null = null;

    try {
      const query = supabase
        .from("habit_logs")
        .select("habit_id, completed")
        .eq("date", todayKey);

      const timeout =
        new Promise<never>(
          (_, reject) => {
            refreshTimeout =
              window.setTimeout(() => {
                reject(
                  new Error(
                    "Activity refresh timed out. Try again."
                  )
                );
              }, 8000);
          }
        );

      const { data, error } =
        await Promise.race([
          query,
          timeout,
        ]);

      if (error) {
        throw error;
      }

      if (
        !isMountedRef.current ||
        requestId !==
          habitRefreshRequestId.current
      ) {
        return;
      }

      const habitLogRows = (
        data ?? []
      ) as Array<{
        habit_id: string | number;
        completed: boolean | null;
      }>;

      const nextMap =
        habitLogRows.reduce(
          (
            accumulator:
              Record<string, boolean>,
            log
          ) => {
            accumulator[
              String(log.habit_id)
            ] = Boolean(
              log.completed
            );
            return accumulator;
          },
          {}
        );

      setCompletedMap((current) => {
        const merged = { ...nextMap };

        for (
          const habitId of
          pendingHabitIdsRef.current
        ) {
          if (habitId in current) {
            merged[habitId] =
              current[habitId];
          }
        }

        return merged;
      });
      setSyncMessage(null);
    } catch (error) {
      if (
        !isMountedRef.current ||
        requestId !==
          habitRefreshRequestId.current
      ) {
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : "Habit refresh failed.";

      console.error(
        "Habit refresh failed:",
        message
      );
      setSyncMessage(
        `Sync failed: ${message}`
      );
    } finally {
      if (refreshTimeout) {
        window.clearTimeout(
          refreshTimeout
        );
      }

      if (
        isMountedRef.current &&
        requestId ===
          habitRefreshRequestId.current
      ) {
        setIsSyncing(false);
      }
    }
  }, [supabase, todayKey]);

  const scheduleHabitRefresh = useCallback(
    (delay = 350) => {
      if (habitRefreshTimer.current) {
        window.clearTimeout(
          habitRefreshTimer.current
        );
      }

      habitRefreshTimer.current =
        window.setTimeout(() => {
          habitRefreshTimer.current = null;
          void refreshHabitLogs();
        }, delay);
    },
    [refreshHabitLogs]
  );

  const refreshLiveWeight =
    useCallback(async () => {
      const requestId =
        ++metricRefreshRequestIds
          .current.weight;

      const { data, error } =
        await supabase
          .from("weight_logs")
          .select("weight, unit")
          .order("date", {
            ascending: false,
          })
          .limit(1)
          .maybeSingle();

      if (
        !isMountedRef.current ||
        requestId !==
          metricRefreshRequestIds
            .current.weight
      ) {
        return;
      }

      if (error) {
        console.error(
          "Realtime weight refresh failed:",
          error.message
        );
        return;
      }

      setLiveLatestWeight(
        data
          ? Number(data.weight)
          : null
      );

      if (
        data?.unit === "lbs" ||
        data?.unit === "kg"
      ) {
        setLiveWeightUnit(data.unit);
      }
    }, [supabase]);

  const refreshLiveProtein =
    useCallback(async () => {
      const requestId =
        ++metricRefreshRequestIds
          .current.protein;

      const { data, error } =
        await supabase
          .from("protein_logs")
          .select("amount")
          .eq("date", todayKey);

      if (
        !isMountedRef.current ||
        requestId !==
          metricRefreshRequestIds
            .current.protein
      ) {
        return;
      }

      if (error) {
        console.error(
          "Realtime protein refresh failed:",
          error.message
        );
        return;
      }

      const proteinRows = (
        data ?? []
      ) as Array<{
        amount: number | string | null;
      }>;

      const total = proteinRows.reduce(
        (
          sum: number,
          log
        ) =>
          sum + Number(
            log.amount ?? 0
          ),
        0
      );

      setLiveTodayProtein(total);
    }, [supabase, todayKey]);

  const scheduleMetricRefresh =
    useCallback(
      (
        metric:
          | "weight"
          | "protein",
        delay = 200
      ) => {
        const currentTimer =
          metricRefreshTimers.current[
            metric
          ];

        if (currentTimer) {
          window.clearTimeout(
            currentTimer
          );
        }

        metricRefreshTimers.current[
          metric
        ] = window.setTimeout(() => {
          metricRefreshTimers.current[
            metric
          ] = null;

          if (metric === "weight") {
            void refreshLiveWeight();
          } else {
            void refreshLiveProtein();
          }
        }, delay);
      },
      [
        refreshLiveProtein,
        refreshLiveWeight,
      ]
    );

  const handleRealtimeHabitUpsert =
    useCallback(
      (
        row:
          Record<string, unknown>
      ) => {
        if (
          row.date &&
          String(row.date) !==
            todayKey
        ) {
          return;
        }

        const habitId =
          typeof row.habit_id ===
            "string"
            ? row.habit_id
            : String(
                row.habit_id ?? ""
              );

        if (!habitId) {
          return;
        }

        if (
          pendingHabitIdsRef.current.has(
            habitId
          )
        ) {
          return;
        }

        setCompletedMap((current) => ({
          ...current,
          [habitId]: Boolean(
            row.completed
          ),
        }));
        setAnalyticsDirty(true);
      },
      [todayKey]
    );

  const handleRealtimeHabitDelete =
    useCallback(() => {
      scheduleHabitRefresh(150);
      setAnalyticsDirty(true);
    }, [scheduleHabitRefresh]);

  const handleRealtimeWeightChange =
    useCallback(() => {
      scheduleMetricRefresh(
        "weight"
      );
      setAnalyticsDirty(true);
    }, [scheduleMetricRefresh]);

  const handleRealtimeProteinChange =
    useCallback(() => {
      scheduleMetricRefresh(
        "protein"
      );
      setAnalyticsDirty(true);
    }, [scheduleMetricRefresh]);

  const realtimeStatus =
    useDailyResetRealtime({
      supabase,
      date: todayKey,
      onHabitUpsert:
        handleRealtimeHabitUpsert,
      onHabitDelete:
        handleRealtimeHabitDelete,
      onWeightChange:
        handleRealtimeWeightChange,
      onProteinChange:
        handleRealtimeProteinChange,
    });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronize local live metric state when server props change.
    setLiveTodayProtein(todayProtein);
  }, [todayProtein]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronize local live metric state when server props change.
    setLiveLatestWeight(latestWeight);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronize the local display unit when server props change.
    setLiveWeightUnit(weightUnit);
  }, [latestWeight, weightUnit]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      habitRefreshRequestId.current += 1;
      metricRefreshRequestIds.current
        .weight += 1;
      metricRefreshRequestIds.current
        .protein += 1;

      for (
        const metric of [
          "weight",
          "protein",
        ] as const
      ) {
        const timer =
          metricRefreshTimers.current[
            metric
          ];

        if (timer) {
          window.clearTimeout(timer);
          metricRefreshTimers.current[
            metric
          ] = null;
        }
      }
    };
  }, []);

  useEffect(() => {
    const updateConnectionState = () => {
      const online = navigator.onLine;
      setIsOnline(online);

      if (online) {
        setSaveError((current) =>
          current ===
          "You are offline. Reconnect before saving habits."
            ? null
            : current
        );
        dispatchDailyResetDataChanged({
          scopes: ["habits"],
          source: "reconnect",
          date: todayKey,
        });
      }
    };

    updateConnectionState();

    window.addEventListener(
      "online",
      updateConnectionState
    );
    window.addEventListener(
      "offline",
      updateConnectionState
    );

    return () => {
      window.removeEventListener(
        "online",
        updateConnectionState
      );
      window.removeEventListener(
        "offline",
        updateConnectionState
      );
    };
  }, [todayKey]);

  useEffect(() => {
    const handleFocus = () => {
      scheduleHabitRefresh(0);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        scheduleHabitRefresh(0);
      }
    };

    const handleDataChanged = (
      event: Event
    ) => {
      const detail =
        (
          event as CustomEvent<
            DailyResetDataChangedDetail
          >
        ).detail;

      if (
        !detail ||
        !Array.isArray(detail.scopes)
      ) {
        return;
      }

      const isToday =
        !detail.date ||
        detail.date === getTodayKey(timeZone);
      const refreshesHabits =
        detail.scopes.includes("habits");
      const refreshesAnalytics =
        detail.scopes.includes("analytics");

      if (
        isToday &&
        detail.habitId &&
        refreshesHabits
      ) {
        const completed =
          detail.completed ?? true;

        setCompletedMap((current) => ({
          ...current,
          [detail.habitId as string]:
            completed,
        }));

        if (detail.habitName) {
          setSaveError(null);
          setFailedHabit(null);
          showSaveSuccess(
            `${detail.habitName} ${
              completed
                ? "synced"
                : "unchecked"
            }.`
          );
        }
      }

      if (isToday && refreshesHabits) {
        scheduleHabitRefresh();
      }

      if (detail.metrics) {
        if (
          typeof detail.metrics.todayProtein ===
          "number"
        ) {
          setLiveTodayProtein(
            detail.metrics.todayProtein
          );
        }

        if (
          "latestWeight" in detail.metrics
        ) {
          setLiveLatestWeight(
            detail.metrics.latestWeight ?? null
          );
        }

        if (detail.metrics.weightUnit) {
          setLiveWeightUnit(
            detail.metrics.weightUnit
          );
        }
      }

      if (refreshesAnalytics) {
        setAnalyticsDirty(true);
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener(
      DAILY_RESET_DATA_CHANGED_EVENT,
      handleDataChanged
    );

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener(
        DAILY_RESET_DATA_CHANGED_EVENT,
        handleDataChanged
      );

      if (saveSuccessTimer.current) {
        window.clearTimeout(
          saveSuccessTimer.current
        );
        saveSuccessTimer.current = null;
      }

      if (habitRefreshTimer.current) {
        window.clearTimeout(
          habitRefreshTimer.current
        );
        habitRefreshTimer.current = null;
      }
    };
  }, [
    scheduleHabitRefresh,
    showSaveSuccess,
    timeZone,
  ]);

  const sortedHabits = useMemo(
    () =>
      [...habits].sort(
        (a, b) => a.sort_order - b.sort_order
      ),
    [habits]
  );

  const grouped = useMemo(() => {
    return sortedHabits.reduce<
      Record<RoutineType, Habit[]>
    >(
      (accumulator, habit) => {
        accumulator[habit.routine_type].push(habit);
        return accumulator;
      },
      {
        morning: [],
        daily: [],
        night: [],
        trust_based: [],
      }
    );
  }, [sortedHabits]);

  const completedProtocolCount = useMemo(
    () =>
      habits.filter(
        (habit) => completedMap[habit.id]
      ).length,
    [completedMap, habits]
  );

  const progress = useMemo(() => {
    function calculateRoutine(type: RoutineType) {
      const list = grouped[type];

      if (list.length === 0) {
        return 0;
      }

      const complete = list.filter(
        (habit) => completedMap[habit.id]
      ).length;

      return Math.round(
        (complete / list.length) * 100
      );
    }

    const morning = calculateRoutine("morning");
    const daily = calculateRoutine("daily");
    const night = calculateRoutine("night");
    const trust =
      calculateRoutine("trust_based");

    const resetScore = Math.round(
      morning * 0.35 +
        daily * 0.25 +
        night * 0.25 +
        trust * 0.15
    );

    return {
      morning,
      daily,
      night,
      trust,
      resetScore,
    };
  }, [completedMap, grouped]);

  async function toggleHabit(habit: Habit) {
    if (isLocked) {
      setSaveError(
        "Today is locked. Unlock the reset before editing protocols."
      );
      return;
    }

    if (
      pendingHabitIdsRef.current.has(
        habit.id
      )
    ) {
      return;
    }

    const previousCompleted =
      Boolean(completedMap[habit.id]);
    const nextCompleted =
      !previousCompleted;

    pendingHabitIdsRef.current.add(
      habit.id
    );

    setSaveError(null);
    setSaveSuccess(null);
    setFailedHabit(null);
    setLockError(null);
    setPendingHabitIds((current) => {
      const next = new Set(current);
      next.add(habit.id);
      return next;
    });

    setCompletedMap((current) => ({
      ...current,
      [habit.id]: nextCompleted,
    }));

    try {
      const { error } = await supabase.rpc(
        "toggle_habit_and_save_reset_v2",
        {
          target_habit_id: habit.id,
          target_date: todayKey,
          target_completed: nextCompleted,
        }
      );

      if (error) {
        throw error;
      }

      setHasResetRecord(true);
      setFailedHabit(null);
      dispatchDailyResetDataChanged({
        scopes: ["habits", "analytics"],
        source: "manual-habit",
        habitId: habit.id,
        habitName: habit.name,
        completed: nextCompleted,
        date: todayKey,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Habit update failed.";

      console.error(
        "Habit and reset update failed:",
        message
      );

      setCompletedMap((current) => ({
        ...current,
        [habit.id]:
          previousCompleted,
      }));

      setSaveSuccess(null);
      setSaveError(message);
      setFailedHabit(habit);
    } finally {
      pendingHabitIdsRef.current.delete(
        habit.id
      );
      setPendingHabitIds((current) => {
        const next = new Set(current);
        next.delete(habit.id);
        return next;
      });
    }
  }

  async function toggleDayLock() {
    if (isLockPending) {
      return;
    }

    const nextLocked = !isLocked;

    if (nextLocked && !hasResetRecord) {
      setLockError(
        "Complete at least one protocol before locking today."
      );
      return;
    }

    setLockError(null);
    setSaveError(null);
    setIsLockPending(true);

    try {
      const { data: rawData, error } =
        await supabase
          .rpc("set_daily_reset_lock", {
            target_date: todayKey,
            target_locked: nextLocked,
          })
          .single();

      if (error) {
        throw error;
      }

      if (!rawData) {
        throw new Error(
          "Lock status changed, but no updated record was returned."
        );
      }

      const data =
        rawData as unknown as ResetLockRow;

      setIsLocked(
        Boolean(data.lock_state)
      );
      setLockedAt(data.lock_timestamp);
      setHasResetRecord(true);
      showSaveSuccess(
        data.lock_state
          ? "Today locked."
          : "Today unlocked."
      );
      setAnalyticsDirty(true);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Daily reset lock update failed.";

      console.error(
        "Daily reset lock update failed:",
        message
      );
      setLockError(message);
    } finally {
      if (isMountedRef.current) {
        setIsLockPending(false);
      }
    }
  }

  const systemStatus = useMemo<{
    tone: SystemStatusTone;
    message: string;
  }>(() => {
    if (saveError) {
      return {
        tone: "error",
        message: `Sync failed: ${saveError}`,
      };
    }

    if (syncMessage) {
      return {
        tone: "error",
        message: syncMessage,
      };
    }

    if (!isOnline) {
      return {
        tone: "warning",
        message:
          "Browser reports offline. Changes will be attempted, but syncing may fail.",
      };
    }

    if (pendingHabitIds.size > 0) {
      return {
        tone: "saving",
        message: `Saving ${
          pendingHabitIds.size
        } habit signal${
          pendingHabitIds.size === 1
            ? ""
            : "s"
        }...`,
      };
    }

    if (isLockPending) {
      return {
        tone: "saving",
        message: "Updating day lock...",
      };
    }

    if (saveSuccess) {
      return {
        tone: "success",
        message: saveSuccess,
      };
    }

    if (isSyncing) {
      return {
        tone: "saving",
        message: "Refreshing activity data...",
      };
    }

    if (
      realtimeStatus ===
      "connecting"
    ) {
      return {
        tone: "saving",
        message:
          "Connecting cross-device sync...",
      };
    }

    if (
      realtimeStatus ===
      "degraded"
    ) {
      return {
        tone: "warning",
        message:
          "Cross-device sync is unavailable. Local saves and focus refresh remain active.",
      };
    }

    return {
      tone: "ready",
      message: analyticsDirty
        ? "Signals synced. Historical reports can be refreshed below."
        : "All signals synced. Realtime online.",
    };
  }, [
    isLockPending,
    isOnline,
    isSyncing,
    pendingHabitIds.size,
    saveError,
    saveSuccess,
    syncMessage,
    analyticsDirty,
    realtimeStatus,
  ]);

  return (
    <div className="p-3 sm:p-4 md:p-6">
      <BootHeader
        totalProtocols={totalProtocols}
        completedProtocols={
          completedProtocolCount
        }
      />

      <SystemStatus
        tone={systemStatus.tone}
        message={systemStatus.message}
        retryLabel={
          saveError && failedHabit
            ? `retry ${failedHabit.name}`
            : null
        }
        retrying={
          failedHabit
            ? pendingHabitIds.has(
                failedHabit.id
              )
            : false
        }
        onRetry={
          failedHabit
            ? () =>
                void toggleHabit(
                  failedHabit
                )
            : undefined
        }
      />

      <CommandCenter
        resetScore={progress.resetScore}
        currentStreak={currentStreak}
        morningProgress={progress.morning}
        nightProgress={progress.night}
        todayProtein={liveTodayProtein}
        proteinTarget={proteinTarget}
        latestWeight={liveLatestWeight}
        weightUnit={liveWeightUnit}
        activeGoalCount={activeGoalCount}
      />

      <div className="mt-5 grid gap-3 sm:mt-6 sm:gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <TerminalBlock title="body.data">
            <TerminalRow
              label="WEIGHT LOG"
              value="ACTIVE BELOW"
              green
            />
            <TerminalRow
              label="BODY TREND"
              value="TRACKING ENABLED"
            />
            <TerminalRow
              label="PROTEIN"
              value="ACTIVE BELOW"
              green
            />
            <TerminalRow
              label="ORAL CARE"
              value={`${getOralCareProgress(
                habits,
                completedMap
              )}%`}
              green
            />
          </TerminalBlock>

          <TerminalBlock title="today.protocols">
            <ProtocolLine
              name="Morning Reset"
              status={
                progress.morning === 100
                  ? "COMPLETE"
                  : "PENDING"
              }
              progress={progress.morning}
            />
            <ProtocolLine
              name="Daily Protocols"
              status={
                progress.daily === 100
                  ? "COMPLETE"
                  : "PENDING"
              }
              progress={progress.daily}
            />
            <ProtocolLine
              name="Shutdown Protocol"
              status={
                progress.night === 100
                  ? "COMPLETE"
                  : "PENDING"
              }
              progress={progress.night}
            />
            <ProtocolLine
              name="Sleep Boundary"
              status={
                progress.trust === 100
                  ? "COMPLETE"
                  : "STANDBY"
              }
              progress={progress.trust}
            />
          </TerminalBlock>

        </div>

        <div className="space-y-4">
          <TerminalBlock title="quick.actions">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <JumpButton
              label="run morning_reset.exe"
              targetId="morning"
            />
            <JumpButton
              label="run daily_protocols.exe"
              targetId="daily"
            />
            <JumpButton
              label="run shutdown_protocol.exe"
              targetId="night"
            />
            <JumpButton
              label="log body_data"
              targetId="body-data"
            />
            <JumpButton
              label="open nutrition_input"
              targetId="nutrition-input"
            />
            <JumpButton
              label="open dream_archive"
              targetId="dream-archive"
            />
            <JumpButton
              label="open goals_milestones"
              targetId="goals-milestones"
            />
            <JumpButton
              label="open reprogram_journal"
              targetId="reprogram-journal"
            />
            <JumpButton
              label="open shadow_console"
              targetId="shadow-console"
            />
            <JumpButton
              label="open ai_reflection"
              targetId="ai-reflection"
            />
              <JumpButton
                label="confirm sleep_boundary"
                targetId="trust_based"
              />
            </div>
          </TerminalBlock>

        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Checklist
          id="morning"
          title={routineLabels.morning}
          displayTitle={routineTitles.morning}
          items={grouped.morning}
          completedMap={completedMap}
          pendingHabitIds={pendingHabitIds}
          onToggle={toggleHabit}
          locked={isLocked}
        />

        <Checklist
          id="daily"
          title={routineLabels.daily}
          displayTitle={routineTitles.daily}
          items={grouped.daily}
          completedMap={completedMap}
          pendingHabitIds={pendingHabitIds}
          onToggle={toggleHabit}
          locked={isLocked}
        />

        <Checklist
          id="night"
          title={routineLabels.night}
          displayTitle={routineTitles.night}
          items={grouped.night}
          completedMap={completedMap}
          pendingHabitIds={pendingHabitIds}
          onToggle={toggleHabit}
          locked={isLocked}
        />

        <Checklist
          id="trust_based"
          title={routineLabels.trust_based}
          displayTitle={routineTitles.trust_based}
          items={grouped.trust_based}
          completedMap={completedMap}
          pendingHabitIds={pendingHabitIds}
          onToggle={toggleHabit}
          locked={isLocked}
        />
      </div>

      {children ? (
        <div className="mt-4">
          {children}
        </div>
      ) : null}

      <div className="mt-4">
        <TerminalBlock title="day.lock">
          <div className="grid gap-2 sm:grid-cols-2">
            <TerminalRow
              label="TODAY"
              value={isLocked ? "FINALIZED" : "EDITABLE"}
              green={isLocked}
            />

            <TerminalRow
              label="SNAPSHOT"
              value={
                hasResetRecord
                  ? `${progress.resetScore}% SAVED`
                  : "NO SNAPSHOT"
              }
              green={hasResetRecord}
            />
          </div>

          {lockedAt ? (
            <p
              id="day-lock-help"
              className="terminal-muted mt-3 text-xs leading-6"
            >
              &gt; Locked{" "}
              {formatLockTimestamp(
                lockedAt,
                timeZone
              )}.
            </p>
          ) : (
            <p
              id="day-lock-help"
              className="terminal-muted mt-3 text-xs leading-6"
            >
              &gt; Lock today after the final protocol update.
              Unlocking restores checklist editing.
            </p>
          )}

          <button
            type="button"
            onClick={toggleDayLock}
            aria-busy={isLockPending}
            aria-describedby="day-lock-help"
            disabled={
              pendingHabitIds.size > 0 ||
              isLockPending ||
              (!hasResetRecord && !isLocked)
            }
            className={
              isLocked
                ? "mt-3 min-h-[48px] w-full border border-[#ffb020] bg-[#080808] px-3 py-3 text-left text-xs text-[#ffb020] transition hover:bg-[#0d0d0d] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#39ff88] focus-visible:ring-inset disabled:cursor-default disabled:opacity-50"
                : "mt-3 min-h-[48px] w-full border border-[#39ff88] bg-[#080808] px-3 py-3 text-left text-xs text-[#39ff88] transition hover:bg-[#0d0d0d] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#39ff88] focus-visible:ring-inset disabled:cursor-default disabled:opacity-50"
            }
          >
            &gt;{" "}
            {isLockPending
              ? "updating_day_lock..."
              : isLocked
                ? "unlock_today"
                : "lock_today"}
          </button>

          {lockError ? (
            <p className="mt-3 text-xs text-[#ff4d4d]">
              &gt; {lockError}
            </p>
          ) : null}
        </TerminalBlock>
      </div>

      <footer className="terminal-muted mt-6 border-t border-[#242424] pt-4 text-[11px] leading-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p>&gt; habit_engine: online</p>
          <p>
            &gt; realtime:{" "}
            {realtimeStatus.toUpperCase()}
          </p>

          {analyticsDirty ? (
            <button
              type="button"
              onClick={() =>
                window.location.reload()
              }
              className="min-h-[36px] border border-[#5a4218] px-3 text-left text-[#ffb020] transition hover:border-[#ffb020] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#ffb020] focus-visible:ring-inset"
            >
              refresh historical reports
            </button>
          ) : (
            <p>&gt; reports: current</p>
          )}

          <p className="break-all">
            &gt; session: {userEmail}
          </p>
        </div>
      </footer>
    </div>
  );
}

function SystemStatus({
  tone,
  message,
  retryLabel,
  retrying,
  onRetry,
}: {
  tone: SystemStatusTone;
  message: string;
  retryLabel: string | null;
  retrying: boolean;
  onRetry?: () => void;
}) {
  const toneClass: Record<
    SystemStatusTone,
    string
  > = {
    ready:
      "border-[#242424] bg-[#050505] text-[#a3a3a3]",
    saving:
      "border-[#5a4218] bg-[#120d04] text-[#ffb020]",
    success:
      "border-[#1f4b32] bg-[#041008] text-[#39ff88]",
    warning:
      "border-[#5a4218] bg-[#120d04] text-[#ffb020]",
    error:
      "border-[#5a1f1f] bg-[#120404] text-[#ff6b6b]",
  };

  const isAlert =
    tone === "error" ||
    tone === "warning";

  return (
    <div
      role={isAlert ? "alert" : "status"}
      aria-live={
        isAlert ? "assertive" : "polite"
      }
      className={`mt-3 flex min-h-[44px] flex-col justify-center gap-2 border px-3 py-2 text-[11px] sm:flex-row sm:items-center sm:justify-between ${toneClass[tone]}`}
    >
      <p className="min-w-0 break-words">
        &gt; {message}
      </p>

      {retryLabel && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="min-h-[34px] shrink-0 border border-current px-3 text-left transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-current focus-visible:ring-inset disabled:cursor-default disabled:opacity-50"
        >
          {retrying
            ? "retrying..."
            : retryLabel}
        </button>
      ) : null}
    </div>
  );
}

function CommandCenter({
  resetScore,
  currentStreak,
  morningProgress,
  nightProgress,
  todayProtein,
  proteinTarget,
  latestWeight,
  weightUnit,
  activeGoalCount,
}: {
  resetScore: number;
  currentStreak: number;
  morningProgress: number;
  nightProgress: number;
  todayProtein: number;
  proteinTarget: number;
  latestWeight: number | null;
  weightUnit: "lbs" | "kg";
  activeGoalCount: number;
}) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? "GOOD MORNING"
      : hour < 18
        ? "GOOD AFTERNOON"
        : "GOOD EVENING";

  return (
    <section className="mt-5 border border-[#39ff88] bg-black sm:mt-6">
      <div className="border-b border-[#242424] bg-[#050505] px-3 py-3">
        <p className="terminal-green text-xs uppercase tracking-[0.22em]">
          &gt; command.center
        </p>
        <p className="mt-2 text-lg text-[#e5e5e5]">
          {greeting}
        </p>
      </div>

      <div className="grid gap-px bg-[#242424] sm:grid-cols-2 xl:grid-cols-4">
        <CommandSignal
          label="TODAY RESET"
          value={`${resetScore}%`}
          progress={resetScore}
        />
        <CommandSignal
          label="CURRENT STREAK"
          value={`${currentStreak} DAYS`}
        />
        <CommandSignal
          label="PROTEIN"
          value={`${todayProtein} / ${proteinTarget}g`}
          progress={
            proteinTarget > 0
              ? Math.min(
                  100,
                  Math.round(
                    (todayProtein /
                      proteinTarget) *
                      100
                  )
                )
              : 0
          }
        />
        <CommandSignal
          label="LATEST WEIGHT"
          value={
            latestWeight === null
              ? "NO DATA"
              : `${latestWeight} ${weightUnit}`
          }
        />
        <CommandSignal
          label="MORNING"
          value={`${morningProgress}%`}
          progress={morningProgress}
        />
        <CommandSignal
          label="NIGHT"
          value={`${nightProgress}%`}
          progress={nightProgress}
        />
        <CommandSignal
          label="ACTIVE GOALS"
          value={String(activeGoalCount)}
        />
        <CommandSignal
          label="SYSTEM"
          value={
            resetScore >= 80
              ? "FULL RESET"
              : resetScore >= 50
                ? "SOLID DAY"
                : "REPROGRAMMING"
          }
        />
      </div>
    </section>
  );
}

function CommandSignal({
  label,
  value,
  progress,
}: {
  label: string;
  value: string;
  progress?: number;
}) {
  return (
    <div className="bg-black p-3">
      <p className="terminal-muted text-[10px] uppercase tracking-[0.16em]">
        {label}
      </p>
      <p className="terminal-green mt-2 text-lg tabular-nums">
        {value}
      </p>

      {typeof progress === "number" ? (
        <div
          className="mt-2 h-1 overflow-hidden bg-[#121212]"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.max(
            0,
            Math.min(100, progress)
          )}
        >
          <div
            className="h-full bg-[#39ff88]"
            style={{
              width: `${Math.max(
                0,
                Math.min(100, progress)
              )}%`,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function BootHeader({
  totalProtocols,
  completedProtocols,
}: {
  totalProtocols: number;
  completedProtocols: number;
}) {
  return (
    <div>
      <p className="terminal-muted text-xs uppercase tracking-[0.35em]">
        Daily Reset
      </p>

      <div className="mt-4 border border-[#242424] bg-[#050505] px-3 py-4 sm:hidden">
        <p className="terminal-green text-2xl font-bold tracking-[0.12em]">
          &gt;_ DAILY RESET
        </p>
        <p className="terminal-muted mt-2 text-[10px] uppercase tracking-[0.18em]">
          the reprogram
        </p>
      </div>

      <div className="terminal-green mt-4 hidden overflow-x-auto whitespace-pre text-[10px] leading-[1.15] sm:block md:text-sm">
        {`
██████╗  █████╗ ██╗██╗  ██╗   ██╗    ██████╗ ███████╗███████╗███████╗████████╗
██╔══██╗██╔══██╗██║██║  ╚██╗ ██╔╝    ██╔══██╗██╔════╝██╔════╝██╔════╝╚══██╔══╝
██║  ██║███████║██║██║   ╚████╔╝     ██████╔╝█████╗  ███████╗█████╗     ██║
██║  ██║██╔══██║██║██║    ╚██╔╝      ██╔══██╗██╔══╝  ╚════██║██╔══╝     ██║
██████╔╝██║  ██║██║███████╗██║       ██║  ██║███████╗███████║███████╗   ██║
╚═════╝ ╚═╝  ╚═╝╚═╝╚══════╝╚═╝       ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝   ╚═╝`}
      </div>

      <p className="terminal-muted mt-2">
        THE_REPROGRAM initialized. Identity reconstruction
        module online.
      </p>

      <div className="mt-4">
        <ResetScorePanel
          totalProtocols={totalProtocols}
          completedProtocols={completedProtocols}
        />
      </div>
    </div>
  );
}

function JumpButton({
  label,
  targetId,
}: {
  label: string;
  targetId: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        document
          .getElementById(targetId)
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      }}
      className="block min-h-[46px] w-full border border-[#242424] bg-[#080808] px-3 py-3 text-left text-xs text-[#39ff88] transition hover:border-[#39ff88] hover:bg-[#0d0d0d] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#39ff88] focus-visible:ring-inset"
    >
      &gt; {label}
    </button>
  );
}

function Checklist({
  id,
  title,
  displayTitle,
  items,
  completedMap,
  pendingHabitIds,
  onToggle,
  locked,
}: {
  id: string;
  title: string;
  displayTitle: string;
  items: Habit[];
  completedMap: Record<string, boolean>;
  pendingHabitIds: Set<string>;
  onToggle: (habit: Habit) => void;
  locked: boolean;
}) {
  const completedCount = items.reduce(
    (
      count: number,
      item: Habit
    ) =>
      count +
      (completedMap[item.id] ? 1 : 0),
    0
  );

  const groupedByCategory = items.reduce<
    Record<string, Habit[]>
  >((accumulator, item) => {
    if (!accumulator[item.category]) {
      accumulator[item.category] = [];
    }

    accumulator[item.category].push(item);
    return accumulator;
  }, {});

  return (
    <section
      id={id}
      className="scroll-mt-4 border border-[#242424] bg-[#050505]"
      aria-labelledby={`${id}-title`}
    >
      <div className="border-b border-[#242424] bg-[#0d0d0d] px-3 py-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p
              id={`${id}-title`}
              className="terminal-green text-xs uppercase tracking-[0.2em]"
            >
              &gt; {title}
            </p>
            <p className="terminal-muted mt-1 text-xs">
              {displayTitle}
            </p>
          </div>

          <span
            className="shrink-0 border border-[#242424] px-2 py-1 text-[10px] tabular-nums text-[#a3a3a3]"
            aria-label={`${completedCount} of ${items.length} complete`}
          >
            {completedCount}/{items.length}
          </span>
        </div>
      </div>

      <div className="max-h-none overflow-y-visible p-3 sm:max-h-[520px] sm:overflow-y-auto">
        {Object.entries(groupedByCategory).map(
          ([category, categoryItems]) => (
            <div
              key={category}
              className="mb-4 last:mb-0"
            >
              <p className="terminal-muted mb-2 text-[11px] uppercase tracking-[0.18em]">
                {category}
              </p>

              {categoryItems.map((item, index) => {
                const completed = Boolean(
                  completedMap[item.id]
                );
                const isSaving =
                  pendingHabitIds.has(item.id);

                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => onToggle(item)}
                    disabled={locked || isSaving}
                    aria-busy={isSaving}
                    aria-pressed={completed}
                    aria-label={`${
                      completed
                        ? "Mark incomplete"
                        : "Mark complete"
                    }: ${item.name}`}
                    title={
                      locked
                        ? "Unlock today to edit this protocol."
                        : undefined
                    }
                    className="terminal-line grid min-h-[52px] w-full grid-cols-[28px_34px_1fr] items-center gap-2 py-2.5 text-left text-xs transition hover:text-[#39ff88] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#39ff88] focus-visible:ring-inset disabled:cursor-default disabled:opacity-55 disabled:hover:text-inherit sm:grid-cols-[32px_36px_1fr]"
                  >
                    <span className="terminal-dim leading-6">
                      {String(index + 1).padStart(
                        2,
                        "0"
                      )}
                    </span>

                    <span className="terminal-green whitespace-nowrap leading-6">
                      {isSaving
                        ? "[…]"
                        : completed
                          ? "[✓]"
                          : "[ ]"}
                    </span>

                    <span
                      className={
                        completed
                          ? "break-words leading-6 text-[#7a7a7a] line-through"
                          : "break-words leading-6 text-[#e5e5e5]"
                      }
                    >
                      {item.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )
        )}

        {items.length === 0 ? (
          <p className="terminal-muted text-xs">
            &gt; No protocols found.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function TerminalBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-[#242424] bg-[#050505]">
      <div className="border-b border-[#242424] bg-[#0d0d0d] px-3 py-2">
        <p className="terminal-green text-xs uppercase tracking-[0.2em]">
          &gt; {title}
        </p>
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function TerminalRow({
  label,
  value,
  green = false,
}: {
  label: string;
  value: string;
  green?: boolean;
}) {
  return (
    <div className="terminal-line flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
      <span className="terminal-muted text-xs">
        {label}
      </span>
      <span
        className={
          green
            ? "terminal-green text-right text-xs"
            : "text-right text-xs text-[#e5e5e5]"
        }
      >
        {value}
      </span>
    </div>
  );
}

function ProtocolLine({
  name,
  status,
  progress,
}: {
  name: string;
  status: "PENDING" | "STANDBY" | "COMPLETE";
  progress: number;
}) {
  return (
    <div className="terminal-line py-2">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span>
          [{status === "COMPLETE" ? "✓" : " "}]{" "}
          {name}
        </span>
        <span className="terminal-muted text-xs">
          {status} / {progress}%
        </span>
      </div>

      <div
        className="h-1 overflow-hidden bg-[#121212]"
        role="progressbar"
        aria-label={`${name} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <div
          className="h-full bg-[#39ff88] transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function getOralCareProgress(
  habits: Habit[],
  completedMap: Record<string, boolean>
) {
  const oralHabits = habits.filter(
    (habit) => habit.category === "Oral Care"
  );

  if (oralHabits.length === 0) {
    return 0;
  }

  const complete = oralHabits.filter(
    (habit) => completedMap[habit.id]
  ).length;

  return Math.round(
    (complete / oralHabits.length) * 100
  );
}

function getTodayKey(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}


function formatLockTimestamp(
  value: string,
  timeZone: string
) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}