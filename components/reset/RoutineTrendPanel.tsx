import { createClient } from "@/utils/supabase/server";

type ResetRoutineRow = {
  date: string;
  morning_score: number | string | null;
  daily_score: number | string | null;
  night_score: number | string | null;
  trust_score: number | string | null;
};

type NormalizedRoutineDay = {
  date: string;
  morningScore: number;
  dailyScore: number;
  nightScore: number;
  trustScore: number;
};

type RoutineKey =
  | "morningScore"
  | "dailyScore"
  | "nightScore"
  | "trustScore";

type RoutineTrend = {
  key: RoutineKey;
  label: string;
  currentAverage: number;
  previousAverage: number;
  delta: number;
  currentValues: number[];
};

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const APP_TIME_ZONE = "America/New_York";

const ROUTINES: Array<{
  key: RoutineKey;
  label: string;
}> = [
  {
    key: "morningScore",
    label: "Morning Reset",
  },
  {
    key: "dailyScore",
    label: "Daily Protocols",
  },
  {
    key: "nightScore",
    label: "Shutdown Protocol",
  },
  {
    key: "trustScore",
    label: "Sleep Boundary",
  },
];

export async function RoutineTrendPanel() {
  const supabase = await createClient();

  const todayKey = getDateKeyInTimeZone(
    new Date(),
    APP_TIME_ZONE
  );
  const todayDayNumber = dateKeyToDayNumber(todayKey);
  const firstDateKey = dayNumberToDateKey(
    todayDayNumber - 29
  );

  const { data, error } = await supabase
    .from("daily_reset_scores")
    .select(`
      date,
      morning_score,
      daily_score,
      night_score,
      trust_score
    `)
    .gte("date", firstDateKey)
    .lte("date", todayKey)
    .order("date", { ascending: true });

  if (error) {
    return (
      <TerminalShell title="routine.trend.analyzer">
        <p className="text-xs leading-6 text-[#ffb020]">
          &gt; Trend analyzer unavailable: {error.message}
        </p>
      </TerminalShell>
    );
  }

  const rows = normalizeRows(
    (data ?? []) as ResetRoutineRow[]
  );
  const rowsByDate = new Map(
    rows.map((row) => [row.date, row])
  );

  const previousDates = createDateRange(
    todayDayNumber - 29,
    15
  );
  const currentDates = createDateRange(
    todayDayNumber - 14,
    15
  );

  const trends = ROUTINES.map(({ key, label }) => {
    const previousValues = previousDates.map(
      (date) => rowsByDate.get(date)?.[key] ?? 0
    );
    const currentValues = currentDates.map(
      (date) => rowsByDate.get(date)?.[key] ?? 0
    );

    const previousAverage =
      calculateAverage(previousValues);
    const currentAverage =
      calculateAverage(currentValues);

    return {
      key,
      label,
      currentAverage,
      previousAverage,
      delta: currentAverage - previousAverage,
      currentValues,
    } satisfies RoutineTrend;
  });

  const strongestRoutine = [...trends].sort(
    (a, b) =>
      b.currentAverage - a.currentAverage
  )[0];

  const rebuildTarget = [...trends].sort(
    (a, b) =>
      a.currentAverage - b.currentAverage
  )[0];

  const improvingRoutine = [...trends].sort(
    (a, b) => b.delta - a.delta
  )[0];

  const currentSavedDays = currentDates.filter(
    (date) => rowsByDate.has(date)
  ).length;

  const previousSavedDays = previousDates.filter(
    (date) => rowsByDate.has(date)
  ).length;

  const currentSystemAverage = calculateAverage(
    trends.map((trend) => trend.currentAverage)
  );

  const previousSystemAverage =
    calculateAverage(
      trends.map((trend) => trend.previousAverage)
    );

  const systemDelta =
    currentSystemAverage - previousSystemAverage;

  return (
    <TerminalShell title="routine.trend.analyzer">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric
          label="CURRENT 15D"
          value={`${currentSystemAverage}%`}
          green={currentSystemAverage >= 50}
        />

        <Metric
          label="PREVIOUS 15D"
          value={`${previousSystemAverage}%`}
          green={previousSystemAverage >= 50}
        />

        <Metric
          label="SYSTEM TREND"
          value={formatDelta(systemDelta)}
          green={systemDelta > 0}
          warning={systemDelta < 0}
        />

        <Metric
          label="SAVED DAYS"
          value={`${currentSavedDays} / 15`}
          green={currentSavedDays >= 10}
        />

        <Metric
          label="PRIOR SAVED"
          value={`${previousSavedDays} / 15`}
          green={previousSavedDays >= 10}
        />
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-4">
        {trends.map((trend) => (
          <RoutineTrendCard
            key={trend.key}
            trend={trend}
          />
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <SignalCard
          label="STRONGEST ROUTINE"
          value={strongestRoutine.label}
          detail={`${strongestRoutine.currentAverage}% current signal`}
          green
        />

        <SignalCard
          label="REBUILD TARGET"
          value={rebuildTarget.label}
          detail={`${rebuildTarget.currentAverage}% current signal`}
          warning
        />

        <SignalCard
          label="BIGGEST MOVEMENT"
          value={improvingRoutine.label}
          detail={formatMovementDetail(
            improvingRoutine.delta
          )}
          green={improvingRoutine.delta > 0}
          warning={improvingRoutine.delta < 0}
        />
      </div>

      <div className="terminal-muted mt-4 border-t border-[#242424] pt-3 text-xs leading-6">
        <p>
          &gt; Each trend compares the latest 15 calendar
          days with the previous 15. Unsaved days count as
          zero, so the signal measures consistency and
          execution together.
        </p>
      </div>
    </TerminalShell>
  );
}

function RoutineTrendCard({
  trend,
}: {
  trend: RoutineTrend;
}) {
  return (
    <div className="border border-[#242424] bg-[#080808] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="terminal-muted text-[10px] uppercase tracking-[0.16em]">
            ROUTINE
          </p>

          <p className="mt-2 text-sm text-[#e5e5e5]">
            {trend.label}
          </p>
        </div>

        <span
          className={
            trend.delta > 0
              ? "terminal-green text-xs"
              : trend.delta < 0
                ? "text-xs text-[#ffb020]"
                : "terminal-muted text-xs"
          }
        >
          {formatDelta(trend.delta)}
        </span>
      </div>

      <div className="mt-4 flex items-end gap-1">
        {trend.currentValues.map((value, index) => (
          <div
            key={`${trend.key}-${index}`}
            className="flex h-20 flex-1 items-end border border-[#1a1a1a] bg-[#050505]"
            title={`Day ${index + 1}: ${value}%`}
          >
            <div
              className="w-full bg-[#39ff88] transition-all"
              style={{
                height: `${Math.max(
                  value > 0 ? value : 3,
                  3
                )}%`,
                opacity: value > 0 ? 1 : 0.18,
              }}
            />
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <SmallMetric
          label="CURRENT"
          value={`${trend.currentAverage}%`}
          green={trend.currentAverage >= 50}
        />

        <SmallMetric
          label="PREVIOUS"
          value={`${trend.previousAverage}%`}
          green={trend.previousAverage >= 50}
        />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  green = false,
  warning = false,
}: {
  label: string;
  value: string;
  green?: boolean;
  warning?: boolean;
}) {
  const valueClassName = green
    ? "terminal-green"
    : warning
      ? "text-[#ffb020]"
      : "text-[#e5e5e5]";

  return (
    <div className="border border-[#242424] bg-[#080808] p-3">
      <p className="terminal-muted text-[10px] uppercase tracking-[0.18em]">
        {label}
      </p>

      <p className={`mt-2 text-lg ${valueClassName}`}>
        {value}
      </p>
    </div>
  );
}

function SmallMetric({
  label,
  value,
  green = false,
}: {
  label: string;
  value: string;
  green?: boolean;
}) {
  return (
    <div className="border border-[#242424] bg-[#050505] p-2">
      <p className="terminal-muted text-[9px] uppercase tracking-[0.12em]">
        {label}
      </p>

      <p
        className={
          green
            ? "terminal-green mt-1 text-xs"
            : "mt-1 text-xs text-[#e5e5e5]"
        }
      >
        {value}
      </p>
    </div>
  );
}

function SignalCard({
  label,
  value,
  detail,
  green = false,
  warning = false,
}: {
  label: string;
  value: string;
  detail: string;
  green?: boolean;
  warning?: boolean;
}) {
  const valueClassName = green
    ? "terminal-green"
    : warning
      ? "text-[#ffb020]"
      : "text-[#e5e5e5]";

  return (
    <div className="border border-[#242424] bg-[#080808] p-3">
      <p className="terminal-muted text-[10px] uppercase tracking-[0.18em]">
        {label}
      </p>

      <p className={`mt-2 text-sm ${valueClassName}`}>
        {value}
      </p>

      <p className="terminal-muted mt-1 text-xs">
        &gt; {detail}
      </p>
    </div>
  );
}

function TerminalShell({
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

function normalizeRows(
  rows: ResetRoutineRow[]
): NormalizedRoutineDay[] {
  const uniqueRows = new Map<
    string,
    NormalizedRoutineDay
  >();

  for (const row of rows) {
    if (!isValidDateKey(row.date)) {
      continue;
    }

    uniqueRows.set(row.date, {
      date: row.date,
      morningScore: clampScore(
        row.morning_score
      ),
      dailyScore: clampScore(row.daily_score),
      nightScore: clampScore(row.night_score),
      trustScore: clampScore(row.trust_score),
    });
  }

  return Array.from(uniqueRows.values());
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

function calculateAverage(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return Math.round(
    values.reduce(
      (sum, value) => sum + value,
      0
    ) / values.length
  );
}

function formatDelta(delta: number) {
  if (delta > 0) {
    return `+${delta} PTS`;
  }

  if (delta < 0) {
    return `${delta} PTS`;
  }

  return "NO CHANGE";
}

function formatMovementDetail(delta: number) {
  if (delta > 0) {
    return `Improved by ${delta} points`;
  }

  if (delta < 0) {
    return `Dropped by ${Math.abs(delta)} points`;
  }

  return "No movement detected";
}

function clampScore(
  value: number | string | null
) {
  const parsed = Number(value ?? 0);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(0, Math.round(parsed))
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

function isValidDateKey(dateKey: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey);
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