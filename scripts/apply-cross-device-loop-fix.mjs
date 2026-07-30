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
const serviceWorkerPath =
  join(root, "public/sw.js");

if (
  !existsSync(
    serviceWorkerPath
  )
) {
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
    `.cross-device-loop-backup-${stamp}`,
    "public/sw.js"
  );

mkdirSync(
  dirname(backupPath),
  {
    recursive: true,
  }
);
copyFileSync(
  serviceWorkerPath,
  backupPath
);

let source =
  readFileSync(
    serviceWorkerPath,
    "utf8"
  );

if (
  source.includes(
    '"daily-reset-push-shell-v2"'
  )
) {
  source = source.replace(
    '"daily-reset-push-shell-v2"',
    '"daily-reset-push-shell-v3"'
  );
} else if (
  !source.includes(
    '"daily-reset-push-shell-v3"'
  )
) {
  throw new Error(
    "Expected B1B service-worker version was not found."
  );
}

writeFileSync(
  serviceWorkerPath,
  source,
  "utf8"
);

console.log(
  "Service-worker shell cache version updated to v3."
);
console.log(
  `Backup: ${backupPath}`
);
