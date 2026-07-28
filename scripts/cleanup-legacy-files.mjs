#!/usr/bin/env node

import {
  existsSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import process from "node:process";

const root = process.cwd();
const removed = [];

const duplicateSettings =
  join(
    root,
    "app",
    "components",
    "settings"
  );
const canonicalSettings =
  join(
    root,
    "components",
    "settings"
  );

if (
  existsSync(duplicateSettings) &&
  existsSync(canonicalSettings)
) {
  rmSync(
    duplicateSettings,
    {
      recursive: true,
      force: true,
    }
  );
  removed.push(
    "app/components/settings"
  );
}

for (const entry of readdirSync(root)) {
  if (
    entry.startsWith(
      ".release-gate-backup-"
    )
  ) {
    rmSync(
      join(root, entry),
      {
        recursive: true,
        force: true,
      }
    );
    removed.push(entry);
  }
}

if (removed.length === 0) {
  console.log(
    "No legacy duplicates or release backups found."
  );
} else {
  console.log(
    "Removed:"
  );

  for (const entry of removed) {
    console.log(`- ${entry}`);
  }
}
