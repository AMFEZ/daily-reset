import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/utils/supabase/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type TranscribeDreamBody = {
  journalEntryId: string;
  audioPath: string;
};

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as TranscribeDreamBody;

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
      .select("id, user_id, audio_path")
      .eq("id", body.journalEntryId)
      .eq("user_id", user.id)
      .eq("entry_type", "dream")
      .single();

    if (entryError || !entry) {
      return NextResponse.json(
        { error: "Dream entry not found." },
        { status: 404 }
      );
    }

    if (entry.audio_path !== body.audioPath) {
      return NextResponse.json(
        { error: "Audio path does not match dream entry." },
        { status: 400 }
      );
    }

    const { data: audioBlob, error: downloadError } = await supabase.storage
      .from("dream-audio")
      .download(body.audioPath);

    if (downloadError || !audioBlob) {
      return NextResponse.json(
        { error: downloadError?.message ?? "Audio download failed." },
        { status: 500 }
      );
    }

    const audioFile = new File([audioBlob], "dream.webm", {
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

    const cleanedTranscript = cleanDreamTranscript(rawTranscript);

    const { error: updateError } = await supabase
      .from("journal_entries")
      .update({
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

    return NextResponse.json({
      rawTranscript,
      cleanedTranscript,
    });
  } catch (error) {
    console.error("Dream transcription failed:", error);

    return NextResponse.json(
      { error: "Dream transcription failed." },
      { status: 500 }
    );
  }
}

function cleanDreamTranscript(raw: string) {
  return raw
    .replace(/\s+/g, " ")
    .replace(/\bi was like\b/gi, "I was like")
    .replace(/\bi\b/g, "I")
    .trim();
}