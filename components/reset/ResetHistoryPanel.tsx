export type ResetScoreLog = {
  id: string;
  date: string;
  morning_score: number;
  daily_score: number;
  night_score: number;
  trust_score: number;
  reset_score: number;
  completed_protocols: number;
  total_protocols: number;
  system_status: string;
  consistency_signal: string;
  created_at: string;
};

type ResetHistoryPanelProps = {
  initialScores: ResetScoreLog[];
};

export function ResetHistoryPanel({
  initialScores,
}: ResetHistoryPanelProps) {
  const sortedScores = [...initialScores].sort(
    (a, b) => b.date.localeCompare(a.date)
  );

  const averageScore =
    sortedScores.length > 0
      ? Math.round(
          sortedScores.reduce(
            (sum, score) =>
              sum + score.reset_score,
            0
          ) / sortedScores.length
        )
      : 0;

  return (
    <section className="border border-[#242424] bg-[#050505]">
      <div className="border-b border-[#242424] bg-[#0d0d0d] px-3 py-2">
        <p className="terminal-green text-xs uppercase tracking-[0.2em]">
          &gt; reset.history
        </p>
      </div>

      <div className="p-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric
            label="SAVED RESETS"
            value={String(sortedScores.length)}
            green={sortedScores.length > 0}
          />
          <Metric
            label="AVERAGE SCORE"
            value={`${averageScore}%`}
            green={averageScore >= 50}
          />
          <Metric
            label="ROUTINE DATA"
            value="CLOUD SYNCED"
            green
          />
        </div>

        <div className="mt-4 max-h-[420px] overflow-auto border border-[#242424]">
          <div className="min-w-[920px]">
            <div className="terminal-muted grid grid-cols-[105px_80px_repeat(4,105px)_120px_1fr] gap-3 border-b border-[#242424] bg-[#080808] px-3 py-2 text-[10px] uppercase tracking-[0.12em]">
              <span>Date</span>
              <span>Reset</span>
              <span>Morning</span>
              <span>Daily</span>
              <span>Night</span>
              <span>Sleep</span>
              <span>Complete</span>
              <span>Signal</span>
            </div>

            {sortedScores.length > 0 ? (
              sortedScores.map((score, index) => (
                <div
                  key={`${score.id}-${score.date}-${index}`}
                  className="terminal-line grid grid-cols-[105px_80px_repeat(4,105px)_120px_1fr] gap-3 px-3 py-3 text-xs"
                >
                  <span className="terminal-muted">
                    {score.date}
                  </span>
                  <ScoreValue value={score.reset_score} />
                  <ScoreValue value={score.morning_score} />
                  <ScoreValue value={score.daily_score} />
                  <ScoreValue value={score.night_score} />
                  <ScoreValue value={score.trust_score} />
                  <span className="text-[#e5e5e5]">
                    {score.completed_protocols} /{" "}
                    {score.total_protocols}
                  </span>
                  <span className="terminal-muted uppercase">
                    {score.consistency_signal}
                  </span>
                </div>
              ))
            ) : (
              <p className="terminal-muted p-3 text-xs">
                &gt; No reset scores saved yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ScoreValue({
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
            ? "terminal-green mt-2 text-lg"
            : "mt-2 text-lg text-[#e5e5e5]"
        }
      >
        {value}
      </p>
    </div>
  );
}