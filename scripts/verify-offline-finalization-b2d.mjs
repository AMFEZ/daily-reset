import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const checks = [
  {
    file: "lib/offlineStore.ts",
    markers: [
      "DATABASE_VERSION = 3",
      "cleanupOrphanedOfflineAudio",
      "cancelPendingAudioForEntity",
      "confirmAudioAlreadyUploaded",
      "conflicts: string[]",
    ],
  },
  {
    file: "app/api/offline-sync/route.ts",
    markers: [
      "[CONFLICT]",
      "audioPath?: string | null",
      "deleteJournal",
      "previousAudioPath",
    ],
  },
  {
    file: "app/api/offline-audio-upload/route.ts",
    markers: [
      "export async function GET",
      "upsert: true",
      "Previous recording cleanup failed",
    ],
  },
  {
    file: "components/reset/DreamArchivePanel.tsx",
    markers: [
      "cancelPendingAudioForEntity",
      "summary.conflicts[0]",
      "const interpretation =",
      "Dream deletion saved on this device",
    ],
    forbidden: ["npm run build"],
  },
  {
    file: "components/reset/ShadowConsolePanel.tsx",
    markers: [
      "cancelPendingAudioForEntity",
      "summary.conflicts[0]",
      "Shadow deletion saved on this device",
    ],
  },
  {
    file: "components/reset/DreamAudioRecorder.tsx",
    markers: [
      "audio secured on this device",
      "await saveOfflineAudio",
    ],
  },
  {
    file: "public/sw.js",
    markers: ['"daily-reset-push-shell-v7"'],
  },
];

let failed = false;

for (const check of checks) {
  let content = "";
  try {
    content = readFileSync(join(root, check.file), "utf8");
  } catch {
    console.error(`FAIL missing ${check.file}`);
    failed = true;
    continue;
  }

  for (const marker of check.markers) {
    if (!content.includes(marker)) {
      console.error(`FAIL ${check.file} missing ${JSON.stringify(marker)}`);
      failed = true;
    }
  }

  for (const forbidden of check.forbidden ?? []) {
    if (content.includes(forbidden)) {
      console.error(`FAIL ${check.file} contains ${JSON.stringify(forbidden)}`);
      failed = true;
    }
  }

  if (!failed) console.log(`PASS ${check.file}`);
}

if (failed) process.exitCode = 1;
else console.log("Offline Finalization B2D verified.");
