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
  `.offline-finalization-b2d-backup-${stamp}`,
  "public/sw.js"
);

mkdirSync(dirname(backupPath), { recursive: true });
copyFileSync(workerPath, backupPath);

let source = readFileSync(workerPath, "utf8");

if (source.includes('"daily-reset-push-shell-v6"')) {
  source = source.replace(
    '"daily-reset-push-shell-v6"',
    '"daily-reset-push-shell-v7"'
  );
} else if (!source.includes('"daily-reset-push-shell-v7"')) {
  throw new Error(
    "Expected offline shell v6 was not found. Install Offline Voice Queue B2C first."
  );
}

writeFileSync(workerPath, source, "utf8");

console.log("Offline Finalization B2D patch applied.");
console.log(`Backup: ${backupPath}`);
