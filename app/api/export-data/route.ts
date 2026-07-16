import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

type DatasetName =
  | "profiles"
  | "settings"
  | "reminders"
  | "habits"
  | "habit_logs"
  | "reset_scores"
  | "weight_logs"
  | "protein_logs"
  | "journal_entries"
  | "ai_reflections";

type DatasetResult = {
  count: number;
  status: "ready" | "unavailable";
  error: string | null;
};

type ExportDataset = {
  name: DatasetName;
  table: string;
  records: unknown[];
  result: DatasetResult;
};

export async function GET(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return Response.json(
      {
        error: "Authentication required.",
      },
      {
        status: 401,
        headers: noStoreHeaders(),
      }
    );
  }

  const url = new URL(request.url);
  const mode =
    url.searchParams.get("mode") === "summary"
      ? "summary"
      : "export";

  const datasets = await collectDatasets(
    supabase
  );

  const manifest = Object.fromEntries(
    datasets.map((dataset) => [
      dataset.name,
      dataset.result,
    ])
  ) as Record<DatasetName, DatasetResult>;

  const totalRecords = datasets.reduce(
    (sum, dataset) =>
      sum + dataset.result.count,
    0
  );

  const unavailableDatasets = datasets
    .filter(
      (dataset) =>
        dataset.result.status ===
        "unavailable"
    )
    .map((dataset) => dataset.name);

  const generatedAt =
    new Date().toISOString();

  if (mode === "summary") {
    return Response.json(
      {
        generated_at: generatedAt,
        total_records: totalRecords,
        ready_datasets:
          datasets.length -
          unavailableDatasets.length,
        total_datasets: datasets.length,
        unavailable_datasets:
          unavailableDatasets,
        manifest,
      },
      {
        status: 200,
        headers: noStoreHeaders(),
      }
    );
  }

  const exportPayload = {
    schema_version:
      "daily-reset-export-v1",
    app_version: "alpha-0.33",
    generated_at: generatedAt,
    account: {
      id: user.id,
      email: user.email ?? null,
      created_at:
        user.created_at ?? null,
      last_sign_in_at:
        user.last_sign_in_at ?? null,
    },
    manifest: {
      total_records: totalRecords,
      ready_datasets:
        datasets.length -
        unavailableDatasets.length,
      total_datasets: datasets.length,
      unavailable_datasets:
        unavailableDatasets,
      datasets: manifest,
      notes: [
        "Passwords, access tokens, refresh tokens, and secret keys are never included.",
        "Database rows are included exactly as returned by the authenticated Supabase session.",
        "Dream audio paths may be included, but raw Storage files are not embedded in this JSON backup.",
      ],
    },
    data: Object.fromEntries(
      datasets.map((dataset) => [
        dataset.name,
        dataset.records,
      ])
    ),
  };

  const filename = [
    "daily-reset-backup",
    generatedAt.slice(0, 10),
    generatedAt
      .slice(11, 19)
      .replaceAll(":", "-"),
  ].join("-");

  return new Response(
    JSON.stringify(exportPayload, null, 2),
    {
      status: 200,
      headers: {
        ...noStoreHeaders(),
        "Content-Type":
          "application/json; charset=utf-8",
        "Content-Disposition":
          `attachment; filename="${filename}.json"`,
        "X-Content-Type-Options":
          "nosniff",
      },
    }
  );
}

async function collectDatasets(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >
): Promise<ExportDataset[]> {
  const definitions: Array<{
    name: DatasetName;
    table: string;
    run: () => PromiseLike<{
      data: unknown[] | null;
      error: {
        message: string;
      } | null;
    }>;
  }> = [
    {
      name: "profiles",
      table: "profiles",
      run: () =>
        supabase
          .from("profiles")
          .select("*"),
    },
    {
      name: "settings",
      table: "daily_reset_settings",
      run: () =>
        supabase
          .from("daily_reset_settings")
          .select("*"),
    },
    {
      name: "reminders",
      table: "daily_reset_reminders",
      run: () =>
        supabase
          .from("daily_reset_reminders")
          .select("*"),
    },
    {
      name: "habits",
      table: "habits",
      run: () =>
        supabase
          .from("habits")
          .select("*"),
    },
    {
      name: "habit_logs",
      table: "habit_logs",
      run: () =>
        supabase
          .from("habit_logs")
          .select("*"),
    },
    {
      name: "reset_scores",
      table: "daily_reset_scores",
      run: () =>
        supabase
          .from("daily_reset_scores")
          .select("*"),
    },
    {
      name: "weight_logs",
      table: "weight_logs",
      run: () =>
        supabase
          .from("weight_logs")
          .select("*"),
    },
    {
      name: "protein_logs",
      table: "protein_logs",
      run: () =>
        supabase
          .from("protein_logs")
          .select("*"),
    },
    {
      name: "journal_entries",
      table: "journal_entries",
      run: () =>
        supabase
          .from("journal_entries")
          .select("*"),
    },
    {
      name: "ai_reflections",
      table: "ai_reflections",
      run: () =>
        supabase
          .from("ai_reflections")
          .select("*"),
    },
  ];

  const results = await Promise.all(
    definitions.map(
      async (
        definition
      ): Promise<ExportDataset> => {
        try {
          const { data, error } =
            await definition.run();

          if (error) {
            return {
              name: definition.name,
              table: definition.table,
              records: [],
              result: {
                count: 0,
                status: "unavailable",
                error: error.message,
              },
            };
          }

          const records = sortRecords(
            Array.isArray(data)
              ? data
              : []
          );

          return {
            name: definition.name,
            table: definition.table,
            records,
            result: {
              count: records.length,
              status: "ready",
              error: null,
            },
          };
        } catch (error) {
          return {
            name: definition.name,
            table: definition.table,
            records: [],
            result: {
              count: 0,
              status: "unavailable",
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown export error.",
            },
          };
        }
      }
    )
  );

  return results;
}

function sortRecords(
  records: unknown[]
) {
  return [...records].sort(
    (left, right) => {
      const leftValue =
        getSortValue(left);
      const rightValue =
        getSortValue(right);

      return leftValue.localeCompare(
        rightValue
      );
    }
  );
}

function getSortValue(record: unknown) {
  if (
    !record ||
    typeof record !== "object"
  ) {
    return "";
  }

  const candidate =
    record as Record<string, unknown>;

  for (const key of [
    "date",
    "created_at",
    "updated_at",
    "sort_order",
    "name",
    "id",
  ]) {
    const value = candidate[key];

    if (
      typeof value === "string" ||
      typeof value === "number"
    ) {
      return String(value);
    }
  }

  return "";
}

function noStoreHeaders() {
  return {
    "Cache-Control":
      "private, no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  };
}
