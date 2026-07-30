import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const withBuild = process.argv.includes("--build");
const worker = readFileSync(join(root, "public/sw.js"), "utf8");
const store = readFileSync(join(root, "lib/offlineStore.ts"), "utf8");

const failures = [];

if (!worker.includes('"daily-reset-push-shell-v7"')) {
  failures.push("service worker is not on shell v7");
}
if (!worker.includes('url.pathname.startsWith(\n        "/api/"')) {
  failures.push("service worker API bypass marker is missing");
}
if (!store.includes("DATABASE_VERSION = 3")) {
  failures.push("IndexedDB schema is not version 3");
}
if (!store.includes("cleanupOrphanedOfflineAudio")) {
  failures.push("orphaned-audio cleanup is missing");
}
if (!store.includes("confirmAudioAlreadyUploaded")) {
  failures.push("interrupted-upload recovery is missing");
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}

console.log("PASS offline source smoke checks");

if (withBuild) {
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(command, ["run", "build"], {
    cwd: root,
    stdio: "inherit",
  });

  if (result.status !== 0) process.exit(result.status ?? 1);
  console.log("PASS production build");
}

console.log("Offline release checkpoint passed.");
