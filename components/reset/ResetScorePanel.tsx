"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/utils/supabase/client";

type ResetScorePanelProps = {
  totalProtocols: number;
  completedProtocols: number;
};

export function ResetScorePanel({
  totalProtocols,
  completedProtocols,
}: ResetScorePanelProps) {
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const score =
    totalProtocols > 0
      ? Math.round((completedProtocols / totalProtocols) * 100)
      : 0;

  const status = getSystemStatus(score);
  const signal = getConsistencySignal(score);

  function saveResetScore() {
    const today = new Date().toISOString().slice(0, 10);

    setMessage(null);

    startTransition(async () => {
      const { error } = await supabase.rpc("upsert_daily_reset_score", {
        target_date: today,
        target_reset_score: score,
        target_completed_protocols: completedProtocols,
        target_total_protocols: totalProtocols,
        target_system_status: status,
        target_consistency_signal: signal,
      });

      if (error) {
        console.error("Reset score save failed:", error.message);
        setMessage(`Save failed: ${error.message}`);
        return;
      }

      setMessage("Reset score saved.");
    });
  }

  return (
    <section className="border border-[#242424] bg-[#000000]">
      <div className="grid gap-3 p-3 md:grid-cols-[180px_1fr]">
        <div className="flex items-center justify-between border border-[#242424] bg-[#050505] px-3 py-3 md:block">
          <div>
            <p className="terminal-muted text-[10px] uppercase tracking-[0.2em]">
              RESET SCORE
            </p>

            <p className="terminal-green mt-1 text-3xl font-semibold">
              {score}%
            </p>
          </div>

          <p className="terminal-muted text-right text-[10px] md:mt-2 md:text-left">
            {completedProtocols} / {totalProtocols} complete
          </p>
        </div>

        <div className="border border-[#242424] bg-[#050505] p-3">
          <div className="grid gap-x-4 md:grid-cols-3">
            <TerminalRow label="SYSTEM" value={status} green={score >= 50} />
            <TerminalRow label="SIGNAL" value={signal} green={score >= 50} />
            <TerminalRow
              label="PROTOCOLS"
              value={`${completedProtocols}/${totalProtocols}`}
              green={completedProtocols > 0}
            />
          </div>

          <div className="mt-3 h-2 border border-[#242424] bg-[#000000]">
            <div
              className="h-full bg-[#39ff88]"
              style={{ width: `${score}%` }}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="terminal-muted text-[11px] leading-5">
              &gt; Minimum version counts. The system does not require
              perfection.
            </p>

            <button
              type="button"
              onClick={saveResetScore}
              disabled={isPending}
              className="border border-[#39ff88] bg-[#000000] px-3 py-2 text-left text-[11px] text-[#39ff88] transition hover:bg-[#050505] disabled:cursor-not-allowed disabled:opacity-60"
            >
              &gt; {isPending ? "saving_reset..." : "save_daily_reset"}
            </button>
          </div>

          {message ? (
            <p className="mt-2 text-[11px] text-[#ffb020]">&gt; {message}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function getSystemStatus(score: number) {
  if (score >= 90) return "IDENTITY UPDATED";
  if (score >= 70) return "REBUILDING STRONG";
  if (score >= 50) return "REBUILDING";
  if (score >= 25) return "SIGNAL WEAK";
  return "SYSTEM NEEDS INPUT";
}

function getConsistencySignal(score: number) {
  if (score >= 90) return "LOCKED IN";
  if (score >= 70) return "ACTIVE";
  if (score >= 50) return "DETECTED";
  if (score >= 25) return "UNSTABLE";
  return "AWAITING";
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
    <div className="terminal-line flex items-center justify-between gap-3 py-1">
      <span className="terminal-muted text-[10px]">{label}</span>
      <span
        className={
          green
            ? "terminal-green text-right text-[10px]"
            : "text-right text-[10px] text-[#e5e5e5]"
        }
      >
        {value}
      </span>
    </div>
  );
}