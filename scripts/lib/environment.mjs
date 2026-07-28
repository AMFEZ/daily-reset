import {
  existsSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";

export function loadEnvironment(
  root = process.cwd()
) {
  const values = {
    ...process.env,
  };

  for (
    const filename of [
      ".env",
      ".env.local",
      ".env.production",
      ".env.production.local",
    ]
  ) {
    const path = join(root, filename);

    if (!existsSync(path)) {
      continue;
    }

    for (
      const rawLine of
      readFileSync(path, "utf8")
        .split(/\r?\n/u)
    ) {
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

      if (values[key]) {
        continue;
      }

      let value = normalized
        .slice(separator + 1)
        .trim();

      if (
        value.length >= 2 &&
        (
          (
            value.startsWith('"') &&
            value.endsWith('"')
          ) ||
          (
            value.startsWith("'") &&
            value.endsWith("'")
          )
        )
      ) {
        value = value.slice(1, -1);
      }

      values[key] = value;
    }
  }

  return values;
}

export function readArgument(
  name
) {
  const prefix = `--${name}=`;
  const inline =
    process.argv.find((value) =>
      value.startsWith(prefix)
    );

  if (inline) {
    return inline
      .slice(prefix.length)
      .trim();
  }

  const index =
    process.argv.indexOf(
      `--${name}`
    );

  if (
    index >= 0 &&
    process.argv[index + 1]
  ) {
    return process.argv[
      index + 1
    ].trim();
  }

  return "";
}

export function normalizeBaseUrl(
  value
) {
  const url = new URL(value);
  url.pathname = "/";
  url.search = "";
  url.hash = "";

  return url.toString().replace(
    /\/$/u,
    ""
  );
}

export async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = 12_000
) {
  const controller =
    new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    timeoutMs
  );

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function readJsonSafe(
  response
) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
