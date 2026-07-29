import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/utils/supabase/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type TranscribeShadowBody = {
  journalEntryId: string;
  audioPath: string;
};

const ACTION_MARKER = "\n\n[GROUNDED ACTION]\n";

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as TranscribeShadowBody;

    if (!body.journalEntryId || !body.audioPath) {
      return NextResponse.json(
        { error: "Missing journalEntryId or audioPath." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      );
    }

    const { data: entry, error: entryError } = await supabase
      .from("journal_entries")
      .select("id, user_id, audio_path, content")
      .eq("id", body.journalEntryId)
      .eq("user_id", user.id)
      .eq("entry_type", "shadow")
      .single();

    if (entryError || !entry) {
      return NextResponse.json(
        { error: "Shadow entry not found." },
        { status: 404 }
      );
    }

    if (entry.audio_path !== body.audioPath) {
      return NextResponse.json(
        { error: "Audio path does not match shadow entry." },
        { status: 400 }
      );
    }

    const { data: audioBlob, error: downloadError } =
      await supabase.storage
        .from("dream-audio")
        .download(body.audioPath);

    if (downloadError || !audioBlob) {
      return NextResponse.json(
        {
          error: downloadError?.message ?? "Audio download failed.",
        },
        { status: 500 }
      );
    }

    const audioFile = new File([audioBlob], "shadow.webm", {
      type: audioBlob.type || "audio/webm",
    });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "gpt-4o-mini-transcribe",
    });

    const rawTranscript = transcription.text?.trim() ?? "";

    if (!rawTranscript) {
      return NextResponse.json(
        { error: "Transcription returned empty text." },
        { status: 500 }
      );
    }

    const cleanedTranscript = cleanTranscript(rawTranscript);
    const action = getActionText(entry.content ?? "");
    const content = composeContent(cleanedTranscript, action);

    const { error: updateError } = await supabase
      .from("journal_entries")
      .update({
        content,
        raw_transcript: rawTranscript,
        cleaned_transcript: cleanedTranscript,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.journalEntryId)
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    const { error: reflectionError } = await supabase
      .from("ai_reflections")
      .delete()
      .eq("journal_entry_id", body.journalEntryId)
      .eq("user_id", user.id)
      .eq("reflection_type", "shadow");

    if (reflectionError) {
      console.error(
        "Old shadow reflection cleanup failed:",
        reflectionError.message
      );
    }

    return NextResponse.json({
      rawTranscript,
      cleanedTranscript,
      content,
    });
  } catch (error) {
    console.error("Shadow transcription failed:", error);

    return NextResponse.json(
      { error: "Shadow transcription failed." },
      { status: 500 }
    );
  }
}

function cleanTranscript(raw: string) {
  return raw
    .replace(/\s+/g, " ")
    .replace(/\bi\b/g, "I")
    .trim();
}

function getActionText(content: string) {
  const markerIndex = content.indexOf(ACTION_MARKER);

  if (markerIndex < 0) return "";

  return content
    .slice(markerIndex + ACTION_MARKER.length)
    .trim();
}

function composeContent(response: string, action: string) {
  if (!action.trim()) return response.trim();

  return `${response.trim()}${ACTION_MARKER}${action.trim()}`;
}
