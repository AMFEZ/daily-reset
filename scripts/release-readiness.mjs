#!/usr/bin/env node

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const root = process.cwd();
const currentScriptPath =
  fileURLToPath(import.meta.url);
const skipBuild =
  process.argv.includes("--skip-build");

const failures = [];
const warnings = [];
const passes = [];

function pass(message) {
  passes.push(message);
  console.log(`PASS  ${message}`);
}

function warn(message) {
  warnings.push(message);
  console.warn(`WARN  ${message}`);
}

function fail(message) {
  failures.push(message);
  console.error(`FAIL  ${message}`);
}

function readJson(path) {
  try {
    return JSON.parse(
      readFileSync(path, "utf8")
    );
  } catch (error) {
    fail(
      `Could not parse ${relative(
        root,
        path
      )}: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`
    );
    return null;
  }
}

function loadEnvKeys() {
  const values = {
    ...process.env,
  };

  const files = [
    ".env",
    ".env.local",
    ".env.production",
    ".env.production.local",
  ];

  for (const file of files) {
    const path = join(root, file);

    if (!existsSync(path)) {
      continue;
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
      let value = normalized
        .slice(separator + 1)
        .trim();

      if (
        (value.startsWith('"') &&
          value.endsWith('"')) ||
        (value.startsWith("'") &&
          value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!(key in values)) {
        values[key] = value;
      }
    }
  }

  return values;
}

function runScript(
  packageJson,
  scriptName,
  {
    required = false,
  } = {}
) {
  if (!packageJson.scripts?.[scriptName]) {
    if (required) {
      fail(
        `package.json is missing "${scriptName}".`
      );
    } else {
      warn(
        `No "${scriptName}" script; skipped.`
      );
    }

    return;
  }

  const result = spawnSync(
    "npm",
    ["run", scriptName],
    {
      cwd: root,
      stdio: "inherit",
      shell: true,
      env: process.env,
    }
  );

  if (result.status === 0) {
    pass(`npm run ${scriptName}`);
  } else {
    fail(`npm run ${scriptName}`);
  }
}

function walkSourceFiles(directory) {
  if (!existsSync(directory)) {
    return [];
  }

  const excluded = new Set([
    ".git",
    ".next",
    "node_modules",
    "public",
    "coverage",
    "dist",
  ]);
  const allowed = new Set([
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".ts",
    ".tsx",
  ]);

  const files = [];

  for (
    const entry of
    readdirSync(directory)
  ) {
    if (excluded.has(entry)) {
      continue;
    }

    const path = join(directory, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      files.push(
        ...walkSourceFiles(path)
      );
      continue;
    }

    if (allowed.has(extname(entry))) {
      files.push(path);
    }
  }

  return files;
}

console.log(
  "\nDaily Reset release readiness\n"
);

const packagePath = join(
  root,
  "package.json"
);

if (!existsSync(packagePath)) {
  fail(
    "Run this command from the project root; package.json was not found."
  );
} else {
  pass("package.json found");
}

const packageJson = existsSync(
  packagePath
)
  ? readJson(packagePath)
  : null;

if (
  existsSync(
    join(root, "package-lock.json")
  )
) {
  pass("package-lock.json committed");
} else {
  fail(
    "package-lock.json is missing. Commit a lockfile before release."
  );
}

const gitignorePath = join(
  root,
  ".gitignore"
);

if (existsSync(gitignorePath)) {
  const gitignore = readFileSync(
    gitignorePath,
    "utf8"
  );

  if (
    gitignore.includes(".env*") ||
    gitignore.includes(".env*.local") ||
    (
      gitignore.includes(".env.local") &&
      gitignore.includes(
        ".env.production.local"
      )
    )
  ) {
    pass(
      "local environment files are ignored"
    );
  } else {
    warn(
      "Confirm .env.local and .env.production.local are ignored by Git."
    );
  }
} else {
  warn(".gitignore was not found.");
}

const env = loadEnvKeys();

const exactRequiredKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "OPENAI_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "CRON_SECRET",
];

for (const key of exactRequiredKeys) {
  if (env[key]?.trim()) {
    pass(`${key} is configured`);
  } else {
    fail(`${key} is missing`);
  }
}

if (
  env
    .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?.trim() ||
  env
    .NEXT_PUBLIC_SUPABASE_ANON_KEY
    ?.trim()
) {
  pass(
    "Supabase public browser key is configured"
  );
} else {
  fail(
    "Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY."
  );
}

const forbiddenEnvironmentKeys = [
  "NEXT_PUBLIC_OPENAI_API_KEY",
  "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_VAPID_PRIVATE_KEY",
];

for (
  const key of
  forbiddenEnvironmentKeys
) {
  if (env[key]?.trim()) {
    fail(
      `${key} must not be exposed to browser code.`
    );
  }
}

const sourceFiles = walkSourceFiles(
  root
);
const forbiddenSourcePatterns = [
  {
    label:
      "public OpenAI secret reference",
    pattern:
      /NEXT_PUBLIC_OPENAI_API_KEY/gu,
  },
  {
    label:
      "public Supabase service-role reference",
    pattern:
      /NEXT_PUBLIC_(?:SUPABASE_)?SERVICE_ROLE_KEY/gu,
  },
  {
    label:
      "public VAPID private-key reference",
    pattern:
      /NEXT_PUBLIC_VAPID_PRIVATE_KEY/gu,
  },
];

for (
  const {
    label,
    pattern,
  } of forbiddenSourcePatterns
) {
  const matches = [];

  for (const file of sourceFiles) {
    if (file === currentScriptPath) {
      continue;
    }

    const content = readFileSync(
      file,
      "utf8"
    );

    pattern.lastIndex = 0;

    if (pattern.test(content)) {
      matches.push(
        relative(root, file)
      );
    }
  }

  if (matches.length > 0) {
    fail(
      `${label} found in: ${matches.join(
        ", "
      )}`
    );
  } else {
    pass(`no ${label}`);
  }
}

if (packageJson) {
  if (
    packageJson.scripts?.[
      "release:check"
    ]
  ) {
    pass(
      "release:check package script exists"
    );
  } else {
    warn(
      'Add "release:check": "node scripts/release-readiness.mjs" to package.json.'
    );
  }

  if (!skipBuild) {
    runScript(
      packageJson,
      "build",
      { required: true }
    );
  } else {
    warn(
      "Build skipped by --skip-build."
    );
  }

  if (
    packageJson.scripts?.typecheck
  ) {
    runScript(
      packageJson,
      "typecheck"
    );
  }

  if (
    packageJson.scripts?.lint
  ) {
    runScript(
      packageJson,
      "lint"
    );
  } else {
    warn(
      "No lint script found. Next.js 16 does not run lint as part of next build."
    );
  }
}

console.log("\nSummary");
console.log(`PASS: ${passes.length}`);
console.log(`WARN: ${warnings.length}`);
console.log(`FAIL: ${failures.length}`);

if (failures.length > 0) {
  console.error(
    "\nRelease readiness failed."
  );
  process.exit(1);
}

console.log(
  "\nRelease readiness passed."
);
