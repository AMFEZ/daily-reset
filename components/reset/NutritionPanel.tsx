"use client";

import {
  useMemo,
  useState,
  useTransition,
} from "react";
import { SignalDisclosure } from "@/components/reset/SignalDisclosure";
import { createClient } from "@/utils/supabase/client";

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
};

type SavedProteinLogRow = {
  log_id: string;
  log_date: string;
  log_amount: number | string;
  log_meal_type: MealType;
  log_note: string | null;
  log_created_at: string;
};

type DeleteProteinResponse = {
  deletedIds?: string[];
  error?: string;
};

type NutritionPanelProps = {
  initialLogs: ProteinLog[];
  proteinTarget?: number;
};

export function NutritionPanel({
  initialLogs,
  proteinTarget = 150,
}: NutritionPanelProps) {
  const supabase = createClient();
  const [isPending, startTransition] =
    useTransition();
  const today = getLocalDateKey();

  const [logs, setLogs] =
    useState<ProteinLog[]>(initialLogs);
  const [amount, setAmount] = useState("");
  const [mealType, setMealType] =
    useState<MealType>("custom");
  const [note, setNote] = useState("");
  const [message, setMessage] =
    useState<string | null>(null);

  const sortedLogs = useMemo(
    () =>
      [...logs].sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
      ),
    [logs]
  );

  const todayLogs = useMemo(
    () =>
      sortedLogs.filter(
        (log) => log.date === today
      ),
    [sortedLogs, today]
  );

  const todayTotal = useMemo(
    () =>
      todayLogs.reduce(
        (sum, log) =>
          sum + Number(log.amount),
        0
      ),
    [todayLogs]
  );

  const progress =
    proteinTarget > 0
      ? Math.min(
          Math.round(
            (todayTotal / proteinTarget) * 100
          ),
          100
        )
      : 0;

  function saveCustomProtein() {
    const parsed = Number(amount);

    if (
      !amount ||
      !Number.isFinite(parsed) ||
      parsed <= 0
    ) {
      setMessage(
        "Enter a valid protein signal."
      );
      return;
    }

    saveProtein(parsed);
  }

  function saveProtein(grams: number) {
    setMessage(null);

    startTransition(async () => {
      const { data: rawData, error } =
        await supabase
          .rpc("add_protein_log", {
            target_date: today,
            target_amount: grams,
            target_meal_type: mealType,
            target_note:
              note.trim() || null,
          })
          .single();

      if (error) {
        setMessage(
          `Save failed: ${error.message}`
        );
        return;
      }

      if (!rawData) {
        setMessage(
          "Protein saved, but no record was returned."
        );
        return;
      }

      const data =
        rawData as unknown as SavedProteinLogRow;

      const savedLog: ProteinLog = {
        id: data.log_id,
        date: data.log_date,
        amount: Number(data.log_amount),
        meal_type: data.log_meal_type,
        note: data.log_note,
        created_at: data.log_created_at,
      };

      setLogs((current) => [
        savedLog,
        ...current,
      ]);
      setAmount("");
      setNote("");
      setMessage(
        `${grams}g protein signal logged.`
      );
    });
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

    removeProteinLogs({
      logId: latestTodayLog.id,
      successMessage: `Removed the latest ${latestTodayLog.amount}g signal.`,
    });
  }

  function resetTodayProtein() {
    if (todayLogs.length === 0) {
      setMessage(
        "Today's protein progress is already empty."
      );
      return;
    }

    const confirmed = window.confirm(
      `Reset today's protein progress and remove ${todayLogs.length} nutrition signal${todayLogs.length === 1 ? "" : "s"}?`
    );

    if (!confirmed) return;

    removeProteinLogs({
      resetDate: today,
      successMessage:
        "Today's protein progress was reset.",
    });
  }

  function removeSingleLog(log: ProteinLog) {
    const confirmed = window.confirm(
      `Remove this ${log.amount}g protein signal?`
    );

    if (!confirmed) return;

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

    startTransition(async () => {
      try {
        const response = await fetch(
          "/api/protein-logs",
          {
            method: "DELETE",
            headers: {
              "Content-Type":
                "application/json",
            },
            credentials: "same-origin",
            cache: "no-store",
            body: JSON.stringify({
              logId,
              resetDate,
            }),
          }
        );

        const payload =
          (await response
            .json()
            .catch(() => null)) as
            | DeleteProteinResponse
            | null;

        if (!response.ok) {
          throw new Error(
            payload?.error ??
              "Protein signal could not be removed."
          );
        }

        const deletedIds = new Set(
          payload?.deletedIds ?? []
        );

        setLogs((current) =>
          current.filter(
            (log) =>
              !deletedIds.has(log.id) &&
              (!resetDate ||
                log.date !== resetDate)
          )
        );

        setMessage(successMessage);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Protein signal could not be removed."
        );
      }
    });
  }

  return (
    <TerminalBlock title="nutrition.input">
      <div className="grid gap-4 md:grid-cols-[1fr_0.8fr]">
        <div>
          <p className="terminal-muted mb-3 text-xs leading-6">
            &gt; Add protein as you eat it. Undo removes
            the newest signal; reset removes every protein
            signal saved today.
          </p>

          <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
            <label className="block">
              <FieldLabel>
                Custom protein grams
              </FieldLabel>
              <input
                value={amount}
                onChange={(event) =>
                  setAmount(event.target.value)
                }
                inputMode="numeric"
                placeholder="25"
                className={inputClassName}
              />
            </label>

            <label className="block">
              <FieldLabel>Meal type</FieldLabel>
              <select
                value={mealType}
                onChange={(event) =>
                  setMealType(
                    event.target
                      .value as MealType
                  )
                }
                className={inputClassName}
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
            <FieldLabel>Optional note</FieldLabel>
            <input
              value={note}
              onChange={(event) =>
                setNote(event.target.value)
              }
              placeholder="eggs, shake, chicken..."
              className={inputClassName}
            />
          </label>

          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            {[10, 20, 30].map((grams) => (
              <button
                key={grams}
                type="button"
                onClick={() =>
                  saveProtein(grams)
                }
                disabled={isPending}
                className={secondaryButton}
              >
                &gt; +{grams}g
              </button>
            ))}

            <button
              type="button"
              onClick={saveCustomProtein}
              disabled={isPending}
              className={primaryButton}
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
              onClick={undoLastProtein}
              disabled={
                isPending ||
                todayLogs.length === 0
              }
              className={secondaryButton}
            >
              &gt; undo_last
            </button>

            <button
              type="button"
              onClick={resetTodayProtein}
              disabled={
                isPending ||
                todayLogs.length === 0
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
            green={todayTotal > 0}
          />
          <TerminalRow
            label="PROGRESS"
            value={`${progress}%`}
            green={progress >= 50}
          />
          <TerminalRow
            label="TODAY'S ENTRIES"
            value={String(todayLogs.length)}
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
            {sortedLogs.length > 0 ? (
              sortedLogs.map((log, index) => (
                <div
                  key={`${log.id}-${log.created_at}-${index}`}
                  className="terminal-line grid gap-3 px-3 py-3 text-xs sm:grid-cols-[100px_70px_1fr_auto]"
                >
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
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      removeSingleLog(log)
                    }
                    disabled={isPending}
                    className="border border-[#242424] px-2 py-1 text-left text-[10px] text-[#ffb020] transition hover:border-[#ffb020] disabled:opacity-40"
                  >
                    remove
                  </button>
                </div>
              ))
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
