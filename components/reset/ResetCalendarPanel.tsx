import { ResetCalendarInspector } from "@/components/reset/ResetCalendarInspector";
import { createClient } from "@/utils/supabase/server";

export type ResetCalendarDay = {
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
  isLocked: boolean;
  lockedAt: string | null;
};

type ResetCalendarRow = {
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
  is_locked: boolean | null;
  locked_at: string | null;
};

const APP_TIME_ZONE = "America/New_York";

export async function ResetCalendarPanel() {
  const supabase = await createClient();
  const todayKey = getDateKeyInTimeZone(
    new Date(),
    APP_TIME_ZONE
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
      consistency_signal,
      is_locked,
      locked_at
    `)
    .order("date", { ascending: true })
    .limit(180);

  if (error) {
    return (
      <section className="border border-[#242424] bg-[#050505]">
        <div className="border-b border-[#242424] bg-[#0d0d0d] px-3 py-2">
          <p className="terminal-green text-xs uppercase tracking-[0.2em]">
            &gt; reset.calendar
          </p>
        </div>

        <div className="p-3">
          <p className="text-xs leading-6 text-[#ffb020]">
            &gt; Calendar unavailable: {error.message}
          </p>
        </div>
      </section>
    );
  }

  const days = normalizeRows(
    (data ?? []) as ResetCalendarRow[]
  );

  return (
    <ResetCalendarInspector
      days={days}
      todayKey={todayKey}
    />
  );
}

function normalizeRows(
  rows: ResetCalendarRow[]
): ResetCalendarDay[] {
  const uniqueRows = new Map<
    string,
    ResetCalendarDay
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
      resetScore: clampScore(row.reset_score),
      completedProtocols: toNonNegativeInteger(
        row.completed_protocols
      ),
      totalProtocols: toNonNegativeInteger(
        row.total_protocols
      ),
      systemStatus:
        row.system_status ?? "NO STATUS",
      consistencySignal:
        row.consistency_signal ?? "NO SIGNAL",
      isLocked: Boolean(row.is_locked),
      lockedAt: row.locked_at,
    });
  }

  return Array.from(uniqueRows.values()).sort(
    (a, b) => a.date.localeCompare(b.date)
  );
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

function toNonNegativeInteger(
  value: number | string | null
) {
  const parsed = Number(value ?? 0);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.round(parsed));
}

function isValidDateKey(dateKey: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey);
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