import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-black p-3 text-sm text-[#e5e5e5]">
      <section className="w-full max-w-xl border border-[#242424] bg-[#050505]">
        <div className="border-b border-[#242424] bg-[#0d0d0d] px-4 py-3">
          <p className="terminal-green text-xs uppercase tracking-[0.2em]">
            &gt; route.not_found
          </p>
        </div>

        <div className="p-4">
          <p className="text-lg text-[#e5e5e5]">
            404 / Unknown command
          </p>

          <p className="terminal-muted mt-3 text-xs leading-6">
            &gt; The requested Daily Reset route does
            not exist.
          </p>

          <Link
            href="/"
            className="mt-4 block min-h-[48px] border border-[#39ff88] bg-[#080808] px-4 py-3 text-sm text-[#39ff88]"
          >
            &gt; return_home
          </Link>
        </div>
      </section>
    </main>
  );
}
