import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

type CheckStatus = "pass" | "warn" | "fail";

type HealthCheck = {
  key: string;
  label: string;
  status: CheckStatus;
  critical: boolean;
  detail: string;
  count?: number;
  duration_ms?: number;
};

type TableCheckDefinition = {
  key: string;
  label: string;
  critical: boolean;
  run: () => PromiseLike<{
    count: number | null;
    error: {
      message: string;
    } | null;
  }>;
};

export async function GET() {
  const startedAt = performance.now();
  const supabase = await createClient();
  const checks: HealthCheck[] = [];

  checks.push(
    environmentCheck({
      key: "supabase_url",
      label: "Supabase URL",
      configured: Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL
      ),
      critical: true,
    }),
    environmentCheck({
      key: "supabase_anon_key",
      label: "Supabase browser key",
      configured: Boolean(
        process.env
          .NEXT_PUBLIC_SUPABASE_ANON_KEY
      ),
      critical: true,
    }),
    environmentCheck({
      key: "openai_api_key",
      label: "OpenAI API key",
      configured: Boolean(
        process.env.OPENAI_API_KEY
      ),
      critical: false,
    })
  );

  const authStartedAt = performance.now();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    checks.push({
      key: "authenticated_session",
      label: "Authenticated session",
      status: "fail",
      critical: true,
      detail:
        userError?.message ??
        "No authenticated user session was found.",
      duration_ms: roundDuration(
        performance.now() - authStartedAt
      ),
    });

    return Response.json(
      buildResponse({
        checks,
        startedAt,
        deploymentEnvironment:
          getDeploymentEnvironment(),
      }),
      {
        status: 401,
        headers: noStoreHeaders(),
      }
    );
  }

  checks.push({
    key: "authenticated_session",
    label: "Authenticated session",
    status: "pass",
    critical: true,
    detail:
      "Server session verified through Supabase Auth.",
    duration_ms: roundDuration(
      performance.now() - authStartedAt
    ),
  });

  const tableDefinitions: TableCheckDefinition[] =
    [
      {
        key: "habits_table",
        label: "Protocols table",
        critical: true,
        run: () =>
          supabase
            .from("habits")
            .select("*", {
              count: "exact",
              head: true,
            }),
      },
      {
        key: "habit_logs_table",
        label: "Protocol logs table",
        critical: true,
        run: () =>
          supabase
            .from("habit_logs")
            .select("*", {
              count: "exact",
              head: true,
            }),
      },
      {
        key: "reset_scores_table",
        label: "Reset scores table",
        critical: true,
        run: () =>
          supabase
            .from("daily_reset_scores")
            .select("*", {
              count: "exact",
              head: true,
            }),
      },
      {
        key: "weight_logs_table",
        label: "Weight logs table",
        critical: false,
        run: () =>
          supabase
            .from("weight_logs")
            .select("*", {
              count: "exact",
              head: true,
            }),
      },
      {
        key: "protein_logs_table",
        label: "Protein logs table",
        critical: false,
        run: () =>
          supabase
            .from("protein_logs")
            .select("*", {
              count: "exact",
              head: true,
            }),
      },
      {
        key: "journal_entries_table",
        label: "Journal entries table",
        critical: true,
        run: () =>
          supabase
            .from("journal_entries")
            .select("*", {
              count: "exact",
              head: true,
            }),
      },
      {
        key: "ai_reflections_table",
        label: "AI reflections table",
        critical: false,
        run: () =>
          supabase
            .from("ai_reflections")
            .select("*", {
              count: "exact",
              head: true,
            }),
      },
      {
        key: "reminders_table",
        label: "Reminder settings table",
        critical: true,
        run: () =>
          supabase
            .from("daily_reset_reminders")
            .select("*", {
              count: "exact",
              head: true,
            }),
      },
      {
        key: "settings_table",
        label: "App settings table",
        critical: true,
        run: () =>
          supabase
            .from("daily_reset_settings")
            .select("*", {
              count: "exact",
              head: true,
            }),
      },
    ];

  const tableChecks = await Promise.all(
    tableDefinitions.map(runTableCheck)
  );

  checks.push(...tableChecks);

  return Response.json(
    buildResponse({
      checks,
      startedAt,
      deploymentEnvironment:
        getDeploymentEnvironment(),
    }),
    {
      status: checks.some(
        (check) =>
          check.critical &&
          check.status === "fail"
      )
        ? 503
        : 200,
      headers: noStoreHeaders(),
    }
  );
}

async function runTableCheck(
  definition: TableCheckDefinition
): Promise<HealthCheck> {
  const startedAt = performance.now();

  try {
    const { count, error } =
      await definition.run();

    if (error) {
      return {
        key: definition.key,
        label: definition.label,
        status: definition.critical
          ? "fail"
          : "warn",
        critical: definition.critical,
        detail: error.message,
        duration_ms: roundDuration(
          performance.now() - startedAt
        ),
      };
    }

    return {
      key: definition.key,
      label: definition.label,
      status: "pass",
      critical: definition.critical,
      detail:
        "Authenticated, RLS-scoped query completed.",
      count: count ?? 0,
      duration_ms: roundDuration(
        performance.now() - startedAt
      ),
    };
  } catch (error) {
    return {
      key: definition.key,
      label: definition.label,
      status: definition.critical
        ? "fail"
        : "warn",
      critical: definition.critical,
      detail:
        error instanceof Error
          ? error.message
          : "Unknown database check error.",
      duration_ms: roundDuration(
        performance.now() - startedAt
      ),
    };
  }
}

function environmentCheck({
  key,
  label,
  configured,
  critical,
}: {
  key: string;
  label: string;
  configured: boolean;
  critical: boolean;
}): HealthCheck {
  return {
    key,
    label,
    status: configured
      ? "pass"
      : critical
        ? "fail"
        : "warn",
    critical,
    detail: configured
      ? "Configured."
      : "Missing from the server environment.",
  };
}

function buildResponse({
  checks,
  startedAt,
  deploymentEnvironment,
}: {
  checks: HealthCheck[];
  startedAt: number;
  deploymentEnvironment: string;
}) {
  const criticalFailures = checks.filter(
    (check) =>
      check.critical &&
      check.status === "fail"
  ).length;

  const warnings = checks.filter(
    (check) => check.status === "warn"
  ).length;

  const passed = checks.filter(
    (check) => check.status === "pass"
  ).length;

  return {
    generated_at: new Date().toISOString(),
    environment: deploymentEnvironment,
    status:
      criticalFailures > 0
        ? "blocked"
        : warnings > 0
          ? "ready_with_warnings"
          : "ready",
    summary: {
      passed,
      warnings,
      critical_failures:
        criticalFailures,
      total: checks.length,
    },
    checks,
    response_time_ms: roundDuration(
      performance.now() - startedAt
    ),
  };
}

function getDeploymentEnvironment() {
  if (process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV;
  }

  return process.env.NODE_ENV ===
    "production"
    ? "production"
    : "development";
}

function roundDuration(value: number) {
  return Math.round(value * 10) / 10;
}

function noStoreHeaders() {
  return {
    "Cache-Control":
      "private, no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "X-Content-Type-Options": "nosniff",
  };
}
