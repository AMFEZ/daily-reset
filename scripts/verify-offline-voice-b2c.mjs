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
      "lib/offlineStore.ts",
    markers: [
      'const DATABASE_VERSION = 2;',
      'const AUDIO_STORE = "audio";',
      '"audio-upload"',
      "saveOfflineAudio",
      "syncAudioUpload",
    ],
  },
  {
    file:
      "components/reset/DreamAudioRecorder.tsx",
    markers: [
      "saveOfflineAudio",
      "pendingUpload",
      "25 MB",
      "contextLabel",
    ],
  },
  {
    file:
      "components/reset/DreamArchivePanel.tsx",
    markers: [
      "pendingAudioCapture",
      'kind: "audio-upload"',
      'contextLabel="dream"',
      "createOfflineAudioPreviewUrl",
    ],
  },
  {
    file:
      "components/reset/ShadowConsolePanel.tsx",
    markers: [
      "pendingAudioCapture",
      'kind: "audio-upload"',
      'contextLabel="shadow"',
      "createOfflineAudioPreviewUrl",
    ],
  },
  {
    file:
      "app/api/offline-audio-upload/route.ts",
    markers: [
      'from("dream-audio")',
      "upsert: true",
      "25 MB",
      "audio_path",
    ],
  },
  {
    file:
      "components/offline/OfflineSyncRuntime.tsx",
    markers: [
      'kind === "audio-upload"',
    ],
  },
  {
    file:
      "public/sw.js",
    markers: [
      '"daily-reset-push-shell-v6"',
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

  let fileFailed = false;

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
      fileFailed = true;
    }
  }

  if (!fileFailed) {
    console.log(
      `PASS ${check.file}`
    );
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log(
    "Offline Voice Queue B2C verified."
  );
}
