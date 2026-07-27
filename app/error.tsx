"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      "Daily Reset route error:",
      error
    );
  }, [error]);

  return (
    <main className="min-h-screen bg-black px-4 py-12 text-[#e5e5e5]">
      <section className="mx-auto max-w-2xl border border-[#5a1f1f] bg-[#080404]">
        <header className="border-b border-[#5a1f1f] px-4 py-3">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#ff6b6b]">
            &gt; system.error
          </p>
        </header>

        <div className="space-y-4 p-4 font-mono">
          <h1 className="text-lg text-[#ff6b6b]">
            Daily Reset hit a recoverable error.
          </h1>

          <p className="text-sm leading-6 text-[#a3a3a3]">
            Your saved data has not been deleted.
            Retry the current screen first. Reload
            only if the problem continues.
          </p>

          {error.digest ? (
            <p className="break-all text-xs text-[#737373]">
              &gt; error_id: {error.digest}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={reset}
              className="min-h-[44px] border border-[#39ff88] px-4 text-left text-xs text-[#39ff88] transition hover:bg-[#041008] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#39ff88] focus-visible:ring-inset"
            >
              retry current screen
            </button>

            <button
              type="button"
              onClick={() =>
                window.location.reload()
              }
              className="min-h-[44px] border border-[#242424] px-4 text-left text-xs text-[#a3a3a3] transition hover:border-[#e5e5e5] hover:text-[#e5e5e5] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#e5e5e5] focus-visible:ring-inset"
            >
              reload application
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
