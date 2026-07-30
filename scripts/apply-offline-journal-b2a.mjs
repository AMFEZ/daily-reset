import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const workerPath = join(root, "public/sw.js");

if (!existsSync(workerPath)) {
  throw new Error("Missing public/sw.js");
}

const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");
const backupPath = join(
  root,
  `.offline-journal-b2a-backup-${stamp}`,
  "public/sw.js"
);

mkdirSync(dirname(backupPath), { recursive: true });
copyFileSync(workerPath, backupPath);

let source = readFileSync(workerPath, "utf8");

if (source.includes('"daily-reset-push-shell-v3"')) {
  source = source.replace(
    '"daily-reset-push-shell-v3"',
    '"daily-reset-push-shell-v4"'
  );
} else if (!source.includes('"daily-reset-push-shell-v4"')) {
  throw new Error(
    "Expected offline shell v3 was not found. Install the cross-device loop fix first."
  );
}

writeFileSync(workerPath, source, "utf8");
console.log("Offline journal B2A shell version updated to v4.");
console.log(`Backup: ${backupPath}`);
