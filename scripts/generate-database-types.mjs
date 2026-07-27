#!/usr/bin/env node

import {
  existsSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import {
  join,
} from "node:path";
import {
  spawnSync,
} from "node:child_process";
import process from "node:process";

const root = process.cwd();
const outputPath = join(
  root,
  "types",
  "database.types.ts"
);
const temporaryPath =
  `${outputPath}.tmp`;

function loadEnvironmentFile(
  filename
) {
  const path = join(root, filename);

  if (!existsSync(path)) {
    return;
  }

  const lines = readFileSync(
    path,
    "utf8"
  ).split(/\r?\n/u);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (
      !line ||
      line.startsWith("#")
    ) {
      continue;
    }

    const normalized =
      line.startsWith("export ")
        ? line.slice(7)
        : line;
    const separator =
      normalized.indexOf("=");

    if (separator < 1) {
      continue;
    }

    const key = normalized
      .slice(0, separator)
      .trim();

    if (process.env[key]) {
      continue;
    }

    let value = normalized
      .slice(separator + 1)
      .trim();

    if (
      (
        value.startsWith('"') &&
        value.endsWith('"')
      ) ||
      (
        value.startsWith("'") &&
        value.endsWith("'")
      )
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function resolveProjectReference() {
  const explicit =
    process.env.SUPABASE_PROJECT_REF
      ?.trim();

  if (explicit) {
    return explicit;
  }

  const url =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL
      ?.trim();

  if (!url) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL in .env.local or SUPABASE_PROJECT_REF in your environment."
    );
  }

  const hostname =
    new URL(url).hostname;
  const projectReference =
    hostname.split(".")[0];

  if (
    !projectReference ||
    hostname === projectReference
  ) {
    throw new Error(
      "Could not infer the Supabase project reference from NEXT_PUBLIC_SUPABASE_URL. Set SUPABASE_PROJECT_REF explicitly."
    );
  }

  return projectReference;
}

for (const filename of [
  ".env",
  ".env.local",
  ".env.production",
  ".env.production.local",
]) {
  loadEnvironmentFile(filename);
}

let projectReference;

try {
  projectReference =
    resolveProjectReference();
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : String(error)
  );
  process.exit(1);
}

const executable =
  process.platform === "win32"
    ? "npx.cmd"
    : "npx";

console.log(
  `Generating Supabase types for ${projectReference}...`
);

const result = spawnSync(
  executable,
  [
    "supabase",
    "gen",
    "types",
    "typescript",
    "--project-id",
    projectReference,
    "--schema",
    "public",
  ],
  {
    cwd: root,
    encoding: "utf8",
    maxBuffer:
      50 * 1024 * 1024,
  }
);

if (result.status !== 0) {
  console.error(
    result.stderr ||
      result.stdout ||
      "Supabase type generation failed."
  );
  console.error(
    "\nRun `npx supabase login`, then retry `npm run types:generate`."
  );
  process.exit(
    result.status ?? 1
  );
}

const generated =
  result.stdout.trim();

if (
  !generated.includes(
    "export type Database"
  )
) {
  console.error(
    "The CLI did not return a valid Database type."
  );
  process.exit(1);
}

writeFileSync(
  temporaryPath,
  `${generated}\n`,
  "utf8"
);

try {
  renameSync(
    temporaryPath,
    outputPath
  );
} catch (error) {
  rmSync(
    temporaryPath,
    { force: true }
  );
  throw error;
}

console.log(
  `Generated ${outputPath}`
);
