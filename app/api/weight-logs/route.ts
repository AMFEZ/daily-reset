import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

type WeightUnit = "lbs" | "kg";

export async function POST(
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
          "The body signal request was not valid JSON.",
      },
      400
    );
  }

  const parsed = parseBody(body);

  if (!parsed.ok) {
    return json(
      {
        error: parsed.error,
      },
      400
    );
  }

  const {
    data: existing,
    error: existingError,
  } = await supabase
    .from("weight_logs")
    .select("id")
    .eq("user_id", user.id)
    .eq("date", parsed.date)
    .maybeSingle();

  if (existingError) {
    return json(
      {
        error: existingError.message,
      },
      500
    );
  }

  const values = {
    user_id: user.id,
    date: parsed.date,
    weight: parsed.weight,
    unit: parsed.unit,
    note: parsed.note,
  };

  const mutation = existing
    ? supabase
        .from("weight_logs")
        .update(values)
        .eq("id", existing.id)
        .eq("user_id", user.id)
    : supabase
        .from("weight_logs")
        .insert(values);

  const {
    data: saved,
    error: saveError,
  } = await mutation
    .select(
      "id, date, weight, unit, note"
    )
    .single();

  if (saveError) {
    return json(
      {
        error: saveError.message,
      },
      500
    );
  }

  return json(
    {
      log: {
        ...saved,
        weight: Number(saved.weight),
      },
    },
    200
  );
}

function parseBody(
  body: unknown
):
  | {
      ok: true;
      date: string;
      weight: number;
      unit: WeightUnit;
      note: string | null;
    }
  | {
      ok: false;
      error: string;
    } {
  if (
    !body ||
    typeof body !== "object"
  ) {
    return {
      ok: false,
      error:
        "Body signal data is required.",
    };
  }

  const candidate =
    body as Record<string, unknown>;
  const date =
    typeof candidate.date === "string"
      ? candidate.date.trim()
      : "";
  const weight =
    typeof candidate.weight === "number"
      ? candidate.weight
      : Number(candidate.weight);
  const unit = candidate.unit;
  const note =
    typeof candidate.note === "string"
      ? candidate.note.trim() || null
      : null;

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    return {
      ok: false,
      error:
        "A valid date is required.",
    };
  }

  if (
    !Number.isFinite(weight) ||
    weight <= 0
  ) {
    return {
      ok: false,
      error:
        "A valid weight is required.",
    };
  }

  if (
    unit !== "lbs" &&
    unit !== "kg"
  ) {
    return {
      ok: false,
      error:
        "Weight unit must be lbs or kg.",
    };
  }

  return {
    ok: true,
    date,
    weight,
    unit,
    note,
  };
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
