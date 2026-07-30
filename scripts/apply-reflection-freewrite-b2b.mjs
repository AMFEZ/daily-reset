import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import {
  dirname,
  join,
} from "node:path";

const root = process.cwd();
const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");
const backupRoot = join(
  root,
  `.reflection-freewrite-b2b-backup-${stamp}`
);

patchPage();
patchWorker();

console.log(
  "Daily Reflection + Freewrite B2B patch applied."
);
console.log(
  `Backup: ${backupRoot}`
);

function backup(relativePath) {
  const sourcePath =
    join(root, relativePath);

  if (!existsSync(sourcePath)) {
    throw new Error(
      `Missing ${relativePath}`
    );
  }

  const backupPath =
    join(
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

  return sourcePath;
}

function patchPage() {
  const pagePath =
    backup("app/page.tsx");
  let source =
    readFileSync(
      pagePath,
      "utf8"
    );

  source = source.replace(
    'import { AIReflectionPanel } from "@/components/reset/AIReflectionPanel";\n',
    ""
  );

  if (
    !source.includes(
      "@/components/reset/ReflectionLogPanel"
    )
  ) {
    const anchor =
      'import { NutritionPanel } from "@/components/reset/NutritionPanel";';

    if (!source.includes(anchor)) {
      throw new Error(
        "NutritionPanel import anchor not found."
      );
    }

    source = source.replace(
      anchor,
      `${anchor}
import { ReflectionLogPanel } from "@/components/reset/ReflectionLogPanel";`
    );
  }

  const moduleStart =
    source.indexOf(
      '<ModuleAccordion\n                  id="ai-reflection"'
    );

  if (moduleStart < 0) {
    if (
      !source.includes(
        'id="reflection-log"'
      )
    ) {
      throw new Error(
        "AI Reflection module anchor not found."
      );
    }
  } else {
    const moduleEnd =
      source.indexOf(
        "</ModuleAccordion>",
        moduleStart
      );

    if (moduleEnd < 0) {
      throw new Error(
        "AI Reflection module closing tag not found."
      );
    }

    const afterModule =
      moduleEnd +
      "</ModuleAccordion>".length;

    const replacement = `<ModuleAccordion
                  id="reflection-log"
                  title="Daily Reflection + Freewrite"
                >
                  <ReflectionLogPanel
                    initialEntries={(journalEntries ?? [])
                      .filter(
                        (entry) =>
                          entry.entry_type ===
                            "reflection" ||
                          entry.entry_type ===
                            "freewrite"
                      )
                      .map((entry) => ({
                        id: entry.id,
                        entry_type:
                          entry.entry_type as
                            | "reflection"
                            | "freewrite",
                        title: entry.title,
                        content:
                          entry.content ?? "",
                        mood: entry.mood,
                        energy: entry.energy,
                        tags: entry.tags,
                        created_at:
                          entry.created_at,
                      }))}
                    initialReflections={(aiReflections ?? [])
                      .filter(
                        (reflection) =>
                          reflection.reflection_type ===
                          "journal"
                      )
                      .map((reflection) => ({
                        id: reflection.id,
                        journal_entry_id:
                          reflection.journal_entry_id ??
                          "",
                        reflection_type:
                          "journal" as const,
                        summary:
                          reflection.summary,
                        pattern_noticed:
                          reflection.pattern_noticed,
                        compassionate_reframe:
                          reflection.compassionate_reframe,
                        questions:
                          reflection.questions,
                        action_step:
                          reflection.action_step,
                        model:
                          reflection.model,
                        created_at:
                          reflection.created_at,
                      }))}
                  />
                </ModuleAccordion>`;

    source =
      source.slice(
        0,
        moduleStart
      ) +
      replacement +
      source.slice(
        afterModule
      );
  }

  writeFileSync(
    pagePath,
    source,
    "utf8"
  );
}

function patchWorker() {
  const workerPath =
    backup("public/sw.js");
  let source =
    readFileSync(
      workerPath,
      "utf8"
    );

  if (
    source.includes(
      '"daily-reset-push-shell-v4"'
    )
  ) {
    source = source.replace(
      '"daily-reset-push-shell-v4"',
      '"daily-reset-push-shell-v5"'
    );
  } else if (
    !source.includes(
      '"daily-reset-push-shell-v5"'
    )
  ) {
    throw new Error(
      "Expected offline shell v4 was not found. Install B2A first."
    );
  }

  writeFileSync(
    workerPath,
    source,
    "utf8"
  );
}
