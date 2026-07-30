import {
  readFileSync,
} from "node:fs";
import {
  join,
} from "node:path";

const root = process.cwd();

const checks = [
  {
    file:
      "components/reset/ReflectionLogPanel.tsx",
    markers: [
      "Daily Reflection",
      "Freewrite",
      "journal-delete",
      "run AI reflection",
      "pending sync",
    ],
  },
  {
    file:
      "lib/offlineStore.ts",
    markers: [
      '"journal-delete"',
      '"reflection"',
      '"freewrite"',
    ],
  },
  {
    file:
      "app/api/offline-sync/route.ts",
    markers: [
      'operation.kind ===\n    "journal-delete"',
      '"reflection"',
      '"freewrite"',
      "reflectionDeleteError",
    ],
  },
  {
    file:
      "components/offline/OfflineSyncRuntime.tsx",
    markers: [
      'kind === "journal-delete"',
    ],
  },
  {
    file: "app/page.tsx",
    markers: [
      "ReflectionLogPanel",
      'id="reflection-log"',
      'title="Daily Reflection + Freewrite"',
    ],
    forbidden: [
      "AIReflectionPanel",
      'id="ai-reflection"',
    ],
  },
  {
    file: "public/sw.js",
    markers: [
      '"daily-reset-push-shell-v5"',
    ],
  },
];

let failed = false;

for (const check of checks) {
  const path =
    join(root, check.file);
  let content = "";

  try {
    content =
      readFileSync(
        path,
        "utf8"
      );
  } catch {
    console.error(
      `FAIL missing ${check.file}`
    );
    failed = true;
    continue;
  }

  for (
    const marker of
    check.markers
  ) {
    if (
      !content.includes(marker)
    ) {
      console.error(
        `FAIL ${check.file} missing ${JSON.stringify(marker)}`
      );
      failed = true;
    }
  }

  for (
    const forbidden of
    check.forbidden ?? []
  ) {
    if (
      content.includes(
        forbidden
      )
    ) {
      console.error(
        `FAIL ${check.file} still contains ${JSON.stringify(forbidden)}`
      );
      failed = true;
    }
  }

  if (!failed) {
    console.log(
      `PASS ${check.file}`
    );
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log(
    "Daily Reflection + Freewrite B2B verified."
  );
}
