import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function PATCH(
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
          "The journal attachment request was not valid JSON.",
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
          "Journal attachment data is required.",
      },
      400
    );
  }

  const candidate =
    body as Record<string, unknown>;
  const journalEntryId =
    typeof candidate.journalEntryId ===
    "string"
      ? candidate.journalEntryId.trim()
      : "";

  if (!journalEntryId) {
    return json(
      {
        error:
          "A journal entry ID is required.",
      },
      400
    );
  }

  const audioPath =
    normalizeOptionalString(
      candidate.audioPath
    );
  const rawTranscript =
    normalizeOptionalString(
      candidate.rawTranscript
    );
  const cleanedTranscript =
    normalizeOptionalString(
      candidate.cleanedTranscript
    );

  const { data, error } = await supabase
    .from("journal_entries")
    .update({
      audio_path: audioPath,
      raw_transcript: rawTranscript,
      cleaned_transcript:
        cleanedTranscript,
    })
    .eq("id", journalEntryId)
    .eq("user_id", user.id)
    .select(
      "id, audio_path, raw_transcript, cleaned_transcript"
    )
    .single();

  if (error) {
    return json(
      {
        error: error.message,
      },
      500
    );
  }

  return json(
    {
      entry: data,
    },
    200
  );
}

function normalizeOptionalString(
  value: unknown
) {
  if (typeof value !== "string") {
    return null;
  }

  const clean = value.trim();
  return clean || null;
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
