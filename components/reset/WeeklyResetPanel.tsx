import { createClient } from "@/utils/supabase/server";

type ResetScoreRow = {
  date: string;
  morning_score: number | string | null;
  daily_score: number | string | null;
  night_score: number | string | null;
  trust_score: number | string | null;
  reset_score: number | string | null;
  completed_protocols: number | string | null;
  total_protocols: number | string | null;
  system_status: string | null;
  consistency_signal: string | null;
};

type NormalizedResetScore = {
  date: string;
  morningScore: number;
  dailyScore: number;
  nightScore: number;
  trustScore: number;
  resetScore: number;
  completedProtocols: number;
  totalProtocols: number;
  systemStatus: string;
  consistencySignal: string;
};

type RoutineKey =
  | "Morning Reset"
  | "Daily Protocols"
  | "Shutdown Protocol"
  | "Sleep Boundary";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const APP_TIME_ZONE = "America/New_York";

export async function WeeklyResetPanel() {
  const supabase = await createClient();

  const todayKey = getDateKeyInTimeZone(
    new Date(),
    APP_TIME_ZONE
  );
  const todayDayNumber = dateKeyToDayNumber(todayKey);
  const firstDateKey = dayNumberToDateKey(
    todayDayNumber - 13
  );

  const { data, error } = await supabase
    .from("daily_reset_scores")
    .select(`
      date,
      morning_score,
      daily_score,
      night_score,
      trust_score,
      reset_score,
      completed_protocols,
      total_protocols,
      system_status,
      consistency_signal
    `)
    .gte("date", firstDateKey)
    .lte("date", todayKey)
    .order("date", { ascending: true });

  if (error) {
    return (
      <TerminalShell title="weekly.reset.report">
        <p className="text-xs leading-6 text-[#ffb020]">
          &gt; Weekly report unavailable: {error.message}
        </p>
      </TerminalShell>
    );
  }

  const rows = normalizeRows(
    (data ?? []) as ResetScoreRow[]
  );
  const rowsByDate = new Map(
    rows.map((row) => [row.date, row])
  );

  const currentWeek = createWeek(
    todayDayNumber - 6,
    rowsByDate
  );
  const previousWeek = createWeek(
    todayDayNumber - 13,
    rowsByDate
  );

  const currentWeekScore =
    calculateCalendarWeekScore(currentWeek);
  const previousWeekScore =
    calculateCalendarWeekScore(previousWeek);
  const weekDelta =
    currentWeekScore - previousWeekScore;

  const savedDays = currentWeek.filter(
    (day) => day.row !== null
  ).length;

  const completionRate =
    calculateProtocolCompletionRate(currentWeek);

  const routineSignals =
    calculateRoutineSignals(currentWeek);
  const strongestRoutine = routineSignals[0];
  const weakestRoutine =
    routineSignals[routineSignals.length - 1];

  const consistencyStatus =
    getConsistencyStatus(
      currentWeekScore,
      savedDays
    );

  return (
    <TerminalShell title="weekly.reset.report">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric
          label="WEEK SCORE"
          value={`${currentWeekScore}%`}
          green={currentWeekScore >= 50}
        />
        <Metric
          label="SAVED DAYS"
          value={`${savedDays} / 7`}
          green={savedDays >= 5}
        />
        <Metric
          label="PROTOCOL RATE"
          value={`${completionRate}%`}
          green={completionRate >= 50}
        />
        <Metric
          label="WEEK TREND"
          value={formatDelta(weekDelta)}
          green={weekDelta > 0}
          warning={weekDelta < 0}
        />
        <Metric
          label="SYSTEM STATUS"
          value={consistencyStatus}
          green={currentWeekScore >= 50}
          warning={
            currentWeekScore > 0 &&
            currentWeekScore < 35
          }
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {currentWeek.map((day) => (
          <DaySignal
            key={day.date}
            date={day.date}
            row={day.row}
            isToday={day.date === todayKey}
          />
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <RoutineCard
          label="STRONGEST ROUTINE"
          routine={strongestRoutine.label}
          score={strongestRoutine.score}
          green
        />

        <RoutineCard
          label="REBUILD TARGET"
          routine={weakestRoutine.label}
          score={weakestRoutine.score}
          warning
        />
      </div>

      <div className="terminal-muted mt-4 border-t border-[#242424] pt-3 text-xs leading-6">
        <p>
          &gt; Routine scores are now persisted in Supabase,
          so this comparison stays consistent across devices.
        </p>
        <p>
          &gt; Previous seven-day score:{" "}
          <span className="text-[#e5e5e5]">
            {previousWeekScore}%
          </span>
        </p>
      </div>
    </TerminalShell>
  );
}

function normalizeRows(
  rows: ResetScoreRow[]
): NormalizedResetScore[] {
  const uniqueRows = new Map<
    string,
    NormalizedResetScore
  >();

  for (const row of rows) {
    uniqueRows.set(row.date, {
      date: row.date,
      morningScore: clampScore(
        row.morning_score
      ),
      dailyScore: clampScore(row.daily_score),
      nightScore: clampScore(row.night_score),
      trustScore: clampScore(row.trust_score),
      resetScore: clampScore(row.reset_score),
      completedProtocols: toNonNegativeNumber(
        row.completed_protocols
      ),
      totalProtocols: toNonNegativeNumber(
        row.total_protocols
      ),
      systemStatus:
        row.system_status ?? "NO STATUS",
      consistencySignal:
        row.consistency_signal ?? "NO SIGNAL",
    });
  }

  return Array.from(uniqueRows.values()).sort(
    (a, b) => a.date.localeCompare(b.date)
  );
}

function createWeek(
  firstDayNumber: number,
  rowsByDate: Map<string, NormalizedResetScore>
) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = dayNumberToDateKey(
      firstDayNumber + index
    );

    return {
      date,
      row: rowsByDate.get(date) ?? null,
    };
  });
}

function calculateCalendarWeekScore(
  week: Array<{
    date: string;
    row: NormalizedResetScore | null;
  }>
) {
  return Math.round(
    week.reduce(
      (sum, day) =>
        sum + (day.row?.resetScore ?? 0),
      0
    ) / 7
  );
}

function calculateProtocolCompletionRate(
  week: Array<{
    date: string;
    row: NormalizedResetScore | null;
  }>
) {
  const totals = week.reduce(
    (accumulator, day) => {
      accumulator.completed +=
        day.row?.completedProtocols ?? 0;
      accumulator.possible +=
        day.row?.totalProtocols ?? 0;
      return accumulator;
    },
    { completed: 0, possible: 0 }
  );

  if (totals.possible === 0) {
    return 0;
  }

  return Math.round(
    (totals.completed / totals.possible) * 100
  );
}

function calculateRoutineSignals(
  week: Array<{
    date: string;
    row: NormalizedResetScore | null;
  }>
) {
  const routines: Array<{
    label: RoutineKey;
    score: number;
  }> = [
    {
      label: "Morning Reset",
      score: calculateRoutineAverage(
        week,
        "morningScore"
      ),
    },
    {
      label: "Daily Protocols",
      score: calculateRoutineAverage(
        week,
        "dailyScore"
      ),
    },
    {
      label: "Shutdown Protocol",
      score: calculateRoutineAverage(
        week,
        "nightScore"
      ),
    },
    {
      label: "Sleep Boundary",
      score: calculateRoutineAverage(
        week,
        "trustScore"
      ),
    },
  ];

  return routines.sort(
    (a, b) => b.score - a.score
  );
}

function calculateRoutineAverage(
  week: Array<{
    date: string;
    row: NormalizedResetScore | null;
  }>,
  key:
    | "morningScore"
    | "dailyScore"
    | "nightScore"
    | "trustScore"
) {
  return Math.round(
    week.reduce(
      (sum, day) =>
        sum + (day.row?.[key] ?? 0),
      0
    ) / 7
  );
}

function getConsistencyStatus(
  weekScore: number,
  savedDays: number
) {
  if (weekScore >= 80 && savedDays >= 6) {
    return "LOCKED IN";
  }
  if (weekScore >= 60 && savedDays >= 5) {
    return "SYSTEM STABLE";
  }
  if (weekScore >= 35 || savedDays >= 3) {
    return "PATTERN FORMING";
  }
  if (savedDays >= 1) {
    return "REBUILD ACTIVE";
  }
  return "NO SIGNAL";
}

function DaySignal({
  date,
  row,
  isToday,
}: {
  date: string;
  row: NormalizedResetScore | null;
  isToday: boolean;
}) {
  const score = row?.resetScore ?? 0;

  return (
    <div
      className={[
        "border bg-[#080808] p-3",
        isToday
          ? "border-[#39ff88]"
          : "border-[#242424]",
      ].join(" ")}
    >
      <p className="terminal-muted text-[10px] uppercase tracking-[0.14em]">
        {formatDayLabel(date)}
      </p>
      <p
        className={[
          "mt-2 text-lg",
          getScoreClassName(score, row !== null),
        ].join(" ")}
      >
        {row ? `${score}%` : "--"}
      </p>
      <p className="terminal-muted mt-1 truncate text-[10px] uppercase">
        {row?.consistencySignal ?? "UNSAVED"}
      </p>
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

function RoutineCard({
  label,
  routine,
  score,
  green = false,
  warning = false,
}: {
  label: string;
  routine: string;
  score: number;
  green?: boolean;
  warning?: boolean;
}) {
  const className = green
    ? "terminal-green"
    : warning
      ? "text-[#ffb020]"
      : "text-[#e5e5e5]";

  return (
    <div className="border border-[#242424] bg-[#080808] p-3">
      <p className="terminal-muted text-[10px] uppercase tracking-[0.18em]">
        {label}
      </p>
      <p className={`mt-2 text-sm ${className}`}>
        {routine}
      </p>
      <p className="terminal-muted mt-1 text-xs">
        &gt; Seven-day signal:{" "}
        <span className="text-[#e5e5e5]">
          {score}%
        </span>
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

function formatDelta(delta: number) {
  if (delta > 0) {
    return `+${delta} PTS`;
  }
  if (delta < 0) {
    return `${delta} PTS`;
  }
  return "NO CHANGE";
}

function getScoreClassName(
  score: number,
  hasRow: boolean
) {
  if (!hasRow) {
    return "terminal-muted";
  }
  if (score >= 50) {
    return "terminal-green";
  }
  if (score > 0) {
    return "text-[#ffb020]";
  }
  return "terminal-muted";
}

function formatDayLabel(dateKey: string) {
  const date = new Date(
    dateKeyToDayNumber(dateKey) *
      DAY_IN_MILLISECONDS
  );

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
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

function toNonNegativeNumber(
  value: number | string | null
) {
  const parsed = Number(value ?? 0);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, parsed);
}