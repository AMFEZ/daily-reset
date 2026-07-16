"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      "Daily Reset route error:",
      error
    );
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-black p-3 text-sm text-[#e5e5e5]">
      <section className="w-full max-w-2xl border border-[#ff6b6b] bg-[#050505]">
        <div className="border-b border-[#242424] bg-[#0d0d0d] px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-[#ff6b6b]">
            &gt; system.error
          </p>
        </div>

        <div className="p-4">
          <p className="text-sm text-[#e5e5e5]">
            Daily Reset could not finish loading.
          </p>

          <p className="terminal-muted mt-3 text-xs leading-6">
            &gt; Your Supabase records were not
            deleted. Retry the route, or reload the
            app if the connection changed.
          </p>

          {error.digest ? (
            <p className="terminal-muted mt-3 break-all text-[10px]">
              &gt; error digest: {error.digest}
            </p>
          ) : null}

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={reset}
              className="min-h-[48px] border border-[#39ff88] bg-[#080808] px-4 py-3 text-left text-sm text-[#39ff88]"
            >
              &gt; retry_route
            </button>

            <button
              type="button"
              onClick={() =>
                window.location.reload()
              }
              className="min-h-[48px] border border-[#242424] bg-[#080808] px-4 py-3 text-left text-sm text-[#e5e5e5]"
            >
              &gt; reload_application
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
