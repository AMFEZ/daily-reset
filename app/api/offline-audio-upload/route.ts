import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/x-m4a",
]);

type EntryType = "dream" | "shadow";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return json({ error: "Authentication required." }, 401);
  }

  const url = new URL(request.url);
  const entityId = url.searchParams.get("entityId")?.trim() ?? "";
  const storagePath = url.searchParams.get("storagePath")?.trim() ?? "";

  if (!entityId || !storagePath) {
    return json({ error: "Recording status metadata is incomplete." }, 400);
  }

  const { data, error } = await supabase
    .from("journal_entries")
    .select("audio_path")
    .eq("id", entityId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return json({ error: error.message }, 500);
  }

  return json(
    { uploaded: data?.audio_path === storagePath },
    200
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return json({ error: "Authentication required." }, 401);
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return json({ error: "Recording upload body is invalid." }, 400);
  }

  const entityId = readText(formData.get("entityId"));
  const entryType = readText(formData.get("entryType")) as EntryType;
  const storagePath = readText(formData.get("storagePath"));
  const audio = formData.get("audio");

  if (
    !entityId ||
    (entryType !== "dream" && entryType !== "shadow") ||
    !storagePath ||
    !(audio instanceof File)
  ) {
    return json({ error: "Recording metadata is incomplete." }, 400);
  }

  if (
    !storagePath.startsWith(`${user.id}/`) ||
    storagePath.includes("..")
  ) {
    return json({ error: "Recording path is not allowed." }, 400);
  }

  if (audio.size <= 0 || audio.size > MAX_AUDIO_BYTES) {
    return json({ error: "Recording must be between 1 byte and 25 MB." }, 400);
  }

  const contentType = normalizeAudioType(audio.type);

  if (!ALLOWED_AUDIO_TYPES.has(contentType)) {
    return json({ error: "Recording format is not supported." }, 400);
  }

  const { data: entry, error: entryError } = await supabase
    .from("journal_entries")
    .select("id, entry_type, audio_path")
    .eq("id", entityId)
    .eq("user_id", user.id)
    .eq("entry_type", entryType)
    .maybeSingle();

  if (entryError || !entry) {
    return json(
      {
        error:
          entryError?.message ??
          "The journal entry must sync before its recording.",
      },
      409
    );
  }

  const previousAudioPath = entry.audio_path ?? null;
  const { error: uploadError } = await supabase.storage
    .from("dream-audio")
    .upload(storagePath, audio, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    return json({ error: uploadError.message }, 500);
  }

  const { error: updateError } = await supabase
    .from("journal_entries")
    .update({
      audio_path: storagePath,
      raw_transcript: null,
      cleaned_transcript: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", entityId)
    .eq("user_id", user.id)
    .eq("entry_type", entryType);

  if (updateError) {
    if (previousAudioPath !== storagePath) {
      await supabase.storage
        .from("dream-audio")
        .remove([storagePath]);
    }

    return json({ error: updateError.message }, 500);
  }

  if (
    previousAudioPath &&
    previousAudioPath !== storagePath
  ) {
    const { error: cleanupError } = await supabase.storage
      .from("dream-audio")
      .remove([previousAudioPath]);

    if (cleanupError) {
      console.error(
        "Previous recording cleanup failed:",
        cleanupError.message
      );
    }
  }

  return json({ audioPath: storagePath }, 200);
}

function readText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeAudioType(value: string) {
  return value.split(";")[0]?.trim().toLowerCase() || "audio/webm";
}

function json(body: Record<string, unknown>, status: number) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
