export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-[#39ff88]">
      <section
        role="status"
        aria-live="polite"
        className="w-full max-w-md border border-[#242424] bg-[#050505] p-6"
      >
        <p className="font-mono text-sm tracking-wide">
          &gt; requesting saved data...
        </p>

        <div className="mt-4 h-px w-full overflow-hidden bg-[#1a1a1a]">
          <div className="h-full w-1/3 animate-pulse bg-[#39ff88]" />
        </div>

        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[#777777]">
          restoring protocol state
        </p>
      </section>
    </main>
  );
}