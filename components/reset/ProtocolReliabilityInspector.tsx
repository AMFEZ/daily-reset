"use client";

import { useMemo, useState } from "react";

export type RoutineType =
  | "morning"
  | "daily"
  | "night"
  | "trust_based";

export type ReliabilityStatus =
  | "LOCKED IN"
  | "RELIABLE"
  | "INCONSISTENT"
  | "REBUILD";

export type ProtocolHistoryDay = {
  date: string;
  completed: boolean;
};

export type ProtocolReliabilityRecord = {
  id: string;
  name: string;
  category: string;
  routineType: RoutineType;
  sortOrder: number;
  completed30: number;
  rate30: number;
  rate7: number;
  previousRate7: number;
  trend: number;
  currentStreak: number;
  longestStreak: number;
  status: ReliabilityStatus;
  completionHistory: ProtocolHistoryDay[];
};

type ProtocolReliabilityInspectorProps = {
  protocols: ProtocolReliabilityRecord[];
  firstDateKey: string;
  lastDateKey: string;
};

const ROUTINE_LABELS: Record<RoutineType, string> = {
  morning: "MORNING",
  daily: "DAILY",
  night: "NIGHT",
  trust_based: "SLEEP",
};

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export function ProtocolReliabilityInspector({
  protocols,
  firstDateKey,
  lastDateKey,
}: ProtocolReliabilityInspectorProps) {
  const defaultProtocol = useMemo(
    () =>
      protocols.length > 0
        ? [...protocols].sort(
            compareWeakestProtocols
          )[0]
        : null,
    [protocols]
  );

  const [selectedProtocolId, setSelectedProtocolId] =
    useState<string | null>(
      defaultProtocol?.id ?? null
    );

  const selectedProtocol =
    protocols.find(
      (protocol) =>
        protocol.id === selectedProtocolId
    ) ??
    defaultProtocol ??
    null;

  const average30 = calculateAverage(
    protocols.map((protocol) => protocol.rate30)
  );

  const average7 = calculateAverage(
    protocols.map((protocol) => protocol.rate7)
  );

  const reliableCount = protocols.filter(
    (protocol) => protocol.rate30 >= 70
  ).length;

  const rebuildCount = protocols.filter(
    (protocol) => protocol.rate30 < 40
  ).length;

  const strongestProtocol =
    protocols.length > 0
      ? [...protocols].sort(
          compareStrongestProtocols
        )[0]
      : null;

  const rebuildTarget =
    protocols.length > 0
      ? [...protocols].sort(
          compareWeakestProtocols
        )[0]
      : null;

  const biggestImprovement =
    protocols.length > 0
      ? [...protocols].sort(
          (a, b) => b.trend - a.trend
        )[0]
      : null;

  return (
    <section className="border border-[#242424] bg-[#050505]">
      <div className="border-b border-[#242424] bg-[#0d0d0d] px-3 py-2">
        <p className="terminal-green text-xs uppercase tracking-[0.2em]">
          &gt; protocol.reliability
        </p>
      </div>

      <div className="p-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric
            label="ACTIVE PROTOCOLS"
            value={String(protocols.length)}
            green={protocols.length > 0}
          />

          <Metric
            label="30D RELIABILITY"
            value={`${average30}%`}
            green={average30 >= 60}
            warning={
              average30 > 0 && average30 < 40
            }
          />

          <Metric
            label="RECENT 7D"
            value={`${average7}%`}
            green={average7 >= 60}
            warning={
              average7 > 0 && average7 < 40
            }
          />

          <Metric
            label="RELIABLE"
            value={`${reliableCount} PROTOCOLS`}
            green={reliableCount > 0}
          />

          <Metric
            label="REBUILD"
            value={`${rebuildCount} PROTOCOLS`}
            warning={rebuildCount > 0}
          />
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <SignalCard
            label="STRONGEST PROTOCOL"
            value={
              strongestProtocol?.name ??
              "NO SIGNAL"
            }
            detail={
              strongestProtocol
                ? `${strongestProtocol.rate30}% over 30 closed days`
                : "No protocol history available"
            }
            green={Boolean(strongestProtocol)}
          />

          <SignalCard
            label="REBUILD TARGET"
            value={
              rebuildTarget?.name ?? "NO SIGNAL"
            }
            detail={
              rebuildTarget
                ? `${rebuildTarget.rate30}% over 30 closed days`
                : "No protocol history available"
            }
            warning={Boolean(rebuildTarget)}
          />

          <SignalCard
            label="BIGGEST IMPROVEMENT"
            value={
              biggestImprovement?.name ??
              "NO SIGNAL"
            }
            detail={
              biggestImprovement
                ? formatTrendDetail(
                    biggestImprovement.trend
                  )
                : "No comparison available"
            }
            green={
              (biggestImprovement?.trend ?? 0) >
              0
            }
            warning={
              (biggestImprovement?.trend ?? 0) <
              0
            }
          />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_0.55fr]">
          <div className="max-h-[620px] overflow-auto border border-[#242424]">
            <div className="min-w-[990px]">
              <div className="terminal-muted grid grid-cols-[100px_250px_180px_80px_80px_100px_90px_100px] gap-3 border-b border-[#242424] bg-[#080808] px-3 py-2 text-[10px] uppercase tracking-[0.12em]">
                <span>Routine</span>
                <span>Protocol</span>
                <span>Reliability</span>
                <span>7D</span>
                <span>30D</span>
                <span>Trend</span>
                <span>Streak</span>
                <span>Status</span>
              </div>

              {protocols.length > 0 ? (
                protocols.map((protocol) => (
                  <ProtocolRow
                    key={protocol.id}
                    protocol={protocol}
                    selected={
                      selectedProtocol?.id ===
                      protocol.id
                    }
                    onSelect={() =>
                      setSelectedProtocolId(
                        protocol.id
                      )
                    }
                  />
                ))
              ) : (
                <p className="terminal-muted p-3 text-xs">
                  &gt; No active protocols found.
                </p>
              )}
            </div>
          </div>

          <ProtocolInspector
            protocol={selectedProtocol}
          />
        </div>

        <div className="terminal-muted mt-4 border-t border-[#242424] pt-3 text-xs leading-6">
          <p>
            &gt; Window: {firstDateKey} through{" "}
            {lastDateKey}. Today is excluded until it
            becomes a closed day.
          </p>

          <p>
            &gt; Click a protocol row to inspect its
            complete 30-day execution pattern.
          </p>
        </div>
      </div>
    </section>
  );
}

function ProtocolRow({
  protocol,
  selected,
  onSelect,
}: {
  protocol: ProtocolReliabilityRecord;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={[
        "terminal-line grid w-full grid-cols-[100px_250px_180px_80px_80px_100px_90px_100px] items-center gap-3 px-3 py-3 text-left text-xs transition",
        selected
          ? "bg-[#0c1a12] ring-1 ring-inset ring-[#39ff88]"
          : "hover:bg-[#0a0a0a]",
      ].join(" ")}
    >
      <span className="terminal-muted">
        {ROUTINE_LABELS[protocol.routineType]}
      </span>

      <div>
        <p className="text-[#e5e5e5]">
          {protocol.name}
        </p>

        <p className="terminal-muted mt-1 text-[10px]">
          {protocol.category}
        </p>
      </div>

      <div>
        <div className="h-2 overflow-hidden border border-[#242424] bg-[#050505]">
          <div
            className="h-full bg-[#39ff88]"
            style={{
              width: `${protocol.rate30}%`,
            }}
          />
        </div>

        <p className="terminal-muted mt-1 text-[10px]">
          {protocol.completed30}/30 complete
        </p>
      </div>

      <ScoreText value={protocol.rate7} />
      <ScoreText value={protocol.rate30} />

      <span
        className={
          protocol.trend > 0
            ? "terminal-green"
            : protocol.trend < 0
              ? "text-[#ffb020]"
              : "terminal-muted"
        }
      >
        {formatDelta(protocol.trend)}
      </span>

      <span className="text-[#e5e5e5]">
        {protocol.currentStreak}D
        <span className="terminal-muted">
          {" "}
          / {protocol.longestStreak}
        </span>
      </span>

      <StatusBadge status={protocol.status} />
    </button>
  );
}

function ProtocolInspector({
  protocol,
}: {
  protocol: ProtocolReliabilityRecord | null;
}) {
  if (!protocol) {
    return (
      <div className="border border-[#242424] bg-[#080808] p-4">
        <p className="terminal-green text-xs uppercase tracking-[0.2em]">
          &gt; protocol.inspector
        </p>

        <p className="terminal-muted mt-4 text-xs leading-6">
          &gt; Select a protocol to inspect its
          reliability pattern.
        </p>
      </div>
    );
  }

  const recentHistory =
    protocol.completionHistory.slice(-7);
  const missedDates =
    protocol.completionHistory.filter(
      (day) => !day.completed
    );
  const latestMissedDate =
    missedDates.at(-1)?.date ?? null;

  return (
    <div className="border border-[#242424] bg-[#080808] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="terminal-green text-xs uppercase tracking-[0.2em]">
            &gt; protocol.inspector
          </p>

          <p className="mt-2 text-base text-[#e5e5e5]">
            {protocol.name}
          </p>

          <p className="terminal-muted mt-1 text-xs">
            {ROUTINE_LABELS[
              protocol.routineType
            ]} / {protocol.category}
          </p>
        </div>

        <StatusBadge status={protocol.status} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <SmallMetric
          label="30D RATE"
          value={`${protocol.rate30}%`}
          green={protocol.rate30 >= 70}
        />

        <SmallMetric
          label="7D RATE"
          value={`${protocol.rate7}%`}
          green={protocol.rate7 >= 70}
        />

        <SmallMetric
          label="CURRENT STREAK"
          value={`${protocol.currentStreak} DAYS`}
          green={protocol.currentStreak > 0}
        />

        <SmallMetric
          label="BEST STREAK"
          value={`${protocol.longestStreak} DAYS`}
          green={protocol.longestStreak > 0}
        />
      </div>

      <div className="mt-4">
        <p className="terminal-muted text-[10px] uppercase tracking-[0.16em]">
          30-DAY EXECUTION
        </p>

        <div className="mt-2 grid grid-cols-10 gap-1">
          {protocol.completionHistory.map(
            (day) => (
              <span
                key={day.date}
                title={`${day.date}: ${
                  day.completed
                    ? "complete"
                    : "missed"
                }`}
                className={
                  day.completed
                    ? "aspect-square border border-[#39ff88] bg-[#12351f]"
                    : "aspect-square border border-[#242424] bg-[#050505]"
                }
              />
            )
          )}
        </div>
      </div>

      <div className="mt-4">
        <p className="terminal-muted text-[10px] uppercase tracking-[0.16em]">
          RECENT 7 DAYS
        </p>

        <div className="mt-2 grid grid-cols-7 gap-1">
          {recentHistory.map((day) => (
            <div
              key={day.date}
              title={`${day.date}: ${
                day.completed
                  ? "complete"
                  : "missed"
              }`}
              className={[
                "border p-2 text-center",
                day.completed
                  ? "border-[#39ff88] bg-[#12351f]"
                  : "border-[#242424] bg-[#050505]",
              ].join(" ")}
            >
              <p className="terminal-muted text-[9px]">
                {formatWeekday(day.date)}
              </p>

              <p
                className={
                  day.completed
                    ? "terminal-green mt-1 text-xs"
                    : "terminal-muted mt-1 text-xs"
                }
              >
                {day.completed ? "✓" : "—"}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 border-t border-[#242424] pt-3">
        <InspectorRow
          label="RECENT TREND"
          value={formatDelta(protocol.trend)}
          green={protocol.trend > 0}
          warning={protocol.trend < 0}
        />

        <InspectorRow
          label="COMPLETED"
          value={`${protocol.completed30} / 30`}
          green={protocol.completed30 >= 21}
        />

        <InspectorRow
          label="LATEST MISS"
          value={
            latestMissedDate
              ? formatShortDate(latestMissedDate)
              : "NONE IN WINDOW"
          }
          green={!latestMissedDate}
        />
      </div>

      <p className="terminal-muted mt-4 text-xs leading-6">
        &gt;{" "}
        {getProtocolDirective(protocol)}
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

function InspectorRow({
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
    <div className="terminal-line flex items-start justify-between gap-4 py-2 text-xs">
      <span className="terminal-muted">
        {label}
      </span>

      <span
        className={`text-right ${valueClassName}`}
      >
        {value}
      </span>
    </div>
  );
}

function ScoreText({
  value,
}: {
  value: number;
}) {
  return (
    <span
      className={
        value >= 70
          ? "terminal-green"
          : value > 0
            ? "text-[#ffb020]"
            : "terminal-muted"
      }
    >
      {value}%
    </span>
  );
}

function StatusBadge({
  status,
}: {
  status: ReliabilityStatus;
}) {
  return (
    <span
      className={
        status === "LOCKED IN" ||
        status === "RELIABLE"
          ? "terminal-green"
          : status === "INCONSISTENT"
            ? "text-[#ffb020]"
            : "text-[#ff6b6b]"
      }
    >
      {status}
    </span>
  );
}

function compareStrongestProtocols(
  a: ProtocolReliabilityRecord,
  b: ProtocolReliabilityRecord
) {
  if (b.rate30 !== a.rate30) {
    return b.rate30 - a.rate30;
  }

  if (b.currentStreak !== a.currentStreak) {
    return b.currentStreak - a.currentStreak;
  }

  return a.sortOrder - b.sortOrder;
}

function compareWeakestProtocols(
  a: ProtocolReliabilityRecord,
  b: ProtocolReliabilityRecord
) {
  if (a.rate30 !== b.rate30) {
    return a.rate30 - b.rate30;
  }

  if (a.currentStreak !== b.currentStreak) {
    return a.currentStreak - b.currentStreak;
  }

  return a.sortOrder - b.sortOrder;
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

function formatTrendDetail(delta: number) {
  if (delta > 0) {
    return `Recent seven-day rate improved by ${delta} points`;
  }

  if (delta < 0) {
    return `Recent seven-day rate dropped by ${Math.abs(
      delta
    )} points`;
  }

  return "Recent seven-day rate is unchanged";
}

function getProtocolDirective(
  protocol: ProtocolReliabilityRecord
) {
  if (protocol.status === "LOCKED IN") {
    return "Execution is automatic. Protect the cue and keep the chain intact.";
  }

  if (protocol.status === "RELIABLE") {
    return "The pattern is stable. Focus on extending the current streak.";
  }

  if (protocol.status === "INCONSISTENT") {
    return "Reduce friction. Define the smallest acceptable version and execute it daily.";
  }

  return "Rebuild from zero. Attach this protocol to an existing cue and prioritize one successful repetition.";
}

function formatWeekday(dateKey: string) {
  const date = new Date(
    dateKeyToDayNumber(dateKey) *
      DAY_IN_MILLISECONDS
  );

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "narrow",
  }).format(date);
}

function formatShortDate(dateKey: string) {
  const date = new Date(
    dateKeyToDayNumber(dateKey) *
      DAY_IN_MILLISECONDS
  );

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
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