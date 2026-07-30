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
const workerPath =
  join(root, "public/sw.js");

if (!existsSync(workerPath)) {
  throw new Error(
    "Missing public/sw.js"
  );
}

const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");
const backupPath =
  join(
    root,
    `.offline-voice-b2c-backup-${stamp}`,
    "public/sw.js"
  );

mkdirSync(
  dirname(backupPath),
  {
    recursive: true,
  }
);
copyFileSync(
  workerPath,
  backupPath
);

let source =
  readFileSync(
    workerPath,
    "utf8"
  );

if (
  source.includes(
    '"daily-reset-push-shell-v5"'
  )
) {
  source = source.replace(
    '"daily-reset-push-shell-v5"',
    '"daily-reset-push-shell-v6"'
  );
} else if (
  !source.includes(
    '"daily-reset-push-shell-v6"'
  )
) {
  throw new Error(
    "Expected offline shell v5 was not found. Install the Reflection + Freewrite B2B build first."
  );
}

writeFileSync(
  workerPath,
  source,
  "utf8"
);

console.log(
  "Offline Voice Queue B2C patch applied."
);
console.log(
  `Backup: ${backupPath}`
);
