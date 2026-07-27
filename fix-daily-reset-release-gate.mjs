#!/usr/bin/env node

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
  relative,
} from "node:path";
import process from "node:process";

const root = process.cwd();
const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");
const backupRoot = join(
  root,
  `.release-gate-backup-${stamp}`
);

const changed = [];
const skipped = [];

function replaceOnce(
  text,
  oldValue,
  newValue,
  label
) {
  if (text.includes(newValue)) {
    return text;
  }

  const index = text.indexOf(oldValue);

  if (index < 0) {
    throw new Error(
      `${label}: expected text was not found.`
    );
  }

  return (
    text.slice(0, index) +
    newValue +
    text.slice(index + oldValue.length)
  );
}

function insertBeforeOnce(
  text,
  needle,
  insertion,
  label
) {
  const combined = `${insertion}\n${needle}`;

  if (text.includes(combined)) {
    return text;
  }

  return replaceOnce(
    text,
    needle,
    combined,
    label
  );
}

function patchFile(relativePath, transform) {
  const path = join(root, relativePath);

  if (!existsSync(path)) {
    throw new Error(
      `${relativePath}: file was not found.`
    );
  }

  const original = readFileSync(
    path,
    "utf8"
  );
  const updated = transform(original);

  if (updated === original) {
    skipped.push(relativePath);
    return;
  }

  const backupPath = join(
    backupRoot,
    relativePath
  );

  mkdirSync(
    dirname(backupPath),
    { recursive: true }
  );
  copyFileSync(path, backupPath);
  writeFileSync(path, updated, "utf8");
  changed.push(relativePath);
}

function patchOptional(
  relativePath,
  transform
) {
  if (!existsSync(join(root, relativePath))) {
    skipped.push(
      `${relativePath} (not present)`
    );
    return;
  }

  patchFile(relativePath, transform);
}

// ---------------------------------------------------------
// Release checker: do not scan its own pattern definitions.
// Also recognize the existing .env* gitignore rule.
// ---------------------------------------------------------
patchFile(
  "scripts/release-readiness.mjs",
  (input) => {
    let text = input;

    text = replaceOnce(
      text,
      'import { extname, join, relative } from "node:path";\nimport process from "node:process";',
      'import { extname, join, relative } from "node:path";\nimport { fileURLToPath } from "node:url";\nimport process from "node:process";',
      "release checker URL import"
    );

    text = replaceOnce(
      text,
      "const root = process.cwd();\nconst skipBuild =",
      "const root = process.cwd();\nconst currentScriptPath =\n  fileURLToPath(import.meta.url);\nconst skipBuild =",
      "release checker script path"
    );

    text = replaceOnce(
      text,
      '  if (\n    gitignore.includes(".env*.local") ||',
      '  if (\n    gitignore.includes(".env*") ||\n    gitignore.includes(".env*.local") ||',
      "release checker gitignore detection"
    );

    text = replaceOnce(
      text,
      "  for (const file of sourceFiles) {\n    const content = readFileSync(",
      "  for (const file of sourceFiles) {\n    if (file === currentScriptPath) {\n      continue;\n    }\n\n    const content = readFileSync(",
      "release checker self exclusion"
    );

    return text;
  }
);

// ---------------------------------------------------------
// Generated-type script warning.
// ---------------------------------------------------------
patchFile(
  "scripts/generate-database-types.mjs",
  (input) =>
    replaceOnce(
      input,
      'import {\n  dirname,\n  join,\n} from "node:path";',
      'import {\n  join,\n} from "node:path";',
      "unused dirname import"
    )
);

// ---------------------------------------------------------
// Targeted effect annotations. These effects intentionally
// hydrate browser-only state or synchronize server props.
// ---------------------------------------------------------
for (const file of [
  "app/components/settings/DataSafetyPanel.tsx",
  "components/settings/DataSafetyPanel.tsx",
]) {
  patchOptional(file, (input) =>
    insertBeforeOnce(
      input,
      "    setLastExportAt(",
      "    // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydrate browser-only export metadata after mount.",
      `${file} last export hydration`
    )
  );
}

for (const file of [
  "app/components/settings/SettingsHub.tsx",
  "components/settings/SettingsHub.tsx",
]) {
  patchOptional(file, (input) => {
    let text = insertBeforeOnce(
      input,
      "    setHasMounted(true);",
      "    // eslint-disable-next-line react-hooks/set-state-in-effect -- Mark client hydration after the first browser mount.",
      `${file} mount state`
    );

    text = insertBeforeOnce(
      text,
      "      setIsOpen(true);",
      "      // eslint-disable-next-line react-hooks/set-state-in-effect -- Restore the browser-only persisted disclosure state.",
      `${file} persisted open state`
    );

    return text;
  });
}

for (const file of [
  "app/components/settings/ProductionDeploymentPanel.tsx",
  "components/settings/ProductionDeploymentPanel.tsx",
]) {
  patchOptional(file, (input) => {
    let text = insertBeforeOnce(
      input,
      "    setBrowserState(readBrowserState());",
      "    // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydrate browser-only deployment state after mount.",
      `${file} deployment hydration`
    );

    if (
      file ===
        "components/settings/ProductionDeploymentPanel.tsx" &&
      text.includes("    void refreshStatus();")
    ) {
      text = insertBeforeOnce(
        text,
        "    void refreshStatus();",
        "    // eslint-disable-next-line react-hooks/immutability -- The function declaration is hoisted and stable for this mount-only refresh.",
        `${file} mount refresh`
      );
    }

    return text;
  });
}

patchOptional(
  "components/pwa/PWAController.tsx",
  (input) => {
    let text = insertBeforeOnce(
      input,
      "    setIsStandalone(standalone);",
      "    // eslint-disable-next-line react-hooks/set-state-in-effect -- Read install mode from browser APIs after mount.",
      "PWA standalone state"
    );
    text = insertBeforeOnce(
      text,
      "    setIsIOS(ios);",
      "    // eslint-disable-next-line react-hooks/set-state-in-effect -- Read platform state from browser APIs after mount.",
      "PWA iOS state"
    );
    text = insertBeforeOnce(
      text,
      "    setIsDismissed(",
      "    // eslint-disable-next-line react-hooks/set-state-in-effect -- Restore browser-only dismissal state after mount.",
      "PWA dismissal state"
    );
    return text;
  }
);

patchOptional(
  "components/reminders/ReminderSettingsPanel.tsx",
  (input) => {
    let text = insertBeforeOnce(
      input,
      '      setPermission("unsupported");',
      "      // eslint-disable-next-line react-hooks/set-state-in-effect -- Notification support is available only after browser mount.",
      "unsupported notification state"
    );
    text = insertBeforeOnce(
      text,
      "    setPermission(Notification.permission);",
      "    // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydrate the current browser permission after mount.",
      "notification permission state"
    );
    return text;
  }
);

patchOptional(
  "components/reset/ProtocolManagerPanel.tsx",
  (input) =>
    insertBeforeOnce(
      input,
      "    setProtocols(",
      "    // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronize editable local protocol state when server props change.",
      "protocol prop synchronization"
    )
);

patchOptional(
  "components/reset/ReprogramJournalPanel.tsx",
  (input) =>
    insertBeforeOnce(
      input,
      "    setIsOpen(false);",
      "    // eslint-disable-next-line react-hooks/set-state-in-effect -- Close the disclosure when its explicit reset key changes.",
      "Reprogram history reset"
    )
);

patchOptional(
  "components/reset/ResetDashboard.tsx",
  (input) => {
    let text = insertBeforeOnce(
      input,
      "    setLiveTodayProtein(todayProtein);",
      "    // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronize local live metric state when server props change.",
      "dashboard protein prop synchronization"
    );
    text = insertBeforeOnce(
      text,
      "    setLiveLatestWeight(latestWeight);",
      "    // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronize local live metric state when server props change.",
      "dashboard weight prop synchronization"
    );
    text = insertBeforeOnce(
      text,
      "    setLiveWeightUnit(weightUnit);",
      "    // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronize the local display unit when server props change.",
      "dashboard weight unit synchronization"
    );
    return text;
  }
);

patchOptional(
  "components/settings/ReleaseReadinessPanel.tsx",
  (input) =>
    insertBeforeOnce(
      input,
      "        setManualChecks({",
      "        // eslint-disable-next-line react-hooks/set-state-in-effect -- Restore browser-only manual audit state after mount.",
      "manual release audit hydration"
    )
);

// ---------------------------------------------------------
// Real JSX lint fix and preservation of the RPC null fix.
// ---------------------------------------------------------
patchOptional(
  "components/reset/ShadowConsolePanel.tsx",
  (input) => {
    let text = input.replace(
      "TODAY'S QUESTION",
      "TODAY&apos;S QUESTION"
    );

    text = text.replace(
      /\n\s*target_energy:\s*null,?/,
      ""
    );

    return text;
  }
);

console.log("\nDaily Reset release-gate patch complete.\n");
console.log(
  `Backup: ${relative(root, backupRoot)}`
);
console.log(`Changed: ${changed.length}`);

for (const file of changed) {
  console.log(`  PATCHED ${file}`);
}

if (skipped.length > 0) {
  console.log(`Skipped: ${skipped.length}`);

  for (const file of skipped) {
    console.log(`  SKIPPED ${file}`);
  }
}

console.log(
  "\nNext commands:\n  npm run lint\n  npm run release:check"
);
