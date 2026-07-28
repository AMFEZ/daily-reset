"use client";

import { useMemo, useState, useTransition } from "react";
import { createClient } from "@/utils/supabase/client";

export type ResetGoal = {
  id: string;
  title: string;
  goal_type: "number" | "milestone";
  current_value: number;
  target_value: number;
  unit: string | null;
  deadline: string | null;
  status: "active" | "complete" | "paused";
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type GoalsPanelProps = {
  initialGoals: ResetGoal[];
};

export function GoalsPanel({
  initialGoals,
}: GoalsPanelProps) {
  const supabase = createClient();
  const [isPending, startTransition] =
    useTransition();
  const [goals, setGoals] =
    useState<ResetGoal[]>(initialGoals);
  const [title, setTitle] = useState("");
  const [goalType, setGoalType] =
    useState<ResetGoal["goal_type"]>("number");
  const [currentValue, setCurrentValue] =
    useState("0");
  const [targetValue, setTargetValue] =
    useState("1");
  const [unit, setUnit] = useState("");
  const [deadline, setDeadline] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] =
    useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const sortedGoals = useMemo(
    () =>
      [...goals].sort((a, b) => {
        if (a.status === b.status) {
          return b.updated_at.localeCompare(
            a.updated_at
          );
        }

        return a.status === "active" ? -1 : 1;
      }),
    [goals]
  );

  function saveGoal() {
    const cleanTitle = title.trim();
    const current = Number(currentValue);
    const target = Number(targetValue);

    if (!cleanTitle) {
      setMessageType("error");
      setMessage("Enter a goal title.");
      return;
    }

    if (
      !Number.isFinite(current) ||
      !Number.isFinite(target) ||
      target <= 0
    ) {
      setMessageType("error");
      setMessage(
        "Current and target values must be valid numbers."
      );
      return;
    }

    setMessage(null);

    startTransition(async () => {
      const { data, error } = await supabase
        .from("reset_goals")
        .insert({
          title: cleanTitle,
          goal_type: goalType,
          current_value: current,
          target_value: target,
          unit: unit.trim() || null,
          deadline: deadline || null,
          notes: notes.trim() || null,
        })
        .select(
          "id, title, goal_type, current_value, target_value, unit, deadline, status, notes, created_at, updated_at"
        )
        .single();

      if (error) {
        setMessageType("error");
        setMessage(`Save failed: ${error.message}`);
        return;
      }

      setGoals((currentGoals) => [
        normalizeGoal(data),
        ...currentGoals,
      ]);
      setTitle("");
      setCurrentValue("0");
      setTargetValue("1");
      setUnit("");
      setDeadline("");
      setNotes("");
      setMessageType("success");
      setMessage("> goal saved");
    });
  }

  function updateGoal(
    goal: ResetGoal,
    patch: Partial<ResetGoal>
  ) {
    setMessage(null);

    startTransition(async () => {
      const { data, error } = await supabase
        .from("reset_goals")
        .update(patch)
        .eq("id", goal.id)
        .select(
          "id, title, goal_type, current_value, target_value, unit, deadline, status, notes, created_at, updated_at"
        )
        .single();

      if (error) {
        setMessageType("error");
        setMessage(`Update failed: ${error.message}`);
        return;
      }

      const next = normalizeGoal(data);
      setGoals((currentGoals) =>
        currentGoals.map((item) =>
          item.id === next.id ? next : item
        )
      );
      setMessageType("success");
      setMessage("> goal updated");
    });
  }

  function deleteGoal(goal: ResetGoal) {
    if (!window.confirm(`Delete "${goal.title}"?`)) {
      return;
    }

    setMessage(null);

    startTransition(async () => {
      const { error } = await supabase
        .from("reset_goals")
        .delete()
        .eq("id", goal.id);

      if (error) {
        setMessageType("error");
        setMessage(`Delete failed: ${error.message}`);
        return;
      }

      setGoals((currentGoals) =>
        currentGoals.filter(
          (item) => item.id !== goal.id
        )
      );
      setMessageType("success");
      setMessage("> goal deleted");
    });
  }

  return (
    <section className="border border-[#242424] bg-[#000000]">
      <div className="border-b border-[#242424] bg-[#050505] px-3 py-2">
        <p className="terminal-green text-xs uppercase tracking-[0.2em]">
          &gt; goals.milestones
        </p>
      </div>

      <div className="p-3">
        <details className="border border-[#242424] bg-[#050505]">
          <summary className="cursor-pointer list-none px-3 py-3 text-xs uppercase tracking-[0.18em] text-[#39ff88] [&::-webkit-details-marker]:hidden">
            &gt; create.goal
          </summary>

          <div className="grid gap-3 border-t border-[#242424] p-3 md:grid-cols-2">
            <Field
              label="Goal"
              value={title}
              onChange={setTitle}
            />

            <label className="block">
              <span className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
                Goal type
              </span>
              <select
                value={goalType}
                onChange={(event) =>
                  setGoalType(
                    event.target
                      .value as ResetGoal["goal_type"]
                  )
                }
                className="mt-2 min-h-[48px] w-full border border-[#242424] bg-black px-3 text-sm text-[#e5e5e5] outline-none focus:border-[#39ff88]"
              >
                <option value="number">
                  Numeric progress
                </option>
                <option value="milestone">
                  Milestone progress
                </option>
              </select>
            </label>

            <Field
              label="Current"
              value={currentValue}
              onChange={setCurrentValue}
              type="number"
            />

            <Field
              label="Target"
              value={targetValue}
              onChange={setTargetValue}
              type="number"
            />

            <Field
              label="Unit"
              value={unit}
              onChange={setUnit}
            />

            <Field
              label="Deadline"
              value={deadline}
              onChange={setDeadline}
              type="date"
            />

            <label className="block md:col-span-2">
              <span className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
                Notes
              </span>
              <textarea
                value={notes}
                onChange={(event) =>
                  setNotes(event.target.value)
                }
                className="mt-2 min-h-[96px] w-full border border-[#242424] bg-black px-3 py-3 text-sm text-[#e5e5e5] outline-none focus:border-[#39ff88]"
              />
            </label>

            <button
              type="button"
              onClick={saveGoal}
              disabled={isPending}
              className="min-h-[48px] border border-[#39ff88] bg-black px-3 text-left text-xs text-[#39ff88] disabled:opacity-50 md:col-span-2"
            >
              &gt;{" "}
              {isPending
                ? "saving_goal..."
                : "save_goal"}
            </button>
          </div>
        </details>

        {message ? (
          <p role="status" className={`mt-3 border px-3 py-2 text-xs ${messageType === "error" ? "border-[#ff4d4d] text-[#ff4d4d]" : "border-[#242424] text-[#39ff88]"}`}>
            {message}
          </p>
        ) : null}

        <div className="mt-4 space-y-3">
          {sortedGoals.length > 0 ? (
            sortedGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                pending={isPending}
                onUpdate={updateGoal}
                onDelete={deleteGoal}
              />
            ))
          ) : (
            <p className="terminal-muted text-xs">
              &gt; No goals recorded yet. Create one measurable outcome above.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function GoalCard({
  goal,
  pending,
  onUpdate,
  onDelete,
}: {
  goal: ResetGoal;
  pending: boolean;
  onUpdate: (
    goal: ResetGoal,
    patch: Partial<ResetGoal>
  ) => void;
  onDelete: (goal: ResetGoal) => void;
}) {
  const [value, setValue] = useState(
    String(goal.current_value)
  );
  const progress = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        (goal.current_value /
          goal.target_value) *
          100
      )
    )
  );

  return (
    <details className="border border-[#242424] bg-[#050505]">
      <summary className="cursor-pointer list-none p-3 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center justify-between gap-3">
          <span
            className={
              goal.status === "complete"
                ? "text-[#7a7a7a] line-through"
                : "terminal-green"
            }
          >
            {goal.title}
          </span>
          <span className="terminal-muted text-xs">
            {progress}%
          </span>
        </div>

        <div className="mt-2 h-2 overflow-hidden border border-[#242424] bg-black">
          <div
            className="h-full bg-[#39ff88]"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="terminal-muted mt-2 text-xs">
          {goal.current_value} /{" "}
          {goal.target_value}{" "}
          {goal.unit ?? ""}
          {goal.deadline
            ? ` · ${goal.deadline}`
            : ""}
        </p>
      </summary>

      <div className="border-t border-[#242424] p-3">
        {goal.notes ? (
          <p className="terminal-muted mb-3 whitespace-pre-wrap text-xs leading-6">
            {goal.notes}
          </p>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            type="number"
            value={value}
            onChange={(event) =>
              setValue(event.target.value)
            }
            className="min-h-[48px] border border-[#242424] bg-black px-3 text-sm text-[#e5e5e5] outline-none focus:border-[#39ff88]"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              onUpdate(goal, {
                current_value: Number(value),
                status:
                  Number(value) >=
                  goal.target_value
                    ? "complete"
                    : "active",
              })
            }
            className="min-h-[48px] border border-[#39ff88] bg-black px-3 text-xs text-[#39ff88] disabled:opacity-50"
          >
            update_progress
          </button>
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              onUpdate(goal, {
                status:
                  goal.status === "paused"
                    ? "active"
                    : "paused",
              })
            }
            className="min-h-[44px] border border-[#242424] bg-black px-3 text-left text-xs text-[#e5e5e5] disabled:cursor-not-allowed disabled:opacity-50"
          >
            &gt;{" "}
            {goal.status === "paused"
              ? "resume"
              : "pause"}
          </button>

          <button
            type="button"
            disabled={pending}
            onClick={() => onDelete(goal)}
            className="min-h-[44px] border border-[#ff4d4d] bg-black px-3 text-left text-xs text-[#ff4d4d] disabled:cursor-not-allowed disabled:opacity-50"
          >
            &gt; delete
          </button>
        </div>
      </div>
    </details>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        className="mt-2 min-h-[48px] w-full border border-[#242424] bg-black px-3 text-sm text-[#e5e5e5] outline-none focus:border-[#39ff88]"
      />
    </label>
  );
}

function normalizeGoal(
  row: Record<string, unknown>
): ResetGoal {
  return {
    id: String(row.id),
    title: String(row.title),
    goal_type:
      row.goal_type === "milestone"
        ? "milestone"
        : "number",
    current_value: Number(
      row.current_value ?? 0
    ),
    target_value: Number(
      row.target_value ?? 1
    ),
    unit:
      typeof row.unit === "string"
        ? row.unit
        : null,
    deadline:
      typeof row.deadline === "string"
        ? row.deadline
        : null,
    status:
      row.status === "complete" ||
      row.status === "paused"
        ? row.status
        : "active",
    notes:
      typeof row.notes === "string"
        ? row.notes
        : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}
