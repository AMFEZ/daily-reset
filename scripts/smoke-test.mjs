#!/usr/bin/env node

import process from "node:process";
import {
  fetchWithTimeout,
  loadEnvironment,
  normalizeBaseUrl,
  readArgument,
  readJsonSafe,
} from "./lib/environment.mjs";

const env = loadEnvironment(
  process.cwd()
);
const rawUrl =
  readArgument("url") ||
  env.DAILY_RESET_URL ||
  "http://localhost:3001";
const baseUrl =
  normalizeBaseUrl(rawUrl);
const cronSecret =
  env.CRON_SECRET?.trim() ?? "";

const passes = [];
const warnings = [];
const failures = [];

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

console.log(
  `\nDaily Reset smoke test\n\nTarget: ${baseUrl}\n`
);

await checkJson(
  "/api/health",
  (response, payload) =>
    response.ok &&
    payload?.status === "ok",
  "health endpoint"
);

await checkResponse(
  "/login",
  (response) => response.ok,
  "login route"
);

await checkResponse(
  "/",
  (response) => {
    if (response.ok) {
      return true;
    }

    if (
      response.status === 307 ||
      response.status === 308
    ) {
      const location =
        response.headers.get(
          "location"
        ) ?? "";

      return location.includes(
        "/login"
      );
    }

    return false;
  },
  "root authentication boundary",
  {
    redirect: "manual",
  }
);

await checkJson(
  "/manifest.webmanifest",
  (response, payload) =>
    response.ok &&
    payload?.name ===
      "Daily Reset: The Reprogram" &&
    payload?.display ===
      "standalone",
  "web app manifest"
);

await checkText(
  "/sw.js",
  (response, content) =>
    response.ok &&
    content.includes(
      "notificationclick"
    ) &&
    content.includes(
      '"push"'
    ) &&
    !/addEventListener\s*\(\s*["']fetch["']/u.test(
      content
    ),
  "push-only service worker"
);

await checkJson(
  "/api/push/public-key",
  (response, payload) =>
    response.ok &&
    typeof payload?.publicKey ===
      "string" &&
    payload.publicKey.length >= 40,
  "push public-key endpoint"
);

await checkResponse(
  "/api/push/dispatch",
  (response) =>
    response.status === 401,
  "unauthorized dispatch protection",
  {
    redirect: "manual",
  }
);

if (cronSecret) {
  await checkJson(
    "/api/push/dispatch",
    (response, payload) =>
      response.ok &&
      typeof payload?.checkedReminders ===
        "number" &&
      typeof payload?.activeSubscriptions ===
        "number" &&
      typeof payload?.failed ===
        "number",
    "authorized push dispatch",
    {
      headers: {
        Authorization:
          `Bearer ${cronSecret}`,
      },
    },
    30_000
  );
} else {
  warn(
    "Authorized push dispatch skipped because CRON_SECRET is unavailable."
  );
}

for (
  const icon of [
    "/icons/icon-192.png",
    "/icons/icon-512.png",
  ]
) {
  await checkResponse(
    icon,
    (response) => response.ok,
    `${icon} asset`
  );
}

await checkResponse(
  "/robots.txt",
  (response) => response.ok,
  "robots route"
);

console.log("\nSummary");
console.log(`PASS: ${passes.length}`);
console.log(`WARN: ${warnings.length}`);
console.log(`FAIL: ${failures.length}`);

if (failures.length > 0) {
  console.error(
    "\nSmoke test failed."
  );
  process.exit(1);
}

console.log(
  "\nAutomated smoke test passed."
);
console.log(
  "\nManual authenticated checks still required:"
);
console.log(
  "- sign in and refresh"
);
console.log(
  "- toggle and persist a habit"
);
console.log(
  "- save weight and protein"
);
console.log(
  "- save, transcribe, and collapse a dream"
);
console.log(
  "- send test_push from the iPhone Home Screen app"
);
console.log(
  "- close the app and confirm a scheduled push arrives"
);

async function checkResponse(
  pathname,
  predicate,
  label,
  options = {},
  timeout = 12_000
) {
  try {
    const response =
      await fetchWithTimeout(
        `${baseUrl}${pathname}`,
        options,
        timeout
      );

    if (predicate(response)) {
      pass(label);
    } else {
      fail(
        `${label} returned ${response.status}`
      );
    }
  } catch (error) {
    fail(
      `${label} failed: ${messageOf(error)}`
    );
  }
}

async function checkJson(
  pathname,
  predicate,
  label,
  options = {},
  timeout = 12_000
) {
  try {
    const response =
      await fetchWithTimeout(
        `${baseUrl}${pathname}`,
        options,
        timeout
      );
    const payload =
      await readJsonSafe(response);

    if (
      predicate(response, payload)
    ) {
      pass(label);
    } else {
      fail(
        `${label} returned ${response.status}`
      );
    }
  } catch (error) {
    fail(
      `${label} failed: ${messageOf(error)}`
    );
  }
}

async function checkText(
  pathname,
  predicate,
  label,
  options = {},
  timeout = 12_000
) {
  try {
    const response =
      await fetchWithTimeout(
        `${baseUrl}${pathname}`,
        options,
        timeout
      );
    const content =
      await response.text();

    if (
      predicate(response, content)
    ) {
      pass(label);
    } else {
      fail(
        `${label} returned ${response.status}`
      );
    }
  } catch (error) {
    fail(
      `${label} failed: ${messageOf(error)}`
    );
  }
}

function messageOf(error) {
  return error instanceof Error
    ? error.message
    : String(error);
}
