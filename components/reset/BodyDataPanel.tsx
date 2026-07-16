"use client";

import { useMemo, useState, useTransition } from "react";
import { createClient } from "@/utils/supabase/client";

type WeightLog = {
  id: string;
  date: string;
  weight: number;
  unit: "lbs" | "kg";
  note: string | null;
};

type BodyDataPanelProps = {
  initialLogs: WeightLog[];
  defaultUnit?: "lbs" | "kg";
};

type SavedWeightLogRow = {
  id: string;
  date: string;
  weight: number | string;
  unit: "lbs" | "kg";
  note: string | null;
};

export function BodyDataPanel({
  initialLogs,
  defaultUnit = "lbs",
}: BodyDataPanelProps) {
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  const today = new Date().toISOString().slice(0, 10);

  const [logs, setLogs] = useState<WeightLog[]>(initialLogs);
  const todayLog = logs.find((log) => log.date === today);

  const [weight, setWeight] = useState(todayLog?.weight?.toString() ?? "");
  const [unit, setUnit] = useState<"lbs" | "kg">(todayLog?.unit ?? defaultUnit);
  const [message, setMessage] = useState<string | null>(null);

  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => b.date.localeCompare(a.date));
  }, [logs]);

  const sevenDayAverage = useMemo(() => {
    const recent = sortedLogs.slice(0, 7);

    if (recent.length === 0) return null;

    const total = recent.reduce((sum, log) => sum + Number(log.weight), 0);
    return total / recent.length;
  }, [sortedLogs]);

  const thirtyDayTrend = useMemo(() => {
    if (sortedLogs.length < 2) return null;

    const newest = sortedLogs[0];
    const oldest = sortedLogs[sortedLogs.length - 1];

    const difference = Number(newest.weight) - Number(oldest.weight);

    return {
      difference,
      label:
        difference > 0
          ? `+${difference.toFixed(1)} ${unit}`
          : `${difference.toFixed(1)} ${unit}`,
    };
  }, [sortedLogs, unit]);

  function saveWeight() {
    const parsedWeight = Number(weight);

    if (!weight || Number.isNaN(parsedWeight) || parsedWeight <= 0) {
      setMessage("Enter a valid weight signal.");
      return;
    }

    setMessage(null);

    startTransition(async () => {
      const { data: rawData, error } = await supabase
  .rpc("upsert_weight_log", {
    target_date: today,
    target_weight: parsedWeight,
    target_unit: unit,
    target_note: null,
  })
  .single();

      if (error) {
        console.error("Weight save failed:", error.message);
        setMessage(`Save failed: ${error.message}`);
        return;
      }

      if (!rawData) {
  setMessage("Weight saved, but no saved record was returned.");
  return;
}

const data = rawData as unknown as SavedWeightLogRow;

      setLogs((current) => {
        const withoutToday = current.filter((log) => log.date !== today);

        return [
          {
            id: data.id,
            date: data.date,
            weight: Number(data.weight),
            unit: data.unit,
            note: data.note,
          },
          ...withoutToday,
        ];
      });

      setMessage("Body data signal logged.");
    });
  }

  return (
    <TerminalBlock title="body.data.input">
      <div className="grid gap-4 md:grid-cols-[1fr_0.8fr]">
        <div>
          <p className="terminal-muted mb-3 text-xs leading-6">
  &gt; Track the number. Do not overthink the signal. Trends matter more than
  single-day noise.
</p>

          <div className="grid gap-3 sm:grid-cols-[1fr_100px]">
            <label className="block">
              <span className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
                Today&apos;s weight
              </span>
              <input
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
                inputMode="decimal"
                className="mt-2 w-full border border-[#242424] bg-[#050505] px-3 py-3 text-sm text-[#e5e5e5] outline-none focus:border-[#39ff88]"
                placeholder="185.0"
              />
            </label>

            <label className="block">
              <span className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
                Unit
              </span>
              <select
                value={unit}
                onChange={(event) => setUnit(event.target.value as "lbs" | "kg")}
                className="mt-2 w-full border border-[#242424] bg-[#050505] px-3 py-3 text-sm text-[#e5e5e5] outline-none focus:border-[#39ff88]"
              >
                <option value="lbs">lbs</option>
                <option value="kg">kg</option>
              </select>
            </label>
          </div>


          <button
            onClick={saveWeight}
            disabled={isPending}
            className="mt-4 border border-[#39ff88] bg-[#050505] px-4 py-3 text-left text-sm text-[#39ff88] transition hover:bg-[#0d0d0d] disabled:cursor-not-allowed disabled:opacity-60"
          >
            &gt; {isPending ? "saving body_data..." : "save body_data"}
          </button>

          {message ? (
            <p className="mt-3 text-xs text-[#ffb020]">&gt; {message}</p>
          ) : null}
        </div>

        <div className="border border-[#242424] bg-[#080808] p-3">
          <TerminalRow
            label="TODAY"
            value={todayLog ? `${Number(todayLog.weight).toFixed(1)} ${todayLog.unit}` : "AWAITING INPUT"}
            green={Boolean(todayLog)}
          />
          <TerminalRow
            label="7-DAY AVG"
            value={
              sevenDayAverage
                ? `${sevenDayAverage.toFixed(1)} ${unit}`
                : "NO DATA"
            }
          />
          <TerminalRow
            label="30-DAY TREND"
            value={thirtyDayTrend ? thirtyDayTrend.label : "NO DATA"}
          />

          <p className="terminal-muted mt-4 text-xs leading-6">
            &gt; Weight naturally moves from water, food, salt, stress, and
            training. Trend matters more than one signal.
          </p>
        </div>
      </div>

      <div className="mt-5">
        <p className="terminal-green mb-2 text-xs uppercase tracking-[0.2em]">
          &gt; recent.body.signals
        </p>

        <div className="max-h-[220px] overflow-y-auto border border-[#242424]">
  {sortedLogs.length > 0 ? (
    sortedLogs.slice(0, 14).map((log, index) => {
      return (
        <div
          key={`${log.id ?? "weight-log"}-${log.date}-${index}`}
          className="terminal-line grid grid-cols-[100px_1fr] gap-3 px-3 py-2 text-xs"
        >
          <span className="terminal-muted">{log.date}</span>
          <span>
            <span className="terminal-green">
              {Number(log.weight).toFixed(1)} {log.unit}
            </span>
            {log.note ? (
              <span className="terminal-muted"> — {log.note}</span>
            ) : null}
          </span>
        </div>
      );
    })
  ) : (
    <p className="terminal-muted p-3 text-xs">
      &gt; No body data signals logged yet.
    </p>
  )}
</div>
      </div>
    </TerminalBlock>
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
      <span className="terminal-muted text-xs">{label}</span>
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