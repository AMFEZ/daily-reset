#!/usr/bin/env node

import {
  existsSync,
  readFileSync,
} from "node:fs";
import {
  execFileSync,
} from "node:child_process";
import {
  resolve,
} from "node:path";

const root = process.cwd();
const args = new Set(
  process.argv.slice(2)
);
const shouldBuild =
  args.has("--build");

const criticalEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

const optionalEnv = [
  "OPENAI_API_KEY",
];

const requiredFiles = [
  "app/page.tsx",
  "app/manifest.ts",
  "app/api/status/route.ts",
  "app/api/system-health/route.ts",
  "app/api/export-data/route.ts",
  "app/error.tsx",
  "app/robots.ts",
  "public/sw.js",
  "public/offline.html",
  "public/icons/icon-192.png",
  "public/icons/icon-512.png",
  "lib/release.ts",
];

const env = {
  ...process.env,
  ...readEnvFile(
    resolve(root, ".env.local")
  ),
};

const results = [];

for (const key of criticalEnv) {
  results.push({
    label: `ENV ${key}`,
    status: env[key] ? "PASS" : "FAIL",
    critical: true,
  });
}

for (const key of optionalEnv) {
  results.push({
    label: `ENV ${key}`,
    status: env[key] ? "PASS" : "WARN",
    critical: false,
  });
}

for (const file of requiredFiles) {
  results.push({
    label: `FILE ${file}`,
    status: existsSync(
      resolve(root, file)
    )
      ? "PASS"
      : "FAIL",
    critical: true,
  });
}

const nodeMajor = Number(
  process.versions.node.split(".")[0]
);

results.push({
  label: `NODE ${process.versions.node}`,
  status:
    nodeMajor >= 20
      ? "PASS"
      : "FAIL",
  critical: true,
});

const packagePath = resolve(
  root,
  "package.json"
);

if (existsSync(packagePath)) {
  try {
    const packageJson = JSON.parse(
      readFileSync(
        packagePath,
        "utf8"
      )
    );

    results.push({
      label: "PACKAGE build script",
      status:
        packageJson.scripts?.build
          ? "PASS"
          : "FAIL",
      critical: true,
    });
  } catch {
    results.push({
      label: "PACKAGE package.json",
      status: "FAIL",
      critical: true,
    });
  }
} else {
  results.push({
    label: "PACKAGE package.json",
    status: "FAIL",
    critical: true,
  });
}

try {
  const branch = execFileSync(
    "git",
    [
      "rev-parse",
      "--abbrev-ref",
      "HEAD",
    ],
    {
      cwd: root,
      encoding: "utf8",
      stdio: [
        "ignore",
        "pipe",
        "ignore",
      ],
    }
  ).trim();

  results.push({
    label: `GIT branch ${branch}`,
    status:
      branch === "main"
        ? "PASS"
        : "WARN",
    critical: false,
  });

  const dirty = execFileSync(
    "git",
    ["status", "--porcelain"],
    {
      cwd: root,
      encoding: "utf8",
      stdio: [
        "ignore",
        "pipe",
        "ignore",
      ],
    }
  ).trim();

  results.push({
    label: "GIT working tree",
    status:
      dirty.length === 0
        ? "PASS"
        : "WARN",
    critical: false,
  });
} catch {
  results.push({
    label: "GIT repository",
    status: "WARN",
    critical: false,
  });
}

printResults(results);

const criticalFailures =
  results.filter(
    (result) =>
      result.critical &&
      result.status === "FAIL"
  );

if (criticalFailures.length > 0) {
  console.error(
    `\nRelease blocked: ${criticalFailures.length} critical check(s) failed.`
  );
  process.exit(1);
}

if (shouldBuild) {
  console.log(
    "\nRunning production build..."
  );

  try {
    execFileSync(
      npmCommand(),
      ["run", "build"],
      {
        cwd: root,
        stdio: "inherit",
      }
    );
  } catch {
    console.error(
      "\nProduction build failed."
    );
    process.exit(1);
  }
}

console.log(
  "\nDaily Reset preflight passed."
);

function readEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }

  const output = {};
  const lines = readFileSync(
    path,
    "utf8"
  ).split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (
      !line ||
      line.startsWith("#")
    ) {
      continue;
    }

    const separator =
      line.indexOf("=");

    if (separator < 1) {
      continue;
    }

    const key = line
      .slice(0, separator)
      .trim();
    let value = line
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

    output[key] = value;
  }

  return output;
}

function printResults(items) {
  console.log(
    "\nDAILY RESET RELEASE PREFLIGHT\n"
  );

  for (const item of items) {
    const marker =
      item.status === "PASS"
        ? "[PASS]"
        : item.status === "WARN"
          ? "[WARN]"
          : "[FAIL]";

    console.log(
      `${marker.padEnd(7)} ${item.label}`
    );
  }
}

function npmCommand() {
  return process.platform === "win32"
    ? "npm.cmd"
    : "npm";
}

