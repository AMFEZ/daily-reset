const morningProtocol = [
  "Wake up",
  "No fap",
  "Dream journal",
  "Affirmations / gratitude",
  "Greatest version question",
  "LBRP",
  "Make bed",
  "Log daily weight",
  "Water w/ creatine",
  "Vitamins",
  "Protein breakfast",
  "Manual floss",
  "Waterpik",
  "Mouthwash",
];

const dailyProtocols = [
  "Meditate",
  "Read",
  "Duolingo",
  "Earpeggio",
  "Shoulder mobility",
  "Hip mobility",
  "Leg stretches",
  "TMJ exercises",
  "Stick work",
  "Foam roller",
  "Water w/ electrolytes",
];

const shutdownProtocol = [
  "Brush teeth",
  "Manual floss",
  "Waterpik",
  "Mouthwash",
  "Shower",
  "Wash face",
  "Recall / gratitude",
  "Visualize next day",
  "Shadow work",
  "Night stretches",
  "Phone away from bed",
  "Mouth tape",
];

export default function Home() {
  return (
    <main className="min-h-screen px-3 py-4 text-sm text-[#e5e5e5] md:px-8 md:py-8">
      <section className="mx-auto max-w-6xl">
        <div className="terminal-window overflow-hidden rounded-lg">
          <div className="terminal-titlebar flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#ff4d4d]" />
              <span className="h-3 w-3 rounded-full bg-[#ffb020]" />
              <span className="h-3 w-3 rounded-full bg-[#39ff88]" />
            </div>

            <p className="terminal-muted text-xs">
              daily-reset://the-reprogram
            </p>

            <p className="terminal-dim hidden text-xs md:block">v0.1</p>
          </div>

          <div className="p-4 md:p-6">
            <BootHeader />

            <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4">
                <TerminalBlock title="system.status">
                  <TerminalRow label="APP" value="DAILY RESET: THE REPROGRAM" />
                  <TerminalRow label="SYSTEM STATUS" value="REBUILDING" green />
                  <TerminalRow label="MODE" value="DAILY RESET" />
                  <TerminalRow label="CONSISTENCY SIGNAL" value="000 DAYS" />
                  <TerminalRow label="RESET SCORE" value="0%" green />
                </TerminalBlock>

                <TerminalBlock title="today.protocols">
                  <ProtocolLine name="Morning Reset" status="PENDING" />
                  <ProtocolLine name="Daily Protocols" status="PENDING" />
                  <ProtocolLine name="Body Data Input" status="PENDING" />
                  <ProtocolLine name="Nutrition Input" status="PENDING" />
                  <ProtocolLine name="Dream Archive" status="STANDBY" />
                  <ProtocolLine name="Shadow Console" status="STANDBY" />
                  <ProtocolLine name="Shutdown Protocol" status="PENDING" />
                </TerminalBlock>

                <TerminalBlock title="directive.output">
                  <p className="terminal-green terminal-cursor text-base leading-7">
                    Do not negotiate with the old program.
                  </p>
                  <p className="terminal-muted mt-3 leading-6">
                    Show up today. Log the signal. Rebuild the pattern. Run the
                    reset.
                  </p>
                </TerminalBlock>
              </div>

              <div className="space-y-4">
                <TerminalBlock title="quick.actions">
                  <CommandButton label="run morning_reset.exe" />
                  <CommandButton label="open dream_archive" />
                  <CommandButton label="log body_data" />
                  <CommandButton label="open nutrition_input" />
                  <CommandButton label="open shadow_console" />
                  <CommandButton label="run shutdown_protocol.exe" />
                </TerminalBlock>

                <TerminalBlock title="body.data">
                  <TerminalRow label="WEIGHT LOG" value="AWAITING INPUT" />
                  <TerminalRow label="7-DAY AVG" value="NO DATA" />
                  <TerminalRow label="PROTEIN" value="0G / TARGET" />
                  <TerminalRow label="ORAL CARE" value="NO SIGNAL" />
                </TerminalBlock>

                <TerminalBlock title="dream.archive">
                  <p className="terminal-muted leading-6">
                    Capture the dream before the system deletes it.
                  </p>
                  <p className="terminal-green mt-2">
                    [ RECORD DREAM ] [ TYPE DREAM ]
                  </p>
                </TerminalBlock>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <Checklist title="morning_reset.list" items={morningProtocol} />
              <Checklist title="daily_protocols.list" items={dailyProtocols} />
              <Checklist title="shutdown_protocol.list" items={shutdownProtocol} />
            </div>

            <div className="terminal-muted mt-6 border-t border-[#242424] pt-4 text-xs leading-6">
              <p>&gt; Initializing habit engine...</p>
              <p>&gt; Loading protocol stack...</p>
              <p>&gt; Awaiting first user signal...</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function BootHeader() {
  return (
    <div>
      <p className="terminal-muted text-xs uppercase tracking-[0.35em]">
        Daily Reset
      </p>

      <pre className="terminal-green mt-4 overflow-x-auto text-[10px] leading-[1.15] md:text-sm">
{String.raw`
██████╗  █████╗ ██╗██╗  ██╗   ██╗    ██████╗ ███████╗███████╗███████╗████████╗
██╔══██╗██╔══██╗██║██║  ╚██╗ ██╔╝    ██╔══██╗██╔════╝██╔════╝██╔════╝╚══██╔══╝
██║  ██║███████║██║██║   ╚████╔╝     ██████╔╝█████╗  ███████╗█████╗     ██║   
██║  ██║██╔══██║██║██║    ╚██╔╝      ██╔══██╗██╔══╝  ╚════██║██╔══╝     ██║   
██████╔╝██║  ██║██║███████╗██║       ██║  ██║███████╗███████║███████╗   ██║   
╚═════╝ ╚═╝  ╚═╝╚═╝╚══════╝╚═╝       ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝   ╚═╝   
`}
      </pre>

      <p className="terminal-muted mt-2">
        THE_REPROGRAM initialized. Identity reconstruction module online.
      </p>
    </div>
  );
}

function TerminalBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-[#242424] bg-[#050505]">
      <div className="border-b border-[#242424] bg-[#0d0d0d] px-3 py-2">
        <p className="terminal-green text-xs uppercase tracking-[0.2em]">
          &gt; {title}
        </p>
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
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
    <div className="terminal-line flex items-center justify-between gap-4 py-2">
      <span className="terminal-muted text-xs">{label}</span>
      <span
        className={
          green
            ? "terminal-green text-right text-xs"
            : "text-right text-xs text-[#e5e5e5]"
        }
      >
        {value}
      </span>
    </div>
  );
}

function ProtocolLine({
  name,
  status,
}: {
  name: string;
  status: "PENDING" | "STANDBY" | "COMPLETE";
}) {
  return (
    <div className="terminal-line flex items-center justify-between gap-4 py-2">
      <span>[ ] {name}</span>
      <span className="terminal-muted text-xs">{status}</span>
    </div>
  );
}

function CommandButton({ label }: { label: string }) {
  return (
    <button className="mb-2 block w-full border border-[#242424] bg-[#080808] px-3 py-2 text-left text-xs text-[#39ff88] transition hover:border-[#39ff88] hover:bg-[#0d0d0d]">
      &gt; {label}
    </button>
  );
}

function Checklist({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="border border-[#242424] bg-[#050505]">
      <div className="border-b border-[#242424] bg-[#0d0d0d] px-3 py-2">
        <p className="terminal-green text-xs uppercase tracking-[0.2em]">
          &gt; {title}
        </p>
      </div>

      <div className="max-h-[360px] overflow-y-auto p-3">
        {items.map((item, index) => (
          <div
            key={`${item}-${index}`}
            className="terminal-line flex items-center gap-2 py-2 text-xs"
          >
            <span className="terminal-dim">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="terminal-green">[ ]</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </section>
  );
}