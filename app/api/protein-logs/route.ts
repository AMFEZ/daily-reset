import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request
) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return json(
      {
        error: "Authentication required.",
      },
      401
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return json(
      {
        error:
          "The protein correction request was not valid JSON.",
      },
      400
    );
  }

  if (
    !body ||
    typeof body !== "object"
  ) {
    return json(
      {
        error:
          "A protein log ID or reset date is required.",
      },
      400
    );
  }

  const candidate =
    body as Record<string, unknown>;
  const logId =
    typeof candidate.logId === "string"
      ? candidate.logId.trim()
      : "";
  const resetDate =
    typeof candidate.resetDate ===
    "string"
      ? candidate.resetDate.trim()
      : "";

  if (!logId && !isDateKey(resetDate)) {
    return json(
      {
        error:
          "A valid protein log ID or reset date is required.",
      },
      400
    );
  }

  let query = supabase
    .from("protein_logs")
    .delete()
    .eq("user_id", user.id);

  query = logId
    ? query.eq("id", logId)
    : query.eq("date", resetDate);

  const {
    data: deletedRows,
    error: deleteError,
  } = await query.select("id");

  if (deleteError) {
    return json(
      {
        error: deleteError.message,
      },
      500
    );
  }

  return json(
    {
      deletedIds: (
        deletedRows ?? []
      ).map((row) => row.id),
    },
    200
  );
}

function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    value
  );
}

function json(
  body: Record<string, unknown>,
  status: number
) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control":
        "private, no-store, no-cache, must-revalidate",
      "X-Content-Type-Options":
        "nosniff",
    },
  });
}
