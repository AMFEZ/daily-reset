"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

type CheckStatus =
  | "pass"
  | "warn"
  | "fail";

type HealthCheck = {
  key: string;
  label: string;
  status: CheckStatus;
  critical: boolean;
  detail: string;
  count?: number;
  duration_ms?: number;
};

type HealthReport = {
  generated_at: string;
  environment: string;
  status:
    | "ready"
    | "ready_with_warnings"
    | "blocked";
  summary: {
    passed: number;
    warnings: number;
    critical_failures: number;
    total: number;
  };
  checks: HealthCheck[];
  response_time_ms: number;
};

type BrowserCheck = HealthCheck;

type ManualCheckKey =
  | "production_env"
  | "auth_redirects"
  | "migrations"
  | "desktop_smoke"
  | "phone_smoke"
  | "backup";

type ManualCheckState = Record<
  ManualCheckKey,
  boolean
>;

const MANUAL_STORAGE_KEY =
  "daily-reset-release-checklist-v1";

const MANUAL_CHECKS: Array<{
  key: ManualCheckKey;
  label: string;
  detail: string;
}> = [
  {
    key: "production_env",
    label: "Production environment variables",
    detail:
      "Supabase and OpenAI variables are configured for Vercel Production.",
  },
  {
    key: "auth_redirects",
    label: "Supabase redirect URLs",
    detail:
      "The production domain and auth callback URL are allowed in Supabase Auth.",
  },
  {
    key: "migrations",
    label: "All migrations applied",
    detail:
      "Alpha migrations through 0.32 were run successfully in the production database.",
  },
  {
    key: "desktop_smoke",
    label: "Desktop smoke test",
    detail:
      "Login, checklist, lock, journal, reminders, settings, and export were tested.",
  },
  {
    key: "phone_smoke",
    label: "Phone/PWA smoke test",
    detail:
      "Install, sign-in, notifications, scrolling, and protocol editing were tested on a phone.",
  },
  {
    key: "backup",
    label: "Pre-release backup",
    detail:
      "A verified JSON backup and checksum were downloaded from data.safety.",
  },
];

const EMPTY_MANUAL_STATE: ManualCheckState = {
  production_env: false,
  auth_redirects: false,
  migrations: false,
  desktop_smoke: false,
  phone_smoke: false,
  backup: false,
};

export function ReleaseReadinessPanel() {
  const [serverReport, setServerReport] =
    useState<HealthReport | null>(null);
  const [browserChecks, setBrowserChecks] =
    useState<BrowserCheck[]>([]);
  const [manualChecks, setManualChecks] =
    useState<ManualCheckState>(
      EMPTY_MANUAL_STATE
    );
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);
  const [lastAuditAt, setLastAuditAt] =
    useState<string | null>(null);
  const [isAuditing, startAuditing] =
    useTransition();

  useEffect(() => {
    const stored =
      window.localStorage.getItem(
        MANUAL_STORAGE_KEY
      );

    if (stored) {
      try {
        setManualChecks({
          ...EMPTY_MANUAL_STATE,
          ...(JSON.parse(
            stored
          ) as Partial<ManualCheckState>),
        });
      } catch {
        window.localStorage.removeItem(
          MANUAL_STORAGE_KEY
        );
      }
    }

    // Do not auto-run the release audit on mount.
    // In some local auth/middleware setups, an API redirect can
    // remount the route and create a refresh loop. The audit now
    // runs only after the user clicks run_audit.
  }, []);

  const automatedChecks = useMemo(
    () => [
      ...(serverReport?.checks ?? []),
      ...browserChecks,
    ],
    [browserChecks, serverReport]
  );

  const automatedPassCount =
    automatedChecks.filter(
      (check) => check.status === "pass"
    ).length;

  const automatedWarningCount =
    automatedChecks.filter(
      (check) => check.status === "warn"
    ).length;

  const automatedFailureCount =
    automatedChecks.filter(
      (check) =>
        check.critical &&
        check.status === "fail"
    ).length;

  const manualCompleteCount =
    Object.values(manualChecks).filter(
      Boolean
    ).length;

  const manualTotal =
    MANUAL_CHECKS.length;

  const releaseState =
    automatedFailureCount > 0
      ? "BLOCKED"
      : manualCompleteCount < manualTotal
        ? "MANUAL CHECKS"
        : automatedWarningCount > 0
          ? "READY WITH WARNINGS"
          : "V1 READY";

  async function runAudit() {
    setErrorMessage(null);

    try {
      const [
        nextServerReport,
        nextBrowserChecks,
      ] = await Promise.all([
        fetchServerReport(),
        runBrowserChecks(),
      ]);

      setServerReport(nextServerReport);
      setBrowserChecks(
        nextBrowserChecks
      );
      setLastAuditAt(
        new Date().toISOString()
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Release audit failed."
      );
    }
  }

  function handleRunAudit() {
    startAuditing(async () => {
      await runAudit();
    });
  }

  function toggleManualCheck(
    key: ManualCheckKey
  ) {
    setManualChecks((current) => {
      const next = {
        ...current,
        [key]: !current[key],
      };

      window.localStorage.setItem(
        MANUAL_STORAGE_KEY,
        JSON.stringify(next)
      );

      return next;
    });
  }

  function resetManualChecklist() {
    setManualChecks(
      EMPTY_MANUAL_STATE
    );
    window.localStorage.removeItem(
      MANUAL_STORAGE_KEY
    );
  }

  function downloadAudit() {
    const payload = {
      schema_version:
        "daily-reset-release-audit-v1",
      generated_at:
        new Date().toISOString(),
      release_state: releaseState,
      server_report: serverReport,
      browser_checks: browserChecks,
      manual_checks: MANUAL_CHECKS.map(
        (check) => ({
          ...check,
          complete:
            manualChecks[check.key],
        })
      ),
    };

    const text = JSON.stringify(
      payload,
      null,
      2
    );
    const blob = new Blob([text], {
      type: "application/json;charset=utf-8",
    });
    const url =
      URL.createObjectURL(blob);
    const anchor =
      document.createElement("a");

    anchor.href = url;
    anchor.download =
      `daily-reset-release-audit-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1_000);
  }

  return (
    <section className="border border-[#242424] bg-[#050505]">
      <div className="border-b border-[#242424] bg-[#0d0d0d] px-3 py-2">
        <p className="terminal-green text-xs uppercase tracking-[0.2em]">
          &gt; release.readiness
        </p>
      </div>

      <div className="p-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric
            label="RELEASE STATE"
            value={releaseState}
            green={releaseState === "V1 READY"}
            warning={
              releaseState !== "V1 READY" &&
              releaseState !== "BLOCKED"
            }
            failure={
              releaseState === "BLOCKED"
            }
          />

          <Metric
            label="AUTO PASSED"
            value={`${automatedPassCount} / ${automatedChecks.length}`}
            green={
              automatedChecks.length > 0 &&
              automatedPassCount ===
                automatedChecks.length
            }
          />

          <Metric
            label="WARNINGS"
            value={String(
              automatedWarningCount
            )}
            warning={
              automatedWarningCount > 0
            }
          />

          <Metric
            label="BLOCKERS"
            value={String(
              automatedFailureCount
            )}
            green={
              automatedFailureCount === 0
            }
            failure={
              automatedFailureCount > 0
            }
          />

          <Metric
            label="MANUAL"
            value={`${manualCompleteCount} / ${manualTotal}`}
            green={
              manualCompleteCount ===
              manualTotal
            }
          />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="border border-[#242424] bg-[#080808] p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="terminal-green text-xs uppercase tracking-[0.18em]">
                  &gt; automated.audit
                </p>

                <p className="terminal-muted mt-2 text-xs leading-5">
                  Authenticated server, database,
                  environment, browser, and PWA
                  checks.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRunAudit}
                disabled={isAuditing}
                className="min-h-[44px] border border-[#39ff88] px-3 text-xs text-[#39ff88] transition hover:bg-[#0d0d0d] disabled:cursor-not-allowed disabled:opacity-50"
              >
                &gt;{" "}
                {isAuditing
                  ? "auditing..."
                  : "run_audit"}
              </button>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {automatedChecks.map(
                (check) => (
                  <CheckCard
                    key={check.key}
                    check={check}
                  />
                )
              )}

              {!serverReport &&
              !errorMessage ? (
                <p className="terminal-muted text-xs leading-6">
                  &gt; Audit idle. Click run_audit when the dashboard is fully loaded.
                </p>
              ) : null}
            </div>

            {serverReport ? (
              <div className="terminal-muted mt-4 border-t border-[#242424] pt-3 text-xs leading-6">
                <p>
                  &gt; Environment:{" "}
                  <span className="text-[#e5e5e5]">
                    {
                      serverReport.environment
                    }
                  </span>
                </p>

                <p>
                  &gt; Server response:{" "}
                  <span className="text-[#e5e5e5]">
                    {
                      serverReport.response_time_ms
                    }{" "}
                    ms
                  </span>
                </p>
              </div>
            ) : null}

            {errorMessage ? (
              <p className="mt-4 text-xs leading-6 text-[#ff6b6b]">
                &gt; {errorMessage}
              </p>
            ) : null}
          </section>

          <section className="border border-[#242424] bg-[#080808] p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="terminal-green text-xs uppercase tracking-[0.18em]">
                  &gt; manual.release.checklist
                </p>

                <p className="terminal-muted mt-2 text-xs leading-5">
                  Confirm the deployment tasks that
                  cannot be proven from application
                  code.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  resetManualChecklist
                }
                className="min-h-[44px] border border-[#242424] px-3 text-xs text-[#8a8a8a] transition hover:border-[#ffb020] hover:text-[#ffb020]"
              >
                reset
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {MANUAL_CHECKS.map(
                (check) => (
                  <button
                    key={check.key}
                    type="button"
                    onClick={() =>
                      toggleManualCheck(
                        check.key
                      )
                    }
                    className={[
                      "w-full border p-3 text-left transition",
                      manualChecks[check.key]
                        ? "border-[#39ff88] bg-[#08100b]"
                        : "border-[#242424] bg-[#050505]",
                    ].join(" ")}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={
                          manualChecks[
                            check.key
                          ]
                            ? "terminal-green text-sm"
                            : "terminal-muted text-sm"
                        }
                      >
                        {manualChecks[
                          check.key
                        ]
                          ? "[✓]"
                          : "[ ]"}
                      </span>

                      <span>
                        <span className="block text-xs text-[#e5e5e5]">
                          {check.label}
                        </span>

                        <span className="terminal-muted mt-1 block text-[10px] leading-5">
                          {check.detail}
                        </span>
                      </span>
                    </div>
                  </button>
                )
              )}
            </div>
          </section>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={downloadAudit}
            disabled={
              !serverReport ||
              browserChecks.length === 0
            }
            className="min-h-[48px] border border-[#242424] bg-[#080808] px-4 py-3 text-left text-xs text-[#e5e5e5] transition hover:border-[#39ff88] hover:text-[#39ff88] disabled:cursor-not-allowed disabled:opacity-50"
          >
            &gt; download_audit_report
          </button>

          <button
            type="button"
            onClick={() => {
              document
                .getElementById("data-safety")
                ?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
            }}
            className="min-h-[48px] border border-[#39ff88] bg-[#080808] px-4 py-3 text-left text-xs text-[#39ff88] transition hover:bg-[#0d0d0d]"
          >
            &gt; open_data_safety
          </button>
        </div>

        <div className="terminal-muted mt-4 border-t border-[#242424] pt-3 text-xs leading-6">
          <p>
            &gt; Last audit:{" "}
            <span className="text-[#e5e5e5]">
              {lastAuditAt
                ? formatDateTime(
                    lastAuditAt
                  )
                : "NOT RUN"}
            </span>
          </p>

          <p>
            &gt; Automated checks never expose
            environment values, credentials, or
            authentication tokens.
          </p>
        </div>
      </div>
    </section>
  );
}

function CheckCard({
  check,
}: {
  check: HealthCheck;
}) {
  return (
    <div
      className={[
        "border p-3",
        check.status === "pass"
          ? "border-[#242424] bg-[#050505]"
          : check.status === "warn"
            ? "border-[#ffb020] bg-[#100d06]"
            : "border-[#ff6b6b] bg-[#120707]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-[#e5e5e5]">
          {check.label}
        </p>

        <span
          className={
            check.status === "pass"
              ? "terminal-green text-[10px]"
              : check.status === "warn"
                ? "text-[10px] text-[#ffb020]"
                : "text-[10px] text-[#ff6b6b]"
          }
        >
          {check.status.toUpperCase()}
        </span>
      </div>

      <p className="terminal-muted mt-2 text-[10px] leading-5">
        {check.detail}
      </p>

      <div className="terminal-muted mt-2 flex flex-wrap gap-x-3 text-[9px] uppercase">
        {typeof check.count ===
        "number" ? (
          <span>{check.count} records</span>
        ) : null}

        {typeof check.duration_ms ===
        "number" ? (
          <span>
            {check.duration_ms} ms
          </span>
        ) : null}

        {check.critical ? (
          <span>critical</span>
        ) : (
          <span>optional</span>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  green = false,
  warning = false,
  failure = false,
}: {
  label: string;
  value: string;
  green?: boolean;
  warning?: boolean;
  failure?: boolean;
}) {
  const valueClassName = green
    ? "terminal-green"
    : failure
      ? "text-[#ff6b6b]"
      : warning
        ? "text-[#ffb020]"
        : "text-[#e5e5e5]";

  return (
    <div className="border border-[#242424] bg-[#080808] p-3">
      <p className="terminal-muted text-[10px] uppercase tracking-[0.18em]">
        {label}
      </p>

      <p className={`mt-2 text-sm ${valueClassName}`}>
        {value}
      </p>
    </div>
  );
}

async function fetchServerReport() {
  const response = await fetch(
    "/api/system-health",
    {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      redirect: "error",
    }
  );

  const payload =
    (await response.json()) as
      | HealthReport
      | { error?: string };

  if (!response.ok) {
    if (
      "checks" in payload &&
      Array.isArray(payload.checks)
    ) {
      return payload as HealthReport;
    }

    throw new Error(
      "error" in payload &&
        payload.error
        ? payload.error
        : "Server health check failed."
    );
  }

  return payload as HealthReport;
}

async function runBrowserChecks(): Promise<
  BrowserCheck[]
> {
  const checks: BrowserCheck[] = [];

  checks.push({
    key: "secure_context",
    label: "Secure browser context",
    status: window.isSecureContext
      ? "pass"
      : "fail",
    critical: true,
    detail: window.isSecureContext
      ? "HTTPS or trusted local context detected."
      : "PWA and notification features require a secure context.",
  });

  checks.push({
    key: "service_worker_support",
    label: "Service worker support",
    status:
      "serviceWorker" in navigator
        ? "pass"
        : "warn",
    critical: false,
    detail:
      "serviceWorker" in navigator
        ? "This browser supports the PWA service worker."
        : "This browser does not support service workers.",
  });

  checks.push({
    key: "notification_support",
    label: "Notification support",
    status:
      "Notification" in window
        ? Notification.permission ===
          "denied"
          ? "warn"
          : "pass"
        : "warn",
    critical: false,
    detail:
      "Notification" in window
        ? `Permission: ${Notification.permission}.`
        : "Notification API unavailable in this browser.",
  });

  checks.push({
    key: "online_state",
    label: "Network connection",
    status: navigator.onLine
      ? "pass"
      : "warn",
    critical: false,
    detail: navigator.onLine
      ? "Browser reports an active network connection."
      : "Browser is currently offline.",
  });

  const manifestResult =
    await checkAsset(
      "manifest_asset",
      "PWA manifest",
      "/manifest.webmanifest",
      true
    );
  checks.push(manifestResult);

  const offlineResult =
    await checkAsset(
      "offline_asset",
      "Offline fallback",
      "/offline.html",
      false
    );
  checks.push(offlineResult);

  const standalone =
    window.matchMedia(
      "(display-mode: standalone)"
    ).matches ||
    Boolean(
      (
        window.navigator as Navigator & {
          standalone?: boolean;
        }
      ).standalone
    );

  checks.push({
    key: "standalone_mode",
    label: "Installed PWA mode",
    status: standalone
      ? "pass"
      : "warn",
    critical: false,
    detail: standalone
      ? "Daily Reset is running as an installed app."
      : "Running in a browser tab. Install testing is still recommended.",
  });

  return checks;
}

async function checkAsset(
  key: string,
  label: string,
  path: string,
  critical: boolean
): Promise<BrowserCheck> {
  const startedAt =
    performance.now();

  try {
    const response = await fetch(path, {
      method: "GET",
      cache: "no-store",
    });

    return {
      key,
      label,
      status: response.ok
        ? "pass"
        : critical
          ? "fail"
          : "warn",
      critical,
      detail: response.ok
        ? `${path} returned ${response.status}.`
        : `${path} returned ${response.status}.`,
      duration_ms:
        Math.round(
          (performance.now() -
            startedAt) *
            10
        ) / 10,
    };
  } catch (error) {
    return {
      key,
      label,
      status: critical
        ? "fail"
        : "warn",
      critical,
      detail:
        error instanceof Error
          ? error.message
          : `${path} could not be fetched.`,
      duration_ms:
        Math.round(
          (performance.now() -
            startedAt) *
            10
        ) / 10,
    };
  }
}

function formatDateTime(
  value: string
) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(date);
}
