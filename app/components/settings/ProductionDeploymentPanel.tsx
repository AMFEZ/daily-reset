"use client";

import { DAILY_RESET_RELEASE } from "@/lib/release";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

type DeploymentStatus = {
  ok: boolean;
  service: string;
  release: {
    name: string;
    version: string;
    milestone: string;
    channel: string;
    builtAt: string;
  };
  deployment: {
    environment: string;
    host: string | null;
    commit: string | null;
    branch: string | null;
  };
  generated_at: string;
};

type BrowserDeploymentState = {
  hostname: string;
  secureContext: boolean;
  online: boolean;
  standalone: boolean;
  serviceWorker:
    | "ACTIVE"
    | "SUPPORTED"
    | "UNSUPPORTED";
};

export function ProductionDeploymentPanel() {
  const [status, setStatus] =
    useState<DeploymentStatus | null>(
      null
    );
  const [browserState, setBrowserState] =
    useState<BrowserDeploymentState | null>(
      null
    );
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);
  const [message, setMessage] =
    useState<string | null>(null);
  const [isRefreshing, startRefreshing] =
    useTransition();

  useEffect(() => {
    setBrowserState(readBrowserState());

    // Keep startup network-free. Deployment metadata is loaded only
    // after refresh_status is clicked, preventing auth middleware or
    // redirect behavior from affecting initial hydration.
    function updateConnectionState() {
      setBrowserState(readBrowserState());
    }

    window.addEventListener(
      "online",
      updateConnectionState
    );
    window.addEventListener(
      "offline",
      updateConnectionState
    );

    return () => {
      window.removeEventListener(
        "online",
        updateConnectionState
      );
      window.removeEventListener(
        "offline",
        updateConnectionState
      );
    };
  }, []);

  const readiness = useMemo(() => {
    if (!status || !browserState) {
      return "CHECKING";
    }

    if (!status.ok) {
      return "BLOCKED";
    }

    if (
      status.deployment.environment ===
        "production" &&
      browserState.secureContext &&
      browserState.online
    ) {
      return "PRODUCTION ONLINE";
    }

    if (
      status.deployment.environment ===
      "preview"
    ) {
      return "PREVIEW ONLINE";
    }

    return "LOCAL READY";
  }, [browserState, status]);

  async function refreshStatus() {
    setErrorMessage(null);

    try {
      const response = await fetch(
        "/api/status",
        {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
        }
      );

      const payload =
        (await response.json()) as
          | DeploymentStatus
          | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in payload &&
            payload.error
            ? payload.error
            : "Deployment status check failed."
        );
      }

      setStatus(
        payload as DeploymentStatus
      );
      setBrowserState(readBrowserState());
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Deployment status check failed."
      );
    }
  }

  function handleRefresh() {
    setMessage(null);

    startRefreshing(async () => {
      await refreshStatus();
    });
  }

  async function copyReport() {
    setMessage(null);
    setErrorMessage(null);

    try {
      const report =
        buildDeploymentReport({
          status,
          browserState,
          readiness,
        });

      await navigator.clipboard.writeText(
        report
      );

      setMessage(
        "Deployment report copied."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not copy the report."
      );
    }
  }

  function downloadReport() {
    const report = {
      schema_version:
        "daily-reset-deployment-report-v1",
      generated_at:
        new Date().toISOString(),
      readiness,
      status,
      browser: browserState,
    };

    const blob = new Blob(
      [
        JSON.stringify(
          report,
          null,
          2
        ),
      ],
      {
        type:
          "application/json;charset=utf-8",
      }
    );

    const url =
      URL.createObjectURL(blob);
    const anchor =
      document.createElement("a");

    anchor.href = url;
    anchor.download =
      `daily-reset-deployment-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1_000);

    setMessage(
      "Deployment report downloaded."
    );
  }

  const environment =
    status?.deployment.environment ??
    "unknown";

  return (
    <section className="border border-[#242424] bg-[#050505]">
      <div className="border-b border-[#242424] bg-[#0d0d0d] px-3 py-2">
        <p className="terminal-green text-xs uppercase tracking-[0.2em]">
          &gt; deployment.control
        </p>
      </div>

      <div className="p-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric
            label="STATE"
            value={readiness}
            green={
              readiness ===
                "PRODUCTION ONLINE" ||
              readiness === "LOCAL READY"
            }
            warning={
              readiness ===
              "PREVIEW ONLINE"
            }
            failure={
              readiness === "BLOCKED"
            }
          />

          <Metric
            label="RELEASE"
            value={
              status?.release.version ??
              DAILY_RESET_RELEASE.version
            }
            green
          />

          <Metric
            label="ENVIRONMENT"
            value={environment.toUpperCase()}
            green={
              environment === "production"
            }
            warning={
              environment === "preview"
            }
          />

          <Metric
            label="COMMIT"
            value={
              status?.deployment.commit ??
              "LOCAL"
            }
          />

          <Metric
            label="CONNECTION"
            value={
              browserState?.online
                ? "ONLINE"
                : "OFFLINE"
            }
            green={browserState?.online}
            warning={
              browserState?.online === false
            }
          />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_0.9fr]">
          <section className="border border-[#242424] bg-[#080808] p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="terminal-green text-xs uppercase tracking-[0.18em]">
                  &gt; deployment.metadata
                </p>

                <p className="terminal-muted mt-2 text-xs leading-5">
                  Non-sensitive version and
                  hosting information returned by
                  the production status endpoint.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="min-h-[44px] border border-[#39ff88] px-3 text-xs text-[#39ff88] transition hover:bg-[#0d0d0d] disabled:cursor-not-allowed disabled:opacity-50"
              >
                &gt;{" "}
                {isRefreshing
                  ? "refreshing..."
                  : "refresh_status"}
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <DetailRow
                label="APP"
                value={
                  status?.release.name ??
                  DAILY_RESET_RELEASE.name
                }
              />

              <DetailRow
                label="MILESTONE"
                value={
                  status?.release.milestone ??
                  DAILY_RESET_RELEASE.milestone
                }
              />

              <DetailRow
                label="CHANNEL"
                value={
                  status?.release.channel ??
                  DAILY_RESET_RELEASE.channel
                }
              />

              <DetailRow
                label="HOST"
                value={
                  status?.deployment.host ??
                  browserState?.hostname ??
                  "unknown"
                }
              />

              <DetailRow
                label="BRANCH"
                value={
                  status?.deployment.branch ??
                  "local"
                }
              />

              <DetailRow
                label="STATUS API"
                value="/api/status"
              />

              <DetailRow
                label="UPDATED"
                value={
                  status?.generated_at
                    ? formatDateTime(
                        status.generated_at
                      )
                    : "not checked"
                }
              />
            </div>
          </section>

          <section className="border border-[#242424] bg-[#080808] p-3">
            <p className="terminal-green text-xs uppercase tracking-[0.18em]">
              &gt; device.runtime
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <RuntimeCard
                label="SECURE CONTEXT"
                value={
                  browserState?.secureContext
                    ? "PASS"
                    : "LOCAL / FAIL"
                }
                passing={
                  browserState?.secureContext ??
                  false
                }
              />

              <RuntimeCard
                label="NETWORK"
                value={
                  browserState?.online
                    ? "ONLINE"
                    : "OFFLINE"
                }
                passing={
                  browserState?.online ??
                  false
                }
              />

              <RuntimeCard
                label="PWA MODE"
                value={
                  browserState?.standalone
                    ? "INSTALLED"
                    : "BROWSER"
                }
                passing={
                  browserState?.standalone ??
                  false
                }
              />

              <RuntimeCard
                label="SERVICE WORKER"
                value={
                  browserState?.serviceWorker ??
                  "CHECKING"
                }
                passing={
                  browserState?.serviceWorker ===
                  "ACTIVE"
                }
              />
            </div>

            <div className="terminal-muted mt-4 border-t border-[#242424] pt-3 text-xs leading-6">
              <p>
                &gt; Local HTTP can be trusted by
                the browser, but production PWA
                features require HTTPS.
              </p>

              <p>
                &gt; Preview deployments should not
                be marked as the final production
                release.
              </p>
            </div>
          </section>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={copyReport}
            disabled={!status}
            className="min-h-[48px] border border-[#242424] bg-[#080808] px-4 py-3 text-left text-xs text-[#e5e5e5] transition hover:border-[#39ff88] hover:text-[#39ff88] disabled:cursor-not-allowed disabled:opacity-50"
          >
            &gt; copy_report
          </button>

          <button
            type="button"
            onClick={downloadReport}
            disabled={!status}
            className="min-h-[48px] border border-[#242424] bg-[#080808] px-4 py-3 text-left text-xs text-[#e5e5e5] transition hover:border-[#39ff88] hover:text-[#39ff88] disabled:cursor-not-allowed disabled:opacity-50"
          >
            &gt; download_report
          </button>

          <button
            type="button"
            onClick={() => {
              document
                .getElementById(
                  "release-readiness"
                )
                ?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
            }}
            className="min-h-[48px] border border-[#39ff88] bg-[#080808] px-4 py-3 text-left text-xs text-[#39ff88] transition hover:bg-[#0d0d0d]"
          >
            &gt; open_release_audit
          </button>
        </div>

        {message ? (
          <p className="terminal-green mt-4 text-xs leading-6">
            &gt; {message}
          </p>
        ) : null}

        {errorMessage ? (
          <p className="mt-4 text-xs leading-6 text-[#ff6b6b]">
            &gt; {errorMessage}
          </p>
        ) : null}

        <div className="mt-4 border border-[#ffb020] bg-[#100d06] p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-[#ffb020]">
            &gt; release.command
          </p>

          <pre className="terminal-muted mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-6">
{`npm run build
node scripts/release-preflight.mjs
git add .
git commit -m "Daily Reset Beta 1.0"
git push`}
          </pre>
        </div>
      </div>
    </section>
  );
}

function RuntimeCard({
  label,
  value,
  passing,
}: {
  label: string;
  value: string;
  passing: boolean;
}) {
  return (
    <div className="border border-[#242424] bg-[#050505] p-3">
      <p className="terminal-muted text-[9px] uppercase tracking-[0.14em]">
        {label}
      </p>

      <p
        className={
          passing
            ? "terminal-green mt-2 text-xs"
            : "mt-2 text-xs text-[#ffb020]"
        }
      >
        {value}
      </p>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="terminal-line flex items-start justify-between gap-4 border-b border-[#191919] py-2 text-xs last:border-b-0">
      <span className="terminal-muted">
        {label}
      </span>

      <span className="max-w-[70%] break-all text-right text-[#e5e5e5]">
        {value}
      </span>
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

function readBrowserState(): BrowserDeploymentState {
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

  let serviceWorker:
    BrowserDeploymentState["serviceWorker"] =
      "UNSUPPORTED";

  if ("serviceWorker" in navigator) {
    serviceWorker =
      navigator.serviceWorker.controller
        ? "ACTIVE"
        : "SUPPORTED";
  }

  return {
    hostname: window.location.host,
    secureContext:
      window.isSecureContext,
    online: navigator.onLine,
    standalone,
    serviceWorker,
  };
}

function buildDeploymentReport({
  status,
  browserState,
  readiness,
}: {
  status: DeploymentStatus | null;
  browserState:
    | BrowserDeploymentState
    | null;
  readiness: string;
}) {
  return [
    "DAILY RESET DEPLOYMENT REPORT",
    `State: ${readiness}`,
    `Release: ${
      status?.release.version ??
      DAILY_RESET_RELEASE.version
    }`,
    `Environment: ${
      status?.deployment.environment ??
      "unknown"
    }`,
    `Host: ${
      status?.deployment.host ??
      browserState?.hostname ??
      "unknown"
    }`,
    `Commit: ${
      status?.deployment.commit ??
      "local"
    }`,
    `Secure context: ${
      browserState?.secureContext
        ? "yes"
        : "no"
    }`,
    `PWA mode: ${
      browserState?.standalone
        ? "installed"
        : "browser"
    }`,
    `Generated: ${new Date().toISOString()}`,
  ].join("\n");
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
