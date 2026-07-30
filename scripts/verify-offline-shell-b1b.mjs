import {
  readFileSync,
} from "node:fs";
import {
  join,
} from "node:path";

const root = process.cwd();

const checks = [
  {
    file: "public/sw.js",
    markers: [
      "CACHE_APP_SHELL",
      "PRIVATE_SHELL_KEY",
      'url.pathname.startsWith("/api/")',
      'self.addEventListener(\n  "push"',
      'self.addEventListener(\n  "fetch"',
    ],
  },
  {
    file:
      "components/pwa/PWAController.tsx",
    markers: [
      "collectShellAssets",
      "CACHE_APP_SHELL",
      "controllerchange",
    ],
  },
  {
    file:
      "public/offline.html",
    markers: [
      "daily_reset.offline",
      "retry_connection",
    ],
  },
];

let failed = false;

for (const check of checks) {
  const path = join(
    root,
    check.file
  );

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

  const missing =
    check.markers.filter(
      (marker) =>
        !content.includes(
          marker
        )
    );

  if (
    missing.length > 0
  ) {
    console.error(
      `FAIL ${check.file}`
    );
    for (
      const marker of
      missing
    ) {
      console.error(
        `  missing: ${JSON.stringify(marker)}`
      );
    }
    failed = true;
  } else {
    console.log(
      `PASS ${check.file}`
    );
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log(
    "Offline shell files verified."
  );
}
