"use client";

import {
  useMemo,
  useState,
  useTransition,
} from "react";
import { SignalDisclosure } from "@/components/reset/SignalDisclosure";

type WeightUnit = "lbs" | "kg";

type WeightLog = {
  id: string;
  date: string;
  weight: number;
  unit: WeightUnit;
  note: string | null;
};

type BodyDataPanelProps = {
  initialLogs: WeightLog[];
};

type WeightApiResponse = {
  log?: WeightLog;
  error?: string;
};

export function BodyDataPanel({
  initialLogs,
}: BodyDataPanelProps) {
  const [isPending, startTransition] =
    useTransition();
  const [logs, setLogs] =
    useState<WeightLog[]>(initialLogs);
  const [date, setDate] = useState(
    getLocalDateKey()
  );
  const [weight, setWeight] = useState("");
  const [unit, setUnit] =
    useState<WeightUnit>(
      initialLogs[0]?.unit ?? "lbs"
    );
  const [note, setNote] = useState("");
  const [message, setMessage] =
    useState<string | null>(null);

  const sortedLogs = useMemo(
    () =>
      [...logs].sort((a, b) =>
        b.date.localeCompare(a.date)
      ),
    [logs]
  );

  const latest = sortedLogs[0] ?? null;
  const previous = sortedLogs[1] ?? null;

  const trend = useMemo(() => {
    if (
      !latest ||
      !previous ||
      latest.unit !== previous.unit
    ) {
      return "NO TREND";
    }

    const difference =
      latest.weight - previous.weight;

    if (Math.abs(difference) < 0.01) {
      return "STABLE";
    }

    return `${difference > 0 ? "+" : ""}${difference.toFixed(
      1
    )} ${latest.unit}`;
  }, [latest, previous]);

  function saveWeight() {
    const parsedWeight = Number(weight);

    if (
      !date ||
      !weight ||
      !Number.isFinite(parsedWeight) ||
      parsedWeight <= 0
    ) {
      setMessage(
        "Enter a valid date and weight."
      );
      return;
    }

    setMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch(
          "/api/weight-logs",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            credentials: "same-origin",
            cache: "no-store",
            body: JSON.stringify({
              date,
              weight: parsedWeight,
              unit,
              note: note.trim() || null,
            }),
          }
        );

        const payload =
          (await response
            .json()
            .catch(() => null)) as
            | WeightApiResponse
            | null;

        if (!response.ok || !payload?.log) {
          throw new Error(
            payload?.error ??
              "Weight signal could not be saved."
          );
        }

        setLogs((current) => [
          payload.log as WeightLog,
          ...current.filter(
            (log) =>
              log.id !== payload.log?.id &&
              log.date !== payload.log?.date
          ),
        ]);

        setWeight("");
        setNote("");
        setMessage("Body signal saved.");
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Weight signal could not be saved."
        );
      }
    });
  }

  return (
    <TerminalBlock title="body.data">
      <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <div>
          <p className="terminal-muted mb-3 text-xs leading-6">
            &gt; Log one honest body signal. Saving the
            same date updates that day instead of creating
            a duplicate.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <FieldLabel>Date</FieldLabel>
              <input
                type="date"
                value={date}
                onChange={(event) =>
                  setDate(event.target.value)
                }
                className={inputClassName}
              />
            </label>

            <label className="block">
              <FieldLabel>Weight</FieldLabel>
              <input
                value={weight}
                onChange={(event) =>
                  setWeight(event.target.value)
                }
                inputMode="decimal"
                placeholder="175.0"
                className={inputClassName}
              />
            </label>

            <label className="block">
              <FieldLabel>Unit</FieldLabel>
              <select
                value={unit}
                onChange={(event) =>
                  setUnit(
                    event.target.value as WeightUnit
                  )
                }
                className={inputClassName}
              >
                <option value="lbs">lbs</option>
                <option value="kg">kg</option>
              </select>
            </label>
          </div>

          <label className="mt-3 block">
            <FieldLabel>Optional note</FieldLabel>
            <input
              value={note}
              onChange={(event) =>
                setNote(event.target.value)
              }
              placeholder="sleep, hydration, training..."
              className={inputClassName}
            />
          </label>

          <button
            type="button"
            onClick={saveWeight}
            disabled={isPending}
            className="mt-4 min-h-[50px] w-full border border-[#39ff88] bg-[#050505] px-4 py-3 text-left text-sm text-[#39ff88] transition hover:bg-[#0d0d0d] disabled:cursor-not-allowed disabled:opacity-60"
          >
            &gt;{" "}
            {isPending
              ? "saving body_signal..."
              : "save body_signal"}
          </button>

          {message ? (
            <p className="mt-3 text-xs text-[#ffb020]">
              &gt; {message}
            </p>
          ) : null}
        </div>

        <div className="border border-[#242424] bg-[#080808] p-3">
          <TerminalRow
            label="LATEST"
            value={
              latest
                ? `${latest.weight} ${latest.unit}`
                : "NO SIGNAL"
            }
            green={Boolean(latest)}
          />
          <TerminalRow
            label="DATE"
            value={latest?.date ?? "--"}
          />
          <TerminalRow
            label="CHANGE"
            value={trend}
            green={trend === "STABLE"}
          />
          <TerminalRow
            label="SAVED DAYS"
            value={String(logs.length)}
            green={logs.length > 0}
          />
        </div>
      </div>

      <div className="mt-5">
        <SignalDisclosure
          title="recent.body.signals"
          count={sortedLogs.length}
          summary="Saved weight history"
        >
          <div className="max-h-[320px] overflow-y-auto border border-[#242424]">
            {sortedLogs.length > 0 ? (
              sortedLogs.map((log, index) => (
                <div
                  key={`${log.id}-${log.date}-${index}`}
                  className="terminal-line grid gap-2 px-3 py-3 text-xs sm:grid-cols-[110px_100px_1fr]"
                >
                  <span className="terminal-muted">
                    {log.date}
                  </span>
                  <span className="terminal-green">
                    {log.weight} {log.unit}
                  </span>
                  <span className="terminal-muted">
                    {log.note ?? "No note"}
                  </span>
                </div>
              ))
            ) : (
              <p className="terminal-muted p-3 text-xs">
                &gt; No body signals logged yet.
              </p>
            )}
          </div>
        </SignalDisclosure>
      </div>
    </TerminalBlock>
  );
}

const inputClassName =
  "mt-2 w-full border border-[#242424] bg-[#050505] px-3 py-3 text-sm text-[#e5e5e5] outline-none focus:border-[#39ff88]";

function FieldLabel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
      {children}
    </span>
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

function getLocalDateKey() {
  const now = new Date();
  const offset =
    now.getTimezoneOffset() * 60_000;

  return new Date(
    now.getTime() - offset
  )
    .toISOString()
    .slice(0, 10);
}
