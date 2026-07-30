import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const checks = [
  ["lib/offlineStore.ts", ["JournalOfflineOperation", 'kind: "journal"']],
  ["app/api/offline-sync/route.ts", ['operation.kind ===\\n    "journal"', 'from("journal_entries")']],
  ["components/reset/DreamArchivePanel.tsx", ["DREAM_CACHE_KEY", "Dream saved offline"]],
  ["components/reset/ShadowConsolePanel.tsx", ["SHADOW_CACHE_KEY", "Shadow entry saved offline"]],
  ["public/sw.js", ['"daily-reset-push-shell-v4"']],
];

let failed = false;
for (const [file, markers] of checks) {
  const content = readFileSync(join(root, file), "utf8");
  const missing = markers.filter((marker) => !content.includes(marker));
  if (missing.length) {
    failed = true;
    console.error(`FAIL ${file}: ${missing.join(", ")}`);
  } else {
    console.log(`PASS ${file}`);
  }
}

if (failed) process.exitCode = 1;
else console.log("Offline Journal B2A verified.");
