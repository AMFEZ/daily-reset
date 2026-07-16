"use client";

import { ResetScorePanel } from "@/components/reset/ResetScorePanel";
import { useMemo, useState, useTransition } from "react";
import { createClient } from "@/utils/supabase/client";

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

type ResetDashboardProps = {
  userEmail: string;
  habits: Habit[];
  logs: HabitLog[];
  totalProtocols: number;
  initialHasResetRecord: boolean;
  initialIsLocked: boolean;
  initialLockedAt: string | null;
  timeZone: string;
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
  children,
}: ResetDashboardProps) {
  const supabase = createClient();
  const [isPending, startTransition] =
    useTransition();
  const [isLockPending, startLockTransition] =
    useTransition();
  const [saveError, setSaveError] =
    useState<string | null>(null);
  const [lockError, setLockError] =
    useState<string | null>(null);
  const [hasResetRecord, setHasResetRecord] =
    useState(initialHasResetRecord);
  const [isLocked, setIsLocked] =
    useState(initialIsLocked);
  const [lockedAt, setLockedAt] =
    useState<string | null>(initialLockedAt);

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

  function toggleHabit(habit: Habit) {
    if (isLocked) {
      setSaveError(
        "Today is locked. Unlock the reset before editing protocols."
      );
      return;
    }

    const nextCompleted =
      !completedMap[habit.id];

    setSaveError(null);
    setLockError(null);

    setCompletedMap((current) => ({
      ...current,
      [habit.id]: nextCompleted,
    }));

    startTransition(async () => {
      const { error } = await supabase.rpc(
        "toggle_habit_and_save_reset_v2",
        {
          target_habit_id: habit.id,
          target_date: getTodayKey(timeZone),
          target_completed: nextCompleted,
        }
      );

      if (error) {
        console.error(
          "Habit and reset update failed:",
          error.message
        );

        setCompletedMap((current) => ({
          ...current,
          [habit.id]: !nextCompleted,
        }));

        setSaveError(error.message);
        return;
      }

      setHasResetRecord(true);
    });
  }

  function toggleDayLock() {
    const nextLocked = !isLocked;

    if (nextLocked && !hasResetRecord) {
      setLockError(
        "Complete at least one protocol before locking today."
      );
      return;
    }

    setLockError(null);
    setSaveError(null);

    startLockTransition(async () => {
      const { data: rawData, error } = await supabase
        .rpc("set_daily_reset_lock", {
          target_date: getTodayKey(timeZone),
          target_locked: nextLocked,
        })
        .single();

      if (error) {
        console.error(
          "Daily reset lock update failed:",
          error.message
        );
        setLockError(error.message);
        return;
      }

      if (!rawData) {
        setLockError(
          "Lock status changed, but no updated record was returned."
        );
        return;
      }

      const data =
        rawData as unknown as ResetLockRow;

      setIsLocked(Boolean(data.lock_state));
      setLockedAt(data.lock_timestamp);
      setHasResetRecord(true);
    });
  }

  return (
    <div className="p-3 sm:p-4 md:p-6">
      <BootHeader
        totalProtocols={totalProtocols}
        completedProtocols={
          completedProtocolCount
        }
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
              label="open reflection_log"
              targetId="reflection-log"
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
          </TerminalBlock>

          <TerminalBlock title="reflection.archive">
            <p className="terminal-muted leading-6">
              Capture the signal before the system deletes
              it.
            </p>
            <p className="terminal-green mt-2">
              [ REFLECTION ] [ RECALL ] [ SHADOW ] [ DREAM
              NOTE ]
            </p>
            <p className="terminal-muted mt-3 text-xs">
              &gt; Reflection Log and Dream Archive active
              below.
            </p>
          </TerminalBlock>

        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:gap-4 lg:grid-cols-4">
        <Checklist
          id="morning"
          title={routineLabels.morning}
          displayTitle={routineTitles.morning}
          items={grouped.morning}
          completedMap={completedMap}
          onToggle={toggleHabit}
          locked={isLocked}
        />

        <Checklist
          id="daily"
          title={routineLabels.daily}
          displayTitle={routineTitles.daily}
          items={grouped.daily}
          completedMap={completedMap}
          onToggle={toggleHabit}
          locked={isLocked}
        />

        <Checklist
          id="night"
          title={routineLabels.night}
          displayTitle={routineTitles.night}
          items={grouped.night}
          completedMap={completedMap}
          onToggle={toggleHabit}
          locked={isLocked}
        />

        <Checklist
          id="trust_based"
          title={routineLabels.trust_based}
          displayTitle={routineTitles.trust_based}
          items={grouped.trust_based}
          completedMap={completedMap}
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
            <p className="terminal-muted mt-3 text-xs leading-6">
              &gt; Locked{" "}
              {formatLockTimestamp(
                lockedAt,
                timeZone
              )}.
            </p>
          ) : (
            <p className="terminal-muted mt-3 text-xs leading-6">
              &gt; Lock today after the final protocol update.
              Unlocking restores checklist editing.
            </p>
          )}

          <button
            type="button"
            onClick={toggleDayLock}
            disabled={
              isPending ||
              isLockPending ||
              (!hasResetRecord && !isLocked)
            }
            className={
              isLocked
                ? "mt-3 min-h-[48px] w-full border border-[#ffb020] bg-[#080808] px-3 py-3 text-left text-xs text-[#ffb020] transition hover:bg-[#0d0d0d] disabled:cursor-not-allowed disabled:opacity-50"
                : "mt-3 min-h-[48px] w-full border border-[#39ff88] bg-[#080808] px-3 py-3 text-left text-xs text-[#39ff88] transition hover:bg-[#0d0d0d] disabled:cursor-not-allowed disabled:opacity-50"
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

      <div className="terminal-muted mt-6 border-t border-[#242424] pt-4 text-xs leading-6">
        <p>&gt; Habit engine online.</p>
        <p>
          &gt; Routine score history synced to Supabase.
        </p>
        <p>&gt; User authenticated.</p>
      </div>

      <div className="mt-4">
        <TerminalBlock title="save.status">
          <p
            className={
              saveError
                ? "text-[#ff4d4d]"
                : isPending
                  ? "text-[#ffb020]"
                  : "terminal-green"
            }
          >
            {saveError
              ? `> Sync failed: ${saveError}`
              : isPending
                ? "> Saving habit + routine scores..."
                : "> All signals synced to Supabase."}
          </p>

          <p className="terminal-muted mt-2 break-all text-xs">
            &gt; session: {userEmail}
          </p>
        </TerminalBlock>
      </div>
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
      className="mb-2 block min-h-[46px] w-full border border-[#242424] bg-[#080808] px-3 py-3 text-left text-xs text-[#39ff88] transition hover:border-[#39ff88] hover:bg-[#0d0d0d]"
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
  onToggle,
  locked,
}: {
  id: string;
  title: string;
  displayTitle: string;
  items: Habit[];
  completedMap: Record<string, boolean>;
  onToggle: (habit: Habit) => void;
  locked: boolean;
}) {
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
      className="border border-[#242424] bg-[#050505]"
    >
      <div className="border-b border-[#242424] bg-[#0d0d0d] px-3 py-2">
        <p className="terminal-green text-xs uppercase tracking-[0.2em]">
          &gt; {title}
        </p>
        <p className="terminal-muted mt-1 text-xs">
          {displayTitle}
        </p>
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

                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => onToggle(item)}
                    disabled={locked}
                    className="terminal-line grid min-h-[48px] w-full grid-cols-[28px_34px_1fr] items-center gap-2 py-2 text-left text-xs transition hover:text-[#39ff88] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:text-inherit sm:grid-cols-[32px_36px_1fr]"
                  >
                    <span className="terminal-dim leading-6">
                      {String(index + 1).padStart(
                        2,
                        "0"
                      )}
                    </span>

                    <span className="terminal-green whitespace-nowrap leading-6">
                      {completed ? "[✓]" : "[ ]"}
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
    <div className="terminal-line flex items-center justify-between gap-4 py-2">
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
      <div className="mb-1 flex items-center justify-between gap-4">
        <span>
          [{status === "COMPLETE" ? "✓" : " "}]{" "}
          {name}
        </span>
        <span className="terminal-muted text-xs">
          {status} / {progress}%
        </span>
      </div>

      <div className="h-1 overflow-hidden bg-[#121212]">
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
