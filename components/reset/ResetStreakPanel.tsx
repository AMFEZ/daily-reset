import type { ResetStreakStats } from "@/utils/reset-streak";

type ResetStreakPanelProps = {
  stats: ResetStreakStats;
};

function dayLabel(value: number) {
  return value === 1 ? "DAY" : "DAYS";
}

export function ResetStreakPanel({
  stats,
}: ResetStreakPanelProps) {
  const statusClassName =
    stats.savedLast7 === 0
      ? "text-[#ffb020]"
      : "terminal-green";

  return (
    <section className="border border-[#242424] bg-[#050505]">
      <div className="border-b border-[#242424] bg-[#0d0d0d] px-3 py-2">
        <p className="terminal-green text-xs uppercase tracking-[0.2em]">
          &gt; streak.engine
        </p>
      </div>

      <div className="p-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="CURRENT STREAK"
            value={`${stats.currentStreak} ${dayLabel(
              stats.currentStreak
            )}`}
            green={stats.currentStreak > 0}
          />

          <Metric
            label="BEST STREAK"
            value={`${stats.bestStreak} ${dayLabel(stats.bestStreak)}`}
          />

          <Metric
            label="LAST 7 DAYS"
            value={`${stats.savedLast7} / 7`}
            green={stats.savedLast7 >= 5}
          />

          <div className="border border-[#242424] bg-[#080808] p-3">
            <p className="terminal-muted text-[10px] uppercase tracking-[0.18em]">
              CONSISTENCY STATUS
            </p>

            <p
              className={`mt-2 text-sm font-medium ${statusClassName}`}
            >
              {stats.consistencyStatus}
            </p>
          </div>
        </div>

        <div className="terminal-muted mt-3 border-t border-[#242424] pt-3 text-xs leading-6">
          <p>&gt; {stats.statusMessage}</p>

          {stats.lastSavedDate ? (
            <p>
              &gt; Last saved reset:{" "}
              <span className="text-[#e5e5e5]">
                {stats.lastSavedDate}
              </span>
            </p>
          ) : null}

          <p>
            &gt; Total recorded reset days:{" "}
            <span className="text-[#e5e5e5]">
              {stats.totalSavedDays}
            </span>
          </p>
        </div>
      </div>
    </section>
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
            ? "terminal-green mt-2 text-xl"
            : "mt-2 text-xl text-[#e5e5e5]"
        }
      >
        {value}
      </p>
    </div>
  );
}