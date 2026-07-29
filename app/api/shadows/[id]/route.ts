import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

type CaptureMode = "manual" | "voice";

type UpdateShadowBody = {
  title?: string;
  content?: string;
  captureMode?: CaptureMode;
  audioPath?: string | null;
  rawTranscript?: string;
  cleanedTranscript?: string;
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

const ACTION_MARKER = "\n\n[GROUNDED ACTION]\n";

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as UpdateShadowBody;

    const authenticated = await createClient();
    const {
      data: { user },
      error: userError,
    } = await authenticated.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      );
    }

    const admin = createAdminClient();
    const { data: existing, error: existingError } = await admin
      .from("journal_entries")
      .select("id, user_id, entry_type, audio_path")
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("entry_type", "shadow")
      .maybeSingle();

    if (existingError || !existing) {
      return NextResponse.json(
        { error: "Shadow entry not found." },
        { status: 404 }
      );
    }

    const captureMode: CaptureMode =
      body.captureMode === "voice" ? "voice" : "manual";
    const title = cleanText(body.title);
    const content = cleanText(body.content);
    const audioPath = cleanText(body.audioPath);
    const rawTranscript = cleanText(body.rawTranscript);
    const cleanedTranscript = cleanText(body.cleanedTranscript);

    if (title.length < 2) {
      return NextResponse.json(
        { error: "A shadow prompt is required." },
        { status: 400 }
      );
    }

    if (
      captureMode === "manual" &&
      getResponseText(content).length < 2
    ) {
      return NextResponse.json(
        {
          error:
            "Manual shadow entries require a written response.",
        },
        { status: 400 }
      );
    }

    if (captureMode === "voice" && !audioPath) {
      return NextResponse.json(
        {
          error:
            "Voice shadow entries require an audio recording.",
        },
        { status: 400 }
      );
    }

    const { data: updated, error: updateError } = await admin
      .from("journal_entries")
      .update({
        title,
        content,
        audio_path: captureMode === "voice" ? audioPath : null,
        raw_transcript:
          captureMode === "voice" ? rawTranscript || null : null,
        cleaned_transcript:
          captureMode === "voice" ? cleanedTranscript || null : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select(
        "id, entry_type, title, content, mood, energy, tags, audio_path, raw_transcript, cleaned_transcript, created_at"
      )
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        {
          error: updateError?.message ?? "Shadow update failed.",
        },
        { status: 500 }
      );
    }

    const { error: reflectionError } = await admin
      .from("ai_reflections")
      .delete()
      .eq("journal_entry_id", id)
      .eq("user_id", user.id)
      .eq("reflection_type", "shadow");

    if (reflectionError) {
      console.error(
        "Old shadow reflection cleanup failed:",
        reflectionError.message
      );
    }

    if (
      existing.audio_path &&
      existing.audio_path !== updated.audio_path
    ) {
      const { error: storageError } = await admin.storage
        .from("dream-audio")
        .remove([existing.audio_path]);

      if (storageError) {
        console.error(
          "Old shadow audio cleanup failed:",
          storageError.message
        );
      }
    }

    return NextResponse.json({
      entry: normalizeShadowEntry(updated),
    });
  } catch (error) {
    console.error("Shadow update failed:", error);

    return NextResponse.json(
      { error: "Shadow update failed." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const authenticated = await createClient();
    const {
      data: { user },
      error: userError,
    } = await authenticated.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      );
    }

    const admin = createAdminClient();
    const { data: existing, error: existingError } = await admin
      .from("journal_entries")
      .select("id, user_id, audio_path")
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("entry_type", "shadow")
      .maybeSingle();

    if (existingError || !existing) {
      return NextResponse.json(
        { error: "Shadow entry not found." },
        { status: 404 }
      );
    }

    const { error: reflectionDeleteError } = await admin
      .from("ai_reflections")
      .delete()
      .eq("journal_entry_id", id)
      .eq("user_id", user.id);

    if (reflectionDeleteError) {
      return NextResponse.json(
        { error: reflectionDeleteError.message },
        { status: 500 }
      );
    }

    const { error: entryDeleteError } = await admin
      .from("journal_entries")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (entryDeleteError) {
      return NextResponse.json(
        { error: entryDeleteError.message },
        { status: 500 }
      );
    }

    if (existing.audio_path) {
      const { error: storageError } = await admin.storage
        .from("dream-audio")
        .remove([existing.audio_path]);

      if (storageError) {
        console.error(
          "Shadow audio deletion failed:",
          storageError.message
        );
      }
    }

    return NextResponse.json({ deletedId: id });
  } catch (error) {
    console.error("Shadow deletion failed:", error);

    return NextResponse.json(
      { error: "Shadow deletion failed." },
      { status: 500 }
    );
  }
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getResponseText(content: string) {
  const markerIndex = content.indexOf(ACTION_MARKER);

  return (markerIndex < 0
    ? content
    : content.slice(0, markerIndex)
  ).trim();
}

function normalizeShadowEntry(entry: {
  id: string;
  entry_type: string | null;
  title: string | null;
  content: string | null;
  mood: string | null;
  energy: number | null;
  tags: string[] | null;
  audio_path: string | null;
  raw_transcript: string | null;
  cleaned_transcript: string | null;
  created_at: string;
}) {
  return {
    id: entry.id,
    entry_type: "shadow" as const,
    title: entry.title,
    content: entry.content ?? "",
    mood: entry.mood,
    energy: entry.energy,
    tags: entry.tags,
    audio_path: entry.audio_path,
    raw_transcript: entry.raw_transcript,
    cleaned_transcript: entry.cleaned_transcript,
    created_at: entry.created_at,
  };
}
