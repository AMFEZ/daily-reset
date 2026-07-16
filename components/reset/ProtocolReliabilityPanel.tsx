import {
  ProtocolReliabilityInspector,
  type ProtocolReliabilityRecord,
} from "@/components/reset/ProtocolReliabilityInspector";
import { createClient } from "@/utils/supabase/server";

type RoutineType =
  | "morning"
  | "daily"
  | "night"
  | "trust_based";

type HabitRow = {
  id: string;
  name: string;
  category: string;
  routine_type: RoutineType;
  sort_order: number;
};

type HabitLogRow = {
  habit_id: string;
  date: string;
  completed: boolean;
};

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const APP_TIME_ZONE = "America/New_York";

const ROUTINE_ORDER: Record<RoutineType, number> = {
  morning: 0,
  daily: 1,
  night: 2,
  trust_based: 3,
};

export async function ProtocolReliabilityPanel() {
  const supabase = await createClient();

  const todayKey = getDateKeyInTimeZone(
    new Date(),
    APP_TIME_ZONE
  );
  const todayDayNumber = dateKeyToDayNumber(todayKey);

  // Closed days only: yesterday through 29 days before yesterday.
  const lastClosedDayNumber = todayDayNumber - 1;
  const firstDayNumber = lastClosedDayNumber - 29;
  const firstDateKey = dayNumberToDateKey(firstDayNumber);
  const lastDateKey = dayNumberToDateKey(
    lastClosedDayNumber
  );

  const [
    { data: habitsData, error: habitsError },
    { data: logsData, error: logsError },
  ] = await Promise.all([
    supabase
      .from("habits")
      .select(
        "id, name, category, routine_type, sort_order"
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("habit_logs")
      .select("habit_id, date, completed")
      .gte("date", firstDateKey)
      .lte("date", lastDateKey),
  ]);

  if (habitsError || logsError) {
    return (
      <section className="border border-[#242424] bg-[#050505]">
        <div className="border-b border-[#242424] bg-[#0d0d0d] px-3 py-2">
          <p className="terminal-green text-xs uppercase tracking-[0.2em]">
            &gt; protocol.reliability
          </p>
        </div>

        <div className="p-3">
          <p className="text-xs leading-6 text-[#ffb020]">
            &gt; Reliability analysis unavailable:{" "}
            {habitsError?.message ??
              logsError?.message ??
              "Unknown query error."}
          </p>
        </div>
      </section>
    );
  }

  const habits = (habitsData ?? []) as HabitRow[];
  const logs = (logsData ?? []) as HabitLogRow[];

  const completedDatesByHabit = new Map<
    string,
    Set<string>
  >();

  for (const log of logs) {
    if (!log.completed) {
      continue;
    }

    if (!completedDatesByHabit.has(log.habit_id)) {
      completedDatesByHabit.set(
        log.habit_id,
        new Set<string>()
      );
    }

    completedDatesByHabit
      .get(log.habit_id)
      ?.add(log.date);
  }

  const thirtyDayDates = createDateRange(
    firstDayNumber,
    30
  );
  const recentSevenDates = createDateRange(
    lastClosedDayNumber - 6,
    7
  );
  const previousSevenDates = createDateRange(
    lastClosedDayNumber - 13,
    7
  );

  const protocols: ProtocolReliabilityRecord[] =
    habits
      .filter((habit) =>
        isRoutineType(habit.routine_type)
      )
      .map((habit) => {
        const completedDates =
          completedDatesByHabit.get(habit.id) ??
          new Set<string>();

        const completionHistory =
          thirtyDayDates.map((date) => ({
            date,
            completed: completedDates.has(date),
          }));

        const completed30 = countCompletedDates(
          completedDates,
          thirtyDayDates
        );
        const completed7 = countCompletedDates(
          completedDates,
          recentSevenDates
        );
        const previousCompleted7 =
          countCompletedDates(
            completedDates,
            previousSevenDates
          );

        const rate30 = percentage(completed30, 30);
        const rate7 = percentage(completed7, 7);
        const previousRate7 = percentage(
          previousCompleted7,
          7
        );

        return {
          id: habit.id,
          name: habit.name,
          category: habit.category,
          routineType: habit.routine_type,
          sortOrder: habit.sort_order,
          completed30,
          rate30,
          rate7,
          previousRate7,
          trend: rate7 - previousRate7,
          currentStreak: calculateEndingStreak(
            completedDates,
            lastClosedDayNumber,
            firstDayNumber
          ),
          longestStreak: calculateLongestStreak(
            completedDates,
            thirtyDayDates
          ),
          status: getReliabilityStatus(rate30),
          completionHistory,
        };
      })
      .sort((a, b) => {
        const routineDifference =
          ROUTINE_ORDER[a.routineType] -
          ROUTINE_ORDER[b.routineType];

        if (routineDifference !== 0) {
          return routineDifference;
        }

        return a.sortOrder - b.sortOrder;
      });

  return (
    <ProtocolReliabilityInspector
      protocols={protocols}
      firstDateKey={firstDateKey}
      lastDateKey={lastDateKey}
    />
  );
}

function countCompletedDates(
  completedDates: Set<string>,
  dates: string[]
) {
  return dates.reduce(
    (count, date) =>
      count + (completedDates.has(date) ? 1 : 0),
    0
  );
}

function calculateEndingStreak(
  completedDates: Set<string>,
  lastDayNumber: number,
  firstDayNumber: number
) {
  let streak = 0;

  for (
    let dayNumber = lastDayNumber;
    dayNumber >= firstDayNumber;
    dayNumber -= 1
  ) {
    if (
      !completedDates.has(
        dayNumberToDateKey(dayNumber)
      )
    ) {
      break;
    }

    streak += 1;
  }

  return streak;
}

function calculateLongestStreak(
  completedDates: Set<string>,
  dates: string[]
) {
  let longest = 0;
  let current = 0;

  for (const date of dates) {
    if (completedDates.has(date)) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }

  return longest;
}

function getReliabilityStatus(
  rate: number
):
  | "LOCKED IN"
  | "RELIABLE"
  | "INCONSISTENT"
  | "REBUILD" {
  if (rate >= 85) {
    return "LOCKED IN";
  }

  if (rate >= 70) {
    return "RELIABLE";
  }

  if (rate >= 40) {
    return "INCONSISTENT";
  }

  return "REBUILD";
}

function percentage(
  completed: number,
  total: number
) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((completed / total) * 100);
}

function createDateRange(
  firstDayNumber: number,
  length: number
) {
  return Array.from(
    { length },
    (_, index) =>
      dayNumberToDateKey(firstDayNumber + index)
  );
}

function isRoutineType(
  value: string
): value is RoutineType {
  return (
    value === "morning" ||
    value === "daily" ||
    value === "night" ||
    value === "trust_based"
  );
}

function getDateKeyInTimeZone(
  date: Date,
  timeZone: string
) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function dateKeyToDayNumber(dateKey: string) {
  const [year, month, day] = dateKey
    .split("-")
    .map(Number);

  return Math.floor(
    Date.UTC(year, month - 1, day) /
      DAY_IN_MILLISECONDS
  );
}

function dayNumberToDateKey(dayNumber: number) {
  return new Date(
    dayNumber * DAY_IN_MILLISECONDS
  )
    .toISOString()
    .slice(0, 10);
}