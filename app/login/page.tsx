import { login, signup } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const params = await searchParams;
  const message = params.message;

  return (
    <main className="min-h-screen px-4 py-8 text-[#e5e5e5]">
      <section className="mx-auto max-w-xl">
        <div className="terminal-window overflow-hidden rounded-lg">
          <div className="terminal-titlebar flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#ff4d4d]" />
              <span className="h-3 w-3 rounded-full bg-[#ffb020]" />
              <span className="h-3 w-3 rounded-full bg-[#39ff88]" />
            </div>

            <p className="terminal-muted text-xs">daily-reset://auth</p>
            <p className="terminal-dim hidden text-xs md:block">v0.2</p>
          </div>

          <div className="p-5 md:p-7">
            <p className="terminal-muted text-xs uppercase tracking-[0.35em]">
              Access Terminal
            </p>

            <h1 className="terminal-green mt-3 text-2xl font-bold uppercase md:text-3xl">
              Daily Reset
            </h1>

            <p className="terminal-muted mt-3 text-sm leading-6">
              Enter your credentials to access The Reprogram.
            </p>

            {message ? (
              <div className="mt-5 border border-[#242424] bg-[#050505] p-3 text-sm text-[#ffb020]">
                &gt; {message}
              </div>
            ) : null}

            <form className="mt-6 space-y-4">
              <label className="block">
                <span className="terminal-muted text-xs uppercase tracking-[0.2em]">
                  Email
                </span>
                <input
                  name="email"
                  type="email"
                  required
                  className="mt-2 w-full border border-[#242424] bg-[#050505] px-3 py-3 text-sm text-[#e5e5e5] outline-none focus:border-[#39ff88]"
                  placeholder="you@email.com"
                />
              </label>

              <label className="block">
                <span className="terminal-muted text-xs uppercase tracking-[0.2em]">
                  Password
                </span>
                <input
                  name="password"
                  type="password"
                  required
                  className="mt-2 w-full border border-[#242424] bg-[#050505] px-3 py-3 text-sm text-[#e5e5e5] outline-none focus:border-[#39ff88]"
                  placeholder="••••••••"
                />
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <button
                  formAction={login}
                  className="border border-[#39ff88] bg-[#050505] px-4 py-3 text-left text-sm text-[#39ff88] transition hover:bg-[#0d0d0d]"
                >
                  &gt; login
                </button>

                <button
                  formAction={signup}
                  className="border border-[#242424] bg-[#050505] px-4 py-3 text-left text-sm text-[#e5e5e5] transition hover:border-[#39ff88]"
                >
                  &gt; create account
                </button>
              </div>
            </form>

            <div className="terminal-muted mt-6 border-t border-[#242424] pt-4 text-xs leading-6">
              <p>&gt; Auth module online.</p>
              <p>&gt; Private reset terminal locked.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}