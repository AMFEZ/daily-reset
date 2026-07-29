import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");
const backupRoot = join(
  root,
  `.dream-workflow-backup-${stamp}`
);

const files = [
  "app/page.tsx",
  "components/reset/ResetDashboard.tsx",
];

for (const relativePath of files) {
  const sourcePath = join(
    root,
    relativePath
  );

  if (!existsSync(sourcePath)) {
    throw new Error(
      `Missing ${relativePath}`
    );
  }

  const backupPath = join(
    backupRoot,
    relativePath
  );

  mkdirSync(
    dirname(backupPath),
    {
      recursive: true,
    }
  );

  copyFileSync(
    sourcePath,
    backupPath
  );
}

patchPage();
patchDashboard();

console.log(
  `Build A patches applied. Backup: ${backupRoot}`
);

function replaceRequired(
  source,
  search,
  replacement,
  label
) {
  if (!source.includes(search)) {
    throw new Error(
      `Patch anchor not found: ${label}`
    );
  }

  return source.replace(
    search,
    replacement
  );
}

function patchPage() {
  const path = join(
    root,
    "app/page.tsx"
  );
  let source =
    readFileSync(path, "utf8");

  source = replaceRequired(
    source,
    '"id, entry_type, title, content, mood, energy, tags, audio_path, raw_transcript, cleaned_transcript, created_at"',
    '"id, entry_type, title, content, mood, energy, tags, symbols, audio_path, raw_transcript, cleaned_transcript, created_at"',
    "journal query symbols"
  );

  source = replaceRequired(
    source,
    `  const activeGoalCount =
    reprogramDesires.length;

`,
    "",
    "active goal count calculation"
  );

  source = replaceRequired(
    source,
    `              activeGoalCount={
                activeGoalCount
              }
`,
    "",
    "active goal dashboard prop"
  );

  source = replaceRequired(
    source,
    `                        tags: entry.tags,
                        audio_path: entry.audio_path,`,
    `                        tags: entry.tags,
                        symbols: entry.symbols,
                        audio_path: entry.audio_path,`,
    "dream symbols mapping"
  );

  writeFileSync(
    path,
    source,
    "utf8"
  );
}

function patchDashboard() {
  const path = join(
    root,
    "components/reset/ResetDashboard.tsx"
  );
  let source =
    readFileSync(path, "utf8");

  source = replaceRequired(
    source,
    `  activeGoalCount: number;
`,
    "",
    "dashboard prop type"
  );

  source = replaceRequired(
    source,
    `  activeGoalCount,
  children,`,
    `  children,`,
    "dashboard prop destructure"
  );

  source = replaceRequired(
    source,
    `        activeGoalCount={activeGoalCount}
`,
    "",
    "command center prop"
  );

  source = replaceRequired(
    source,
    `            <JumpButton
              label="open goals_milestones"
              targetId="goals-milestones"
            />
`,
    "",
    "goals quick action"
  );

  source = replaceRequired(
    source,
    `            <JumpButton
              label="open ai_reflection"
              targetId="ai-reflection"
            />
`,
    "",
    "AI reflection quick action"
  );

  source = replaceRequired(
    source,
    `  activeGoalCount,
}: {`,
    `}: {`,
    "command center destructure"
  );

  source = replaceRequired(
    source,
    `  activeGoalCount: number;
`,
    "",
    "command center prop type"
  );

  source = replaceRequired(
    source,
    `        <CommandSignal
          label="ACTIVE GOALS"
          value={String(activeGoalCount)}
        />
`,
    "",
    "active goals signal"
  );

  source = replaceRequired(
    source,
    `      <div className="border-b border-[#242424] bg-[#0d0d0d] px-3 py-2">`,
    `      <div className="border-b border-[#365341] bg-[linear-gradient(90deg,#07130b_0%,#050805_65%,#050505_100%)] px-3 py-3">`,
    "checklist header"
  );

  source = replaceRequired(
    source,
    `              className="terminal-green text-sm tracking-[0.08em]"`,
    `              className="terminal-green text-base font-semibold tracking-[0.06em] sm:text-lg"`,
    "checklist title"
  );

  source = replaceRequired(
    source,
    `      <div className="border-b border-[#242424] bg-[#0d0d0d] px-3 py-2">
        <p className="terminal-green text-xs uppercase tracking-[0.2em]">`,
    `      <div className="border-b border-[#365341] bg-[linear-gradient(90deg,#07130b_0%,#050805_65%,#050505_100%)] px-3 py-3">
        <p className="terminal-green text-sm font-semibold tracking-[0.06em] sm:text-base">`,
    "terminal block title"
  );

  writeFileSync(
    path,
    source,
    "utf8"
  );
}
