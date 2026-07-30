import {
  readFileSync,
} from "node:fs";
import {
  join,
} from "node:path";

const root = process.cwd();

const hook =
  readFileSync(
    join(
      root,
      "lib/useDailyResetRealtime.ts"
    ),
    "utf8"
  );

const worker =
  readFileSync(
    join(
      root,
      "public/sw.js"
    ),
    "utf8"
  );

const requiredHookMarkers = [
  "CONNECTION_TIMEOUT_MS",
  "navigator.onLine",
  'setStatus("degraded")',
  '"visibilitychange"',
  '"offline"',
  '"online"',
];

for (
  const marker of
  requiredHookMarkers
) {
  if (
    !hook.includes(marker)
  ) {
    throw new Error(
      `Realtime hook marker missing: ${marker}`
    );
  }
}

if (
  !worker.includes(
    '"daily-reset-push-shell-v3"'
  )
) {
  throw new Error(
    "Service worker is not on shell v3."
  );
}

console.log(
  "Cross-device loop fix verified."
);
