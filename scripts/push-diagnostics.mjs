#!/usr/bin/env node

import {
  existsSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import process from "node:process";
import {
  fetchWithTimeout,
  loadEnvironment,
  normalizeBaseUrl,
  readArgument,
  readJsonSafe,
} from "./lib/environment.mjs";

const root = process.cwd();
const env = loadEnvironment(root);
const requestedUrl =
  readArgument("url") ||
  env.DAILY_RESET_URL ||
  "";

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

function requireEnvironment(
  key,
  {
    minimumLength = 1,
  } = {}
) {
  const value = env[key]?.trim() ?? "";

  if (!value) {
    fail(`${key} is missing`);
    return "";
  }

  if (
    value.length < minimumLength
  ) {
    fail(
      `${key} is shorter than expected`
    );
    return value;
  }

  pass(`${key} is configured`);
  return value;
}

function fileContains(
  relativePath,
  patterns
) {
  const path = join(root, relativePath);

  if (!existsSync(path)) {
    fail(`${relativePath} is missing`);
    return "";
  }

  const content = readFileSync(
    path,
    "utf8"
  );

  for (const pattern of patterns) {
    if (!pattern.test(content)) {
      fail(
        `${relativePath} is missing ${pattern}`
      );
    }
  }

  return content;
}

console.log(
  "\nDaily Reset push diagnostics\n"
);

const supabaseUrl =
  requireEnvironment(
    "NEXT_PUBLIC_SUPABASE_URL",
    { minimumLength: 12 }
  );
const serviceKey =
  requireEnvironment(
    "SUPABASE_SERVICE_ROLE_KEY",
    { minimumLength: 20 }
  );
const vapidPublic =
  requireEnvironment(
    "VAPID_PUBLIC_KEY",
    { minimumLength: 40 }
  );
requireEnvironment(
  "VAPID_PRIVATE_KEY",
  { minimumLength: 30 }
);
const vapidSubject =
  requireEnvironment(
    "VAPID_SUBJECT",
    { minimumLength: 8 }
  );
const cronSecret =
  requireEnvironment(
    "CRON_SECRET",
    { minimumLength: 32 }
  );

if (
  env
    .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?.trim() ||
  env
    .NEXT_PUBLIC_SUPABASE_ANON_KEY
    ?.trim()
) {
  pass(
    "Supabase browser key is configured"
  );
} else {
  fail(
    "Supabase browser key is missing"
  );
}

try {
  const parsed = new URL(
    supabaseUrl
  );

  if (
    parsed.protocol === "https:"
  ) {
    pass(
      "Supabase URL uses HTTPS"
    );
  } else {
    fail(
      "Supabase URL must use HTTPS"
    );
  }
} catch {
  fail(
    "NEXT_PUBLIC_SUPABASE_URL is invalid"
  );
}

if (
  /^(?:mailto:|https:\/\/)/iu.test(
    vapidSubject
  )
) {
  pass(
    "VAPID_SUBJECT format is valid"
  );
} else {
  fail(
    "VAPID_SUBJECT must begin with mailto: or https://"
  );
}

if (
  serviceKey.startsWith(
    "NEXT_PUBLIC_"
  )
) {
  fail(
    "Supabase admin key appears public"
  );
}

const typesContent = fileContains(
  "types/database.types.ts",
  [
    /daily_reset_push_subscriptions/u,
    /daily_reset_push_deliveries/u,
  ]
);

if (typesContent) {
  pass(
    "generated types include push tables"
  );
}

const migrationContent =
  fileContains(
    "utils/supabase/migrations/20260727_alpha_0_33_web_push.sql",
    [
      /daily_reset_push_subscriptions/u,
      /daily_reset_push_deliveries/u,
    ]
  );

if (migrationContent) {
  pass(
    "push migration is present"
  );
}

const workerContent = fileContains(
  "public/sw.js",
  [
    /["']push["']/u,
    /["']notificationclick["']/u,
  ]
);

if (workerContent) {
  if (
    /addEventListener\s*\(\s*["']fetch["']/u.test(
      workerContent
    )
  ) {
    fail(
      "service worker contains a fetch handler"
    );
  } else {
    pass(
      "service worker does not intercept fetch requests"
    );
  }
}

const packageContent = fileContains(
  "package.json",
  [
    /"web-push"/u,
    /"push:keys"/u,
  ]
);

if (packageContent) {
  pass(
    "push package and key script are configured"
  );
}

if (requestedUrl) {
  await runRemoteDiagnostics(
    requestedUrl
  );
} else {
  warn(
    "Remote checks skipped. Pass --url=https://your-domain to test production."
  );
}

console.log("\nSummary");
console.log(`PASS: ${passes.length}`);
console.log(`WARN: ${warnings.length}`);
console.log(`FAIL: ${failures.length}`);

if (failures.length > 0) {
  console.error(
    "\nPush diagnostics failed."
  );
  process.exit(1);
}

console.log(
  "\nPush diagnostics passed."
);

async function runRemoteDiagnostics(
  rawUrl
) {
  let baseUrl;

  try {
    baseUrl =
      normalizeBaseUrl(rawUrl);
  } catch {
    fail(
      `Invalid diagnostic URL: ${rawUrl}`
    );
    return;
  }

  console.log(
    `\nRemote target: ${baseUrl}\n`
  );

  try {
    const healthResponse =
      await fetchWithTimeout(
        `${baseUrl}/api/health`
      );
    const health =
      await readJsonSafe(
        healthResponse
      );

    if (
      healthResponse.ok &&
      health?.status === "ok"
    ) {
      pass(
        "production health endpoint is healthy"
      );
    } else {
      fail(
        `production health endpoint returned ${healthResponse.status}`
      );
    }
  } catch (error) {
    fail(
      `health request failed: ${messageOf(error)}`
    );
  }

  try {
    const keyResponse =
      await fetchWithTimeout(
        `${baseUrl}/api/push/public-key`
      );
    const payload =
      await readJsonSafe(keyResponse);

    if (
      keyResponse.ok &&
      typeof payload?.publicKey ===
        "string" &&
      payload.publicKey.length >= 40
    ) {
      pass(
        "production VAPID public key is available"
      );

      if (
        vapidPublic &&
        payload.publicKey !==
          vapidPublic
      ) {
        warn(
          "production VAPID public key differs from the local environment"
        );
      }
    } else {
      fail(
        `public-key endpoint returned ${keyResponse.status}`
      );
    }
  } catch (error) {
    fail(
      `public-key request failed: ${messageOf(error)}`
    );
  }

  try {
    const workerResponse =
      await fetchWithTimeout(
        `${baseUrl}/sw.js`
      );
    const worker =
      await workerResponse.text();

    if (
      workerResponse.ok &&
      worker.includes(
        "notificationclick"
      ) &&
      !/addEventListener\s*\(\s*["']fetch["']/u.test(
        worker
      )
    ) {
      pass(
        "production service worker is push-only"
      );
    } else {
      fail(
        "production service worker is missing or unsafe"
      );
    }
  } catch (error) {
    fail(
      `service-worker request failed: ${messageOf(error)}`
    );
  }

  try {
    const unauthorized =
      await fetchWithTimeout(
        `${baseUrl}/api/push/dispatch`,
        {
          redirect: "manual",
        }
      );

    if (
      unauthorized.status === 401
    ) {
      pass(
        "dispatch endpoint rejects unauthenticated requests"
      );
    } else {
      fail(
        `dispatch endpoint returned ${unauthorized.status} without authorization`
      );
    }
  } catch (error) {
    fail(
      `unauthorized dispatch test failed: ${messageOf(error)}`
    );
  }

  if (!cronSecret) {
    warn(
      "Authorized dispatch test skipped because CRON_SECRET is unavailable."
    );
    return;
  }

  try {
    const authorized =
      await fetchWithTimeout(
        `${baseUrl}/api/push/dispatch`,
        {
          headers: {
            Authorization:
              `Bearer ${cronSecret}`,
          },
        },
        30_000
      );
    const payload =
      await readJsonSafe(authorized);

    if (
      authorized.ok &&
      typeof payload?.checkedReminders ===
        "number" &&
      typeof payload?.activeSubscriptions ===
        "number"
    ) {
      pass(
        "authorized push dispatch completed"
      );
    } else {
      fail(
        `authorized dispatch returned ${authorized.status}`
      );
    }
  } catch (error) {
    fail(
      `authorized dispatch test failed: ${messageOf(error)}`
    );
  }
}

function messageOf(error) {
  return error instanceof Error
    ? error.message
    : String(error);
}
