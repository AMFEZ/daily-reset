import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const pagePath = join(root, "app/page.tsx");

if (!existsSync(pagePath)) {
  throw new Error("Missing app/page.tsx");
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = join(
  root,
  `.shadow-workflow-backup-${stamp}`,
  "app/page.tsx"
);

mkdirSync(dirname(backupPath), { recursive: true });
copyFileSync(pagePath, backupPath);

let source = readFileSync(pagePath, "utf8");

if (!source.includes("const shadowReflections =")) {
  const totalProtocolsMarker = "\n  const totalProtocols";
  const insertAt = source.indexOf(totalProtocolsMarker);

  if (insertAt < 0) {
    throw new Error(
      "Could not find const totalProtocols in app/page.tsx."
    );
  }

  const declaration = `
  const shadowReflections =
    aiReflections.filter(
      (reflection) =>
        reflection.reflection_type ===
        "shadow"
    );
`;

  source =
    source.slice(0, insertAt) +
    declaration +
    source.slice(insertAt);
}

const panelMarker = "<ShadowConsolePanel";
const panelStart = source.indexOf(panelMarker);

if (panelStart < 0) {
  throw new Error(
    "Could not find ShadowConsolePanel in app/page.tsx."
  );
}

const panelClose = source.indexOf("                  />", panelStart);

if (panelClose < 0) {
  throw new Error(
    "Could not find ShadowConsolePanel closing tag."
  );
}

const panelBlock = source.slice(panelStart, panelClose);

if (!panelBlock.includes("initialReflections=")) {
  const prop = `
                    initialReflections={shadowReflections.map(
                      (reflection) => ({
                        id: reflection.id,
                        journal_entry_id:
                          reflection.journal_entry_id ??
                          "",
                        reflection_type: "shadow",
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
                      })
                    )}
`;

  source =
    source.slice(0, panelClose) +
    prop +
    source.slice(panelClose);
}

writeFileSync(pagePath, source, "utf8");

console.log("Shadow workflow page patch applied.");
console.log(`Backup: ${backupPath}`);
