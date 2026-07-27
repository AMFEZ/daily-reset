import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-black px-4 py-12 text-[#e5e5e5]">
      <section className="mx-auto max-w-2xl border border-[#242424] bg-[#050505]">
        <header className="border-b border-[#242424] bg-[#0d0d0d] px-4 py-3">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#ffb020]">
            &gt; route.not_found
          </p>
        </header>

        <div className="space-y-4 p-4 font-mono">
          <h1 className="text-lg text-[#ffb020]">
            This Daily Reset route does not exist.
          </h1>

          <p className="text-sm leading-6 text-[#a3a3a3]">
            Return to the command center and
            continue today&apos;s protocol.
          </p>

          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center border border-[#39ff88] px-4 text-xs text-[#39ff88] transition hover:bg-[#041008] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#39ff88] focus-visible:ring-inset"
          >
            return to daily reset
          </Link>
        </div>
      </section>
    </main>
  );
}
