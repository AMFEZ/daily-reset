"use client";

import { useMemo, useState, useTransition } from "react";
import { createClient } from "@/utils/supabase/client";

type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "custom";

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

type NutritionPanelProps = {
  initialLogs: ProteinLog[];
  proteinTarget?: number;
};

export function NutritionPanel({
  initialLogs,
  proteinTarget = 150,
}: NutritionPanelProps) {
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  const today = new Date().toISOString().slice(0, 10);

  const [logs, setLogs] = useState<ProteinLog[]>(initialLogs);
  const [amount, setAmount] = useState("");
  const [mealType, setMealType] = useState<MealType>("custom");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const todayLogs = useMemo(() => {
    return logs.filter((log) => log.date === today);
  }, [logs, today]);

  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );
  }, [logs]);

  const todayTotal = useMemo(() => {
    return todayLogs.reduce(
      (sum, log) => sum + Number(log.amount),
      0
    );
  }, [todayLogs]);

  const progress =
    proteinTarget > 0
      ? Math.min(
          Math.round((todayTotal / proteinTarget) * 100),
          100
        )
      : 0;

  function quickAdd(grams: number) {
    saveProtein(grams);
  }

  function saveCustomProtein() {
    const parsedAmount = Number(amount);

    if (
      !amount ||
      Number.isNaN(parsedAmount) ||
      parsedAmount <= 0
    ) {
      setMessage("Enter a valid protein signal.");
      return;
    }

    saveProtein(parsedAmount);
  }

  function saveProtein(grams: number) {
    setMessage(null);

    startTransition(async () => {
      const { data: rawData, error } = await supabase
        .rpc("add_protein_log", {
          target_date: today,
          target_amount: grams,
          target_meal_type: mealType,
          target_note: note.trim() || null,
        })
        .single();

      if (error) {
        console.error(
          "Protein save failed:",
          error.message
        );
        setMessage(`Save failed: ${error.message}`);
        return;
      }

      if (!rawData) {
        setMessage(
          "Protein saved, but no saved record was returned."
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

      setLogs((current) => [savedLog, ...current]);

      setAmount("");
      setNote("");
      setMessage(`${grams}g protein signal logged.`);
    });
  }

  return (
    <TerminalBlock title="nutrition.input">
      <div className="grid gap-4 md:grid-cols-[1fr_0.8fr]">
        <div>
          <p className="terminal-muted mb-3 text-xs leading-6">
            &gt; Track protein first. Full macro system comes
            later.
          </p>

          <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
            <label className="block">
              <span className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
                Custom protein grams
              </span>

              <input
                value={amount}
                onChange={(event) =>
                  setAmount(event.target.value)
                }
                inputMode="numeric"
                className="mt-2 w-full border border-[#242424] bg-[#050505] px-3 py-3 text-sm text-[#e5e5e5] outline-none focus:border-[#39ff88]"
                placeholder="25"
              />
            </label>

            <label className="block">
              <span className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
                Meal type
              </span>

              <select
                value={mealType}
                onChange={(event) =>
                  setMealType(
                    event.target.value as MealType
                  )
                }
                className="mt-2 w-full border border-[#242424] bg-[#050505] px-3 py-3 text-sm text-[#e5e5e5] outline-none focus:border-[#39ff88]"
              >
                <option value="breakfast">breakfast</option>
                <option value="lunch">lunch</option>
                <option value="dinner">dinner</option>
                <option value="snack">snack</option>
                <option value="custom">custom</option>
              </select>
            </label>
          </div>

          <label className="mt-3 block">
            <span className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
              Optional note
            </span>

            <input
              value={note}
              onChange={(event) =>
                setNote(event.target.value)
              }
              className="mt-2 w-full border border-[#242424] bg-[#050505] px-3 py-3 text-sm text-[#e5e5e5] outline-none focus:border-[#39ff88]"
              placeholder="eggs, shake, chicken, yogurt, etc."
            />
          </label>

          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            <button
              type="button"
              onClick={() => quickAdd(10)}
              disabled={isPending}
              className="border border-[#242424] bg-[#050505] px-3 py-3 text-left text-sm text-[#39ff88] transition hover:border-[#39ff88] disabled:cursor-not-allowed disabled:opacity-60"
            >
              &gt; +10g
            </button>

            <button
              type="button"
              onClick={() => quickAdd(20)}
              disabled={isPending}
              className="border border-[#242424] bg-[#050505] px-3 py-3 text-left text-sm text-[#39ff88] transition hover:border-[#39ff88] disabled:cursor-not-allowed disabled:opacity-60"
            >
              &gt; +20g
            </button>

            <button
              type="button"
              onClick={() => quickAdd(30)}
              disabled={isPending}
              className="border border-[#242424] bg-[#050505] px-3 py-3 text-left text-sm text-[#39ff88] transition hover:border-[#39ff88] disabled:cursor-not-allowed disabled:opacity-60"
            >
              &gt; +30g
            </button>

            <button
              type="button"
              onClick={saveCustomProtein}
              disabled={isPending}
              className="border border-[#39ff88] bg-[#050505] px-3 py-3 text-left text-sm text-[#39ff88] transition hover:bg-[#0d0d0d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              &gt; {isPending ? "saving..." : "save"}
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

          <div className="mt-3 h-3 overflow-hidden border border-[#242424] bg-[#050505]">
            <div
              className="h-full bg-[#39ff88] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="terminal-muted mt-4 text-xs leading-6">
            &gt; Protein breakfast is flexible. Oatmeal, eggs,
            yogurt, shake, leftovers — signal still counts.
          </p>
        </div>
      </div>

      <div className="mt-5">
        <p className="terminal-green mb-2 text-xs uppercase tracking-[0.2em]">
          &gt; recent.nutrition.signals
        </p>

        <div className="max-h-[220px] overflow-y-auto border border-[#242424]">
          {sortedLogs.length > 0 ? (
            sortedLogs.slice(0, 14).map((log, index) => (
              <div
                key={`${log.id ?? "protein-log"}-${log.created_at}-${index}`}
                className="terminal-line grid grid-cols-[100px_80px_1fr] gap-3 px-3 py-2 text-xs"
              >
                <span className="terminal-muted">
                  {log.date}
                </span>

                <span className="terminal-green">
                  {log.amount}g
                </span>

                <span>
                  <span>{log.meal_type}</span>

                  {log.note ? (
                    <span className="terminal-muted">
                      {" "}
                      — {log.note}
                    </span>
                  ) : null}
                </span>
              </div>
            ))
          ) : (
            <p className="terminal-muted p-3 text-xs">
              &gt; No nutrition signals logged yet.
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