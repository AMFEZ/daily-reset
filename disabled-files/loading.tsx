export default function Loading() {
  return (
    <main className="min-h-screen bg-black px-0 py-0 text-sm text-[#e5e5e5] sm:px-3 sm:py-4 md:px-8 md:py-8">
      <section className="mx-auto max-w-7xl">
        <div className="terminal-window min-h-screen overflow-hidden rounded-none sm:min-h-0 sm:rounded-lg">
          <div className="terminal-titlebar flex min-h-[52px] items-center justify-between px-3 py-2 sm:px-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#ff4d4d]" />
              <span className="h-3 w-3 rounded-full bg-[#ffb020]" />
              <span className="h-3 w-3 rounded-full bg-[#39ff88]" />
            </div>

            <p className="terminal-muted text-[10px] uppercase tracking-[0.12em]">
              daily.reset
            </p>

            <span className="terminal-muted text-xs">
              loading
            </span>
          </div>

          <div className="p-3 sm:p-4 md:p-6">
            <div className="border border-[#242424] bg-[#050505] p-4">
              <p className="terminal-green terminal-cursor text-xs uppercase tracking-[0.2em]">
                &gt; boot.sequence
              </p>

              <p className="terminal-muted mt-3 text-xs leading-6">
                &gt; Verifying session...
                <br />
                &gt; Loading protocols...
                <br />
                &gt; Restoring cloud state...
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({
                length: 6,
              }).map((_, index) => (
                <div
                  key={index}
                  className="min-h-[110px] border border-[#242424] bg-[#080808] p-3"
                >
                  <div className="h-3 w-1/3 bg-[#151515]" />
                  <div className="mt-4 h-2 w-full bg-[#111111]" />
                  <div className="mt-2 h-2 w-4/5 bg-[#111111]" />
                  <div className="mt-2 h-2 w-2/3 bg-[#111111]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
