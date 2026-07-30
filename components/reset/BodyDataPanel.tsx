"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { SignalDisclosure } from "@/components/reset/SignalDisclosure";
import { SignalEntryDisclosure } from "@/components/reset/SignalEntryDisclosure";
import {
  OFFLINE_QUEUE_EVENT,
  createOfflineEntityId,
  enqueueOfflineOperation,
  getOfflineOperations,
  readOfflineCache,
  syncOfflineQueue,
  writeOfflineCache,
} from "@/lib/offlineStore";
import { dispatchDailyResetDataChanged } from "@/lib/dailyResetEvents";

type WeightUnit =
  | "lbs"
  | "kg";

type WeightLog = {
  id: string;
  date: string;
  weight: number;
  unit: WeightUnit;
  note: string | null;
  pending?: boolean;
};

type BodyDataPanelProps = {
  initialLogs: WeightLog[];
  timeZone: string;
};

const CACHE_KEY =
  "daily-reset:weight-logs:v1";

export function BodyDataPanel({
  initialLogs,
  timeZone,
}: BodyDataPanelProps) {
  const [isPending, startTransition] =
    useTransition();
  const [logs, setLogs] =
    useState<WeightLog[]>(
      initialLogs
    );
  const [weight, setWeight] =
    useState("");
  const [unit, setUnit] =
    useState<WeightUnit>(
      initialLogs[0]?.unit ??
        "lbs"
    );
  const [message, setMessage] =
    useState<string | null>(
      null
    );

  const today =
    getDateKey(timeZone);

  useEffect(() => {
    let cancelled = false;

    if (navigator.onLine) {
      return;
    }

    void readOfflineCache<
      WeightLog[]
    >(CACHE_KEY).then(
      (cached) => {
        if (
          !cancelled &&
          cached &&
          cached.length > 0
        ) {
          setLogs(cached);
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void writeOfflineCache(
      CACHE_KEY,
      logs
    );
  }, [logs]);

  useEffect(() => {
    const refreshPending =
      async () => {
        const operations =
          await getOfflineOperations();
        const pendingDates =
          new Set(
            operations
              .filter(
                (operation) =>
                  operation.kind ===
                  "weight"
              )
              .map(
                (operation) =>
                  operation.kind ===
                  "weight"
                    ? operation
                        .payload
                        .date
                    : ""
              )
          );

        setLogs((current) =>
          current.map((log) => ({
            ...log,
            pending:
              pendingDates.has(
                log.date
              ),
          }))
        );
      };

    const handleQueue =
      () => {
        void refreshPending();
      };

    window.addEventListener(
      OFFLINE_QUEUE_EVENT,
      handleQueue
    );

    void refreshPending();

    return () => {
      window.removeEventListener(
        OFFLINE_QUEUE_EVENT,
        handleQueue
      );
    };
  }, []);

  const sortedLogs = useMemo(
    () =>
      [...logs].sort(
        (a, b) =>
          b.date.localeCompare(
            a.date
          )
      ),
    [logs]
  );

  const latest =
    sortedLogs[0] ?? null;
  const previous =
    sortedLogs[1] ?? null;

  const trend = useMemo(() => {
    if (
      !latest ||
      !previous ||
      latest.unit !==
        previous.unit
    ) {
      return "NO TREND";
    }

    const difference =
      latest.weight -
      previous.weight;

    if (
      Math.abs(difference) <
      0.01
    ) {
      return "STABLE";
    }

    return `${difference > 0 ? "+" : ""}${difference.toFixed(
      1
    )} ${latest.unit}`;
  }, [latest, previous]);

  function saveWeight() {
    const parsedWeight =
      Number(weight);

    if (
      !weight ||
      !Number.isFinite(
        parsedWeight
      ) ||
      parsedWeight <= 0
    ) {
      setMessage(
        "Enter a valid weight."
      );
      return;
    }

    setMessage(null);

    startTransition(
      async () => {
        const entityId =
          createOfflineEntityId();
        const operationId =
          `weight:${today}`;
        const createdAt =
          new Date().toISOString();
        const savedLog: WeightLog =
          {
            id: entityId,
            date: today,
            weight:
              parsedWeight,
            unit,
            note: null,
            pending: true,
          };

        setLogs((current) => [
          savedLog,
          ...current.filter(
            (log) =>
              log.date !== today
          ),
        ]);
        setWeight("");

        try {
          await enqueueOfflineOperation(
            {
              id:
                operationId,
              kind: "weight",
              createdAt,
              payload: {
                entityId,
                date: today,
                weight:
                  parsedWeight,
                unit,
                note: null,
              },
            }
          );

          dispatchDailyResetDataChanged(
            {
              scopes: ["body"],
              source:
                "weight",
              date: today,
              metrics: {
                latestWeight:
                  parsedWeight,
                weightUnit:
                  unit,
              },
            }
          );

          const summary =
            await syncOfflineQueue();
          const stillPending =
            (
              await getOfflineOperations()
            ).some(
              (operation) =>
                operation.id ===
                operationId
            );

          setLogs(
            (current) =>
              current.map(
                (log) =>
                  log.date ===
                  today
                    ? {
                        ...log,
                        pending:
                          stillPending,
                      }
                    : log
              )
          );

          setMessage(
            stillPending ||
              summary.errors.length >
                0
              ? "Body signal saved offline. It will sync automatically."
              : "Today's body signal saved."
          );
        } catch (error) {
          setLogs(
            (current) =>
              current.filter(
                (log) =>
                  log.id !==
                  entityId
              )
          );
          setMessage(
            error instanceof Error
              ? error.message
              : "Body signal could not be saved locally."
          );
        }
      }
    );
  }

  return (
    <TerminalBlock title="body.data">
      <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <div>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_150px]">
            <div className="border border-[#242424] bg-[#080808] px-3 py-3">
              <FieldLabel>
                App day
              </FieldLabel>
              <p className="terminal-green mt-2 text-sm">
                {today}
              </p>
            </div>

            <label className="block">
              <FieldLabel>
                Weight
              </FieldLabel>
              <input
                value={weight}
                onChange={(event) =>
                  setWeight(
                    event.target
                      .value
                  )
                }
                inputMode="decimal"
                className={
                  inputClassName
                }
              />
            </label>

            <label className="block">
              <FieldLabel>
                Unit
              </FieldLabel>
              <select
                value={unit}
                onChange={(event) =>
                  setUnit(
                    event.target
                      .value as WeightUnit
                  )
                }
                className={
                  inputClassName
                }
              >
                <option value="lbs">
                  lbs
                </option>
                <option value="kg">
                  kg
                </option>
              </select>
            </label>
          </div>

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
            green={
              Boolean(latest)
            }
          />
          <TerminalRow
            label="DATE"
            value={
              latest?.date ?? "--"
            }
          />
          <TerminalRow
            label="CHANGE"
            value={trend}
            green={
              trend === "STABLE"
            }
          />
          <TerminalRow
            label="SAVED DAYS"
            value={String(
              logs.length
            )}
            green={
              logs.length > 0
            }
          />
          <TerminalRow
            label="SYNC"
            value={
              latest?.pending
                ? "PENDING"
                : "CURRENT"
            }
            green={
              Boolean(
                latest?.pending
              )
            }
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
            {sortedLogs.length >
            0 ? (
              sortedLogs.map(
                (log, index) => (
                  <SignalEntryDisclosure
                    key={`${log.id}-${log.date}-${index}`}
                    title={`${log.weight} ${log.unit}`}
                    meta={
                      log.pending
                        ? `${log.date} · pending sync`
                        : log.date
                    }
                  >
                    <div className="grid gap-2 sm:grid-cols-[110px_100px_1fr]">
                      <span className="terminal-muted">
                        {log.date}
                      </span>
                      <span className="terminal-green">
                        {log.weight}{" "}
                        {log.unit}
                      </span>
                      <span className="terminal-muted">
                        {log.pending
                          ? "Saved locally — pending sync"
                          : log.note ??
                            "Body signal"}
                      </span>
                    </div>
                  </SignalEntryDisclosure>
                )
              )
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
  children:
    React.ReactNode;
}) {
  return (
    <span className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
      {children}
    </span>
  );
}

function TerminalBlock({
  children,
}: {
  title: string;
  children:
    React.ReactNode;
}) {
  return (
    <div className="p-3">
      {children}
    </div>
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

function getDateKey(
  timeZone: string
) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(new Date());
}
