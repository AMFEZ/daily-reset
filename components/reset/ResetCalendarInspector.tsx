"use client";

import type { ResetCalendarDay } from "@/components/reset/ResetCalendarPanel";
import { useMemo, useState } from "react";

type ResetCalendarInspectorProps = {
  days: ResetCalendarDay[];
  todayKey: string;
};

type CalendarCell = {
  date: string;
  isToday: boolean;
  isFuture: boolean;
  day: ResetCalendarDay | null;
};

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const APP_TIME_ZONE = "America/New_York";

const WEEKDAY_LABELS = [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
];

export function ResetCalendarInspector({
  days,
  todayKey,
}: ResetCalendarInspectorProps) {
  const daysByDate = useMemo(
    () =>
      new Map(
        days.map((day) => [day.date, day])
      ),
    [days]
  );

  const todayDayNumber =
    dateKeyToDayNumber(todayKey);
  const currentMonday = getMondayDayNumber(
    todayDayNumber
  );
  const firstDayNumber = currentMonday - 28;

  const cells = useMemo<CalendarCell[]>(
    () =>
      Array.from({ length: 35 }, (_, index) => {
        const dayNumber =
          firstDayNumber + index;
        const date =
          dayNumberToDateKey(dayNumber);

        return {
          date,
          isToday: date === todayKey,
          isFuture:
            dayNumber > todayDayNumber,
          day: daysByDate.get(date) ?? null,
        };
      }),
    [
      daysByDate,
      firstDayNumber,
      todayDayNumber,
      todayKey,
    ]
  );

  const visibleSavedDays = useMemo(
    () =>
      cells
        .filter(
          (
            cell
          ): cell is CalendarCell & {
            day: ResetCalendarDay;
          } =>
            !cell.isFuture && cell.day !== null
        )
        .map((cell) => cell.day),
    [cells]
  );

  const initialSelectedDate =
    daysByDate.has(todayKey)
      ? todayKey
      : visibleSavedDays.at(-1)?.date ??
        days.at(-1)?.date ??
        null;

  const [selectedDate, setSelectedDate] =
    useState<string | null>(
      initialSelectedDate
    );

  const selectedDay = selectedDate
    ? daysByDate.get(selectedDate) ?? null
    : null;

  const savedDays = visibleSavedDays.length;

  const averageScore =
    savedDays > 0
      ? Math.round(
          visibleSavedDays.reduce(
            (sum, day) =>
              sum + day.resetScore,
            0
          ) / savedDays
        )
      : 0;

  const strongDays = visibleSavedDays.filter(
    (day) => day.resetScore >= 70
  ).length;

  const finalizedDays =
    visibleSavedDays.filter(
      (day) => day.isLocked
    ).length;

  const bestDay =
    savedDays > 0
      ? [...visibleSavedDays].sort(
          (a, b) =>
            b.resetScore - a.resetScore
        )[0]
      : null;

  return (
    <section className="border border-[#242424] bg-[#050505]">
      <div className="border-b border-[#242424] bg-[#0d0d0d] px-3 py-2">
        <p className="terminal-green text-xs uppercase tracking-[0.2em]">
          &gt; reset.calendar
        </p>
      </div>

      <div className="p-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="SAVED DAYS"
            value={`${savedDays} / 35`}
            green={savedDays >= 20}
          />

          <Metric
            label="SAVED-DAY AVG"
            value={`${averageScore}%`}
            green={averageScore >= 50}
          />

          <Metric
            label="STRONG DAYS"
            value={`${strongDays} ≥ 70%`}
            green={strongDays > 0}
          />

          <Metric
            label="FINALIZED"
            value={`${finalizedDays} DAYS`}
            green={finalizedDays > 0}
          />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="overflow-x-auto">
            <div className="min-w-[630px]">
              <div className="mb-2 grid grid-cols-7 gap-2">
                {WEEKDAY_LABELS.map(
                  (label) => (
                    <p
                      key={label}
                      className="terminal-muted text-center text-[10px] tracking-[0.16em]"
                    >
                      {label}
                    </p>
                  )
                )}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {cells.map((cell) => (
                  <CalendarDayButton
                    key={cell.date}
                    cell={cell}
                    selected={
                      selectedDate === cell.date
                    }
                    onSelect={() =>
                      setSelectedDate(cell.date)
                    }
                  />
                ))}
              </div>
            </div>
          </div>

          <DayInspector day={selectedDay} />
        </div>

        <div className="terminal-muted mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-[#242424] pt-3 text-[10px] uppercase tracking-[0.12em]">
          <LegendItem
            label="UNSAVED"
            className="bg-[#080808]"
          />
          <LegendItem
            label="1–34"
            className="bg-[#17110a]"
          />
          <LegendItem
            label="35–69"
            className="bg-[#0c1a12]"
          />
          <LegendItem
            label="70–89"
            className="bg-[#12351f]"
          />
          <LegendItem
            label="90–100"
            className="bg-[#39ff88]"
          />
        </div>

        <div className="terminal-muted mt-3 text-xs leading-6">
          <p>
            &gt; Click a saved date to inspect its
            complete Supabase snapshot.
          </p>

          <p>
            &gt; Best visible signal:{" "}
            <span className="text-[#e5e5e5]">
              {bestDay
                ? `${formatDisplayDate(
                    bestDay.date
                  )} / ${bestDay.resetScore}%`
                : "NO SIGNAL"}
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}

function CalendarDayButton({
  cell,
  selected,
  onSelect,
}: {
  cell: CalendarCell;
  selected: boolean;
  onSelect: () => void;
}) {
  const score = cell.day?.resetScore ?? 0;
  const completed =
    cell.day?.completedProtocols ?? 0;
  const total =
    cell.day?.totalProtocols ?? 0;

  const disabled =
    cell.isFuture || cell.day === null;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      title={getCellTitle(cell)}
      aria-pressed={selected}
      className={[
        "min-h-[90px] border p-2 text-left transition",
        getCellClassName(cell),
        selected
          ? "border-[#39ff88] ring-1 ring-[#39ff88]"
          : cell.isToday
            ? "border-[#39ff88]"
            : "border-[#242424]",
        disabled
          ? "cursor-default"
          : "cursor-pointer hover:border-[#39ff88]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={[
            "text-[10px]",
            cell.isToday
              ? "terminal-green"
              : "terminal-muted",
          ].join(" ")}
        >
          {formatDayNumber(cell.date)}
        </span>

        {cell.day?.isLocked ? (
          <span
            className={
              score >= 90
                ? "text-[9px] uppercase tracking-[0.1em] text-[#000000]"
                : "terminal-green text-[9px] uppercase tracking-[0.1em]"
            }
          >
            FINAL
          </span>
        ) : cell.isToday ? (
          <span className="terminal-green text-[9px] uppercase tracking-[0.1em]">
            TODAY
          </span>
        ) : null}
      </div>

      <p
        className={[
          "mt-2 text-lg",
          getScoreTextClassName(cell),
        ].join(" ")}
      >
        {cell.isFuture
          ? ""
          : cell.day
            ? `${score}%`
            : "--"}
      </p>

      {!cell.isFuture && cell.day ? (
        <p
          className={
            score >= 90
              ? "mt-1 text-[9px] uppercase tracking-[0.08em] text-[#111111]"
              : "mt-1 text-[9px] uppercase tracking-[0.08em] text-[#b9b9b9]"
          }
        >
          {completed}/{total} complete
        </p>
      ) : (
        <p className="terminal-muted mt-1 text-[9px] uppercase tracking-[0.08em]">
          {cell.isFuture
            ? "FUTURE"
            : "UNSAVED"}
        </p>
      )}
    </button>
  );
}

function DayInspector({
  day,
}: {
  day: ResetCalendarDay | null;
}) {
  if (!day) {
    return (
      <div className="border border-[#242424] bg-[#080808] p-4">
        <p className="terminal-green text-xs uppercase tracking-[0.2em]">
          &gt; day.inspector
        </p>

        <p className="terminal-muted mt-4 text-xs leading-6">
          &gt; Select a saved date to inspect its
          routine breakdown.
        </p>
      </div>
    );
  }

  const completionRate =
    day.totalProtocols > 0
      ? Math.round(
          (day.completedProtocols /
            day.totalProtocols) *
            100
        )
      : 0;

  return (
    <div className="border border-[#242424] bg-[#080808] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="terminal-green text-xs uppercase tracking-[0.2em]">
            &gt; day.inspector
          </p>

          <p className="mt-2 text-base text-[#e5e5e5]">
            {formatDisplayDate(day.date)}
          </p>
        </div>

        <span
          className={
            day.isLocked
              ? "border border-[#39ff88] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[#39ff88]"
              : "border border-[#242424] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[#8a8a8a]"
          }
        >
          {day.isLocked
            ? "FINALIZED"
            : "EDITABLE"}
        </span>
      </div>

      <div className="mt-4">
        <ScoreBar
          label="OVERALL RESET"
          value={day.resetScore}
        />
        <ScoreBar
          label="MORNING RESET"
          value={day.morningScore}
        />
        <ScoreBar
          label="DAILY PROTOCOLS"
          value={day.dailyScore}
        />
        <ScoreBar
          label="SHUTDOWN PROTOCOL"
          value={day.nightScore}
        />
        <ScoreBar
          label="SLEEP BOUNDARY"
          value={day.trustScore}
        />
      </div>

      <div className="mt-4 border-t border-[#242424] pt-3">
        <InspectorRow
          label="COMPLETED"
          value={`${day.completedProtocols} / ${day.totalProtocols}`}
          green={completionRate >= 50}
        />

        <InspectorRow
          label="COMPLETION RATE"
          value={`${completionRate}%`}
          green={completionRate >= 50}
        />

        <InspectorRow
          label="SYSTEM STATUS"
          value={day.systemStatus}
          green={day.resetScore >= 50}
        />

        <InspectorRow
          label="CONSISTENCY"
          value={day.consistencySignal}
          green={day.resetScore >= 50}
        />
      </div>

      {day.lockedAt ? (
        <p className="terminal-muted mt-4 text-xs leading-6">
          &gt; Finalized{" "}
          {formatTimestamp(day.lockedAt)}.
        </p>
      ) : (
        <p className="terminal-muted mt-4 text-xs leading-6">
          &gt; This snapshot can still change if its
          checklist is edited.
        </p>
      )}
    </div>
  );
}

function ScoreBar({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 flex items-center justify-between gap-4">
        <span className="terminal-muted text-[10px] uppercase tracking-[0.12em]">
          {label}
        </span>

        <span
          className={
            value >= 70
              ? "terminal-green text-xs"
              : value > 0
                ? "text-xs text-[#ffb020]"
                : "terminal-muted text-xs"
          }
        >
          {value}%
        </span>
      </div>

      <div className="h-2 overflow-hidden border border-[#242424] bg-[#050505]">
        <div
          className="h-full bg-[#39ff88] transition-all"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function InspectorRow({
  label,
  value,
  green = false,
}: {
  label: string;
  value: string;
  green?: boolean;
}) {
  return (
    <div className="terminal-line flex items-start justify-between gap-4 py-2 text-xs">
      <span className="terminal-muted">
        {label}
      </span>

      <span
        className={
          green
            ? "terminal-green text-right"
            : "text-right text-[#e5e5e5]"
        }
      >
        {value}
      </span>
    </div>
  );
}

function Metric({
  label,
  value,
  green = false,
}: {
  label: string;
  value: string;
  green?: boolean;
}) {
  return (
    <div className="border border-[#242424] bg-[#080808] p-3">
      <p className="terminal-muted text-[10px] uppercase tracking-[0.18em]">
        {label}
      </p>

      <p
        className={
          green
            ? "terminal-green mt-2 text-lg"
            : "mt-2 text-lg text-[#e5e5e5]"
        }
      >
        {value}
      </p>
    </div>
  );
}

function LegendItem({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <span
        className={`h-3 w-3 border border-[#242424] ${className}`}
      />
      {label}
    </span>
  );
}

function getCellClassName(
  cell: CalendarCell
) {
  if (cell.isFuture) {
    return "bg-[#030303] opacity-40";
  }

  if (!cell.day) {
    return "bg-[#080808]";
  }

  const score = cell.day.resetScore;

  if (score >= 90) {
    return "bg-[#39ff88]";
  }

  if (score >= 70) {
    return "bg-[#12351f]";
  }

  if (score >= 35) {
    return "bg-[#0c1a12]";
  }

  return "bg-[#17110a]";
}

function getScoreTextClassName(
  cell: CalendarCell
) {
  if (cell.isFuture || !cell.day) {
    return "terminal-muted";
  }

  if (cell.day.resetScore >= 90) {
    return "text-[#000000]";
  }

  if (cell.day.resetScore >= 50) {
    return "terminal-green";
  }

  return "text-[#ffb020]";
}

function getCellTitle(cell: CalendarCell) {
  if (cell.isFuture) {
    return `${cell.date}: future date`;
  }

  if (!cell.day) {
    return `${cell.date}: no reset saved`;
  }

  return [
    cell.date,
    `${cell.day.resetScore}% reset score`,
    `${cell.day.completedProtocols}/${cell.day.totalProtocols} protocols`,
    cell.day.consistencySignal,
    cell.day.isLocked
      ? "finalized"
      : "editable",
  ].join(" · ");
}

function getMondayDayNumber(
  dayNumber: number
) {
  const dayOfWeek = new Date(
    dayNumber * DAY_IN_MILLISECONDS
  ).getUTCDay();

  const daysSinceMonday =
    (dayOfWeek + 6) % 7;

  return dayNumber - daysSinceMonday;
}

function formatDayNumber(dateKey: string) {
  return dateKey.slice(8, 10);
}

function formatDisplayDate(dateKey: string) {
  const date = new Date(
    dateKeyToDayNumber(dateKey) *
      DAY_IN_MILLISECONDS
  );

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
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