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
  removeOfflineOperation,
  readOfflineCache,
  syncOfflineQueue,
  writeOfflineCache,
  type OfflineQueueStatus,
} from "@/lib/offlineStore";
import { dispatchDailyResetDataChanged } from "@/lib/dailyResetEvents";

type MealType =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "snack"
  | "custom";

type ProteinLog = {
  id: string;
  date: string;
  amount: number;
  meal_type: MealType;
  note: string | null;
  created_at: string;
  pending?: boolean;
};

type DeleteProteinResponse = {
  deletedIds?: string[];
  error?: string;
};

type NutritionPanelProps = {
  initialLogs: ProteinLog[];
  proteinTarget?: number;
};

const CACHE_KEY =
  "daily-reset:nutrition-logs:v1";

export function NutritionPanel({
  initialLogs,
  proteinTarget = 150,
}: NutritionPanelProps) {
  const [isPending, startTransition] =
    useTransition();
  const today =
    getLocalDateKey();

  const [logs, setLogs] =
    useState<ProteinLog[]>(
      initialLogs
    );
  const [amount, setAmount] =
    useState("");
  const [mealType, setMealType] =
    useState<MealType>("custom");
  const [note, setNote] =
    useState("");
  const [message, setMessage] =
    useState<string | null>(
      null
    );

  useEffect(() => {
    let cancelled = false;

    if (navigator.onLine) {
      return;
    }

    void readOfflineCache<
      ProteinLog[]
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
        const pendingIds =
          new Set(
            operations
              .filter(
                (operation) =>
                  operation.kind ===
                  "protein"
              )
              .map(
                (operation) =>
                  operation.kind ===
                  "protein"
                    ? operation
                        .payload
                        .entityId
                    : ""
              )
          );

        setLogs((current) =>
          current.map((log) => ({
            ...log,
            pending:
              pendingIds.has(
                log.id
              ),
          }))
        );
      };

    const handleQueue =
      (
        _event: Event
      ) => {
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
          b.created_at.localeCompare(
            a.created_at
          )
      ),
    [logs]
  );

  const todayLogs = useMemo(
    () =>
      sortedLogs.filter(
        (log) =>
          log.date === today
      ),
    [sortedLogs, today]
  );

  const todayTotal = useMemo(
    () =>
      todayLogs.reduce(
        (sum, log) =>
          sum +
          Number(log.amount),
        0
      ),
    [todayLogs]
  );

  const progress =
    proteinTarget > 0
      ? Math.min(
          Math.round(
            (todayTotal /
              proteinTarget) *
              100
          ),
          100
        )
      : 0;

  function saveCustomProtein() {
    const parsed =
      Number(amount);

    if (
      !amount ||
      !Number.isFinite(
        parsed
      ) ||
      parsed <= 0
    ) {
      setMessage(
        "Enter a valid protein signal."
      );
      return;
    }

    saveProtein(parsed);
  }

  function saveProtein(
    grams: number
  ) {
    setMessage(null);

    startTransition(
      async () => {
        const entityId =
          createOfflineEntityId();
        const operationId =
          `protein:${entityId}`;
        const createdAt =
          new Date().toISOString();
        const savedLog: ProteinLog =
          {
            id: entityId,
            date: today,
            amount: grams,
            meal_type:
              mealType,
            note:
              note.trim() ||
              null,
            created_at:
              createdAt,
            pending: true,
          };

        setLogs((current) => [
          savedLog,
          ...current,
        ]);
        setAmount("");
        setNote("");

        try {
          await enqueueOfflineOperation(
            {
              id:
                operationId,
              kind: "protein",
              createdAt,
              payload: {
                entityId,
                date: today,
                amount: grams,
                mealType,
                note:
                  savedLog.note,
                createdAt,
              },
            }
          );

          dispatchDailyResetDataChanged(
            {
              scopes: [
                "nutrition",
                "analytics",
              ],
              source:
                "unknown",
              date: today,
              metrics: {
                todayProtein:
                  todayTotal +
                  grams,
              },
            }
          );

          const summary =
            await syncOfflineQueue();

          const stillPending =
            summary.pending > 0 &&
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
                  log.id ===
                  entityId
                    ? {
                        ...log,
                        pending:
                          stillPending,
                      }
                    : log
              )
          );

          setMessage(
            stillPending
              ? `${grams}g saved offline. It will sync automatically.`
              : `${grams}g protein signal logged.`
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
              : "Protein signal could not be saved locally."
          );
        }
      }
    );
  }

  function undoLastProtein() {
    const latestTodayLog =
      todayLogs[0];

    if (!latestTodayLog) {
      setMessage(
        "There is no protein signal to undo today."
      );
      return;
    }

    removeSingleLog(
      latestTodayLog,
      true
    );
  }

  function resetTodayProtein() {
    if (
      todayLogs.length === 0
    ) {
      setMessage(
        "Today's protein progress is already empty."
      );
      return;
    }

    if (!navigator.onLine) {
      const syncedCount =
        todayLogs.filter(
          (log) =>
            !log.pending
        ).length;

      if (syncedCount > 0) {
        setMessage(
          "Reconnect before resetting already-synced protein entries."
        );
        return;
      }
    }

    const confirmed =
      window.confirm(
        `Reset today's protein progress and remove ${todayLogs.length} nutrition signal${todayLogs.length === 1 ? "" : "s"}?`
      );

    if (!confirmed) {
      return;
    }

    const allPending =
      todayLogs.every(
        (log) =>
          Boolean(log.pending)
      );

    if (allPending) {
      startTransition(
        async () => {
          for (
            const log of
            todayLogs
          ) {
            await removeOfflineOperation(
              `protein:${log.id}`
            );
          }

          setLogs(
            (current) =>
              current.filter(
                (log) =>
                  log.date !==
                  today
              )
          );
          setMessage(
            "Today's pending protein entries were removed."
          );
        }
      );
      return;
    }

    removeProteinLogs({
      resetDate: today,
      successMessage:
        "Today's protein progress was reset.",
    });
  }

  function removeSingleLog(
    log: ProteinLog,
    skipConfirm = false
  ) {
    if (!skipConfirm) {
      const confirmed =
        window.confirm(
          `Remove this ${log.amount}g protein signal?`
        );

      if (!confirmed) {
        return;
      }
    }

    if (log.pending) {
      startTransition(
        async () => {
          await removeOfflineOperation(
            `protein:${log.id}`
          );
          setLogs(
            (current) =>
              current.filter(
                (candidate) =>
                  candidate.id !==
                  log.id
              )
          );
          setMessage(
            "Pending protein signal removed."
          );
        }
      );
      return;
    }

    if (!navigator.onLine) {
      setMessage(
        "Reconnect before removing a synced protein entry."
      );
      return;
    }

    removeProteinLogs({
      logId: log.id,
      successMessage:
        "Protein signal removed.",
    });
  }

  function removeProteinLogs({
    logId,
    resetDate,
    successMessage,
  }: {
    logId?: string;
    resetDate?: string;
    successMessage: string;
  }) {
    setMessage(null);

    startTransition(
      async () => {
        try {
          const response =
            await fetch(
              "/api/protein-logs",
              {
                method:
                  "DELETE",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                credentials:
                  "same-origin",
                cache:
                  "no-store",
                body:
                  JSON.stringify(
                    {
                      logId,
                      resetDate,
                    }
                  ),
              }
            );

          const payload =
            (await response
              .json()
              .catch(
                () => null
              )) as
              | DeleteProteinResponse
              | null;

          if (
            !response.ok
          ) {
            throw new Error(
              payload?.error ??
                "Protein signal could not be removed."
            );
          }

          const deletedIds =
            new Set(
              payload?.deletedIds ??
                []
            );

          setLogs(
            (current) =>
              current.filter(
                (log) =>
                  !deletedIds.has(
                    log.id
                  ) &&
                  (!resetDate ||
                    log.date !==
                      resetDate)
              )
          );

          setMessage(
            successMessage
          );
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Protein signal could not be removed."
          );
        }
      }
    );
  }

  return (
    <TerminalBlock title="nutrition.input">
      <div className="grid gap-4 md:grid-cols-[1fr_0.8fr]">
        <div>
          <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
            <label className="block">
              <FieldLabel>
                Custom protein grams
              </FieldLabel>
              <input
                value={amount}
                onChange={(event) =>
                  setAmount(
                    event.target
                      .value
                  )
                }
                inputMode="numeric"
                className={
                  inputClassName
                }
              />
            </label>

            <label className="block">
              <FieldLabel>
                Meal type
              </FieldLabel>
              <select
                value={mealType}
                onChange={(event) =>
                  setMealType(
                    event.target
                      .value as MealType
                  )
                }
                className={
                  inputClassName
                }
              >
                <option value="breakfast">
                  breakfast
                </option>
                <option value="lunch">
                  lunch
                </option>
                <option value="dinner">
                  dinner
                </option>
                <option value="snack">
                  snack
                </option>
                <option value="custom">
                  custom
                </option>
              </select>
            </label>
          </div>

          <label className="mt-3 block">
            <FieldLabel>
              Optional note
            </FieldLabel>
            <input
              value={note}
              onChange={(event) =>
                setNote(
                  event.target.value
                )
              }
              className={
                inputClassName
              }
            />
          </label>

          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            {[10, 20, 30].map(
              (grams) => (
                <button
                  key={grams}
                  type="button"
                  onClick={() =>
                    saveProtein(
                      grams
                    )
                  }
                  disabled={
                    isPending
                  }
                  className={
                    secondaryButton
                  }
                >
                  &gt; +{grams}g
                </button>
              )
            )}

            <button
              type="button"
              onClick={
                saveCustomProtein
              }
              disabled={isPending}
              className={
                primaryButton
              }
            >
              &gt;{" "}
              {isPending
                ? "working..."
                : "save"}
            </button>
          </div>

          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={
                undoLastProtein
              }
              disabled={
                isPending ||
                todayLogs.length ===
                  0
              }
              className={
                secondaryButton
              }
            >
              &gt; undo_last
            </button>

            <button
              type="button"
              onClick={
                resetTodayProtein
              }
              disabled={
                isPending ||
                todayLogs.length ===
                  0
              }
              className="min-h-[48px] border border-[#ffb020] bg-[#050505] px-3 py-3 text-left text-sm text-[#ffb020] transition hover:bg-[#0d0d0d] disabled:cursor-not-allowed disabled:opacity-40"
            >
              &gt; reset_today
            </button>
          </div>

          {message ? (
            <p className="mt-3 text-xs text-[#ffb020]">
              &gt; {message}
            </p>
          ) : null}
        </div>

        <div className="border border-[#242424] bg-[#080808] p-3">
          <TerminalRow
            label="TODAY"
            value={`${todayTotal}g / ${proteinTarget}g`}
            green={
              todayTotal > 0
            }
          />
          <TerminalRow
            label="PROGRESS"
            value={`${progress}%`}
            green={
              progress >= 50
            }
          />
          <TerminalRow
            label="TODAY'S ENTRIES"
            value={String(
              todayLogs.length
            )}
          />
          <TerminalRow
            label="PENDING SYNC"
            value={String(
              todayLogs.filter(
                (log) =>
                  log.pending
              ).length
            )}
            green={
              todayLogs.some(
                (log) =>
                  log.pending
              )
            }
          />

          <div className="mt-3 h-3 overflow-hidden border border-[#242424] bg-[#050505]">
            <div
              className="h-full bg-[#39ff88] transition-all"
              style={{
                width: `${progress}%`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="mt-5">
        <SignalDisclosure
          title="recent.nutrition.signals"
          count={sortedLogs.length}
          summary="Protein history and correction controls"
        >
          <div className="max-h-[360px] overflow-y-auto border border-[#242424]">
            {sortedLogs.length >
            0 ? (
              sortedLogs.map(
                (log, index) => (
                  <SignalEntryDisclosure
                    key={`${log.id}-${log.created_at}-${index}`}
                    title={`${log.amount}g · ${log.meal_type}`}
                    meta={
                      log.pending
                        ? `${log.date} · pending sync`
                        : log.date
                    }
                  >
                    <div className="grid gap-3 sm:grid-cols-[100px_70px_1fr_auto] sm:items-center">
                      <span className="terminal-muted">
                        {log.date}
                      </span>
                      <span className="terminal-green">
                        {log.amount}g
                      </span>
                      <span>
                        {log.meal_type}
                        {log.note ? (
                          <span className="terminal-muted">
                            {" "}
                            — {log.note}
                          </span>
                        ) : null}
                        {log.pending ? (
                          <span className="ml-2 text-[#ffb020]">
                            [pending]
                          </span>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          removeSingleLog(
                            log
                          )
                        }
                        disabled={
                          isPending
                        }
                        className="border border-[#242424] px-2 py-1 text-left text-[10px] text-[#ffb020] transition hover:border-[#ffb020] disabled:opacity-40"
                      >
                        remove
                      </button>
                    </div>
                  </SignalEntryDisclosure>
                )
              )
            ) : (
              <p className="terminal-muted p-3 text-xs">
                &gt; No nutrition signals logged yet.
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
const secondaryButton =
  "min-h-[48px] border border-[#242424] bg-[#050505] px-3 py-3 text-left text-sm text-[#39ff88] transition hover:border-[#39ff88] disabled:cursor-not-allowed disabled:opacity-40";
const primaryButton =
  "min-h-[48px] border border-[#39ff88] bg-[#050505] px-3 py-3 text-left text-sm text-[#39ff88] transition hover:bg-[#0d0d0d] disabled:cursor-not-allowed disabled:opacity-40";

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

function getLocalDateKey() {
  const now = new Date();
  const offset =
    now.getTimezoneOffset() *
    60_000;

  return new Date(
    now.getTime() - offset
  )
    .toISOString()
    .slice(0, 10);
}
