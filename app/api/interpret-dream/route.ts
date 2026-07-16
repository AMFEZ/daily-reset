import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/utils/supabase/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type InterpretDreamBody = {
  journalEntryId: string;
};

type DreamInterpretationResult = {
  summary: string;
  emotional_themes: string[];
  pattern_noticed: string;
  jungian_lens: string;
  freudian_lens: string;
  neuroscience_lens: string;
  compassionate_reframe: string;
  questions: string[];
  action_step: string;
  interpretation_note: string;
};

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as InterpretDreamBody;

    if (!body.journalEntryId) {
      return NextResponse.json(
        { error: "Missing journalEntryId." },
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
      .select(
        "id, user_id, entry_type, title, content, mood, tags, raw_transcript, cleaned_transcript"
      )
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

    const dreamText =
      entry.cleaned_transcript?.trim() ||
      entry.raw_transcript?.trim() ||
      entry.content?.trim() ||
      "";

    if (dreamText.length < 2) {
      return NextResponse.json(
        { error: "Dream has no text to interpret." },
        { status: 400 }
      );
    }

    const model = process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini";

    const response = await openai.responses.create({
      model,
      input: [
        {
          role: "system",
          content:
            "You are a careful dream interpretation assistant for a private self-reflection journal. Interpret dreams as possibilities, not facts. Avoid certainty. Keep it grounded, emotionally safe, and non-graphic. Do not diagnose. Do not make predictions. Return valid JSON only.",
        },
        {
          role: "user",
          content: `
Interpret this dream using the requested structure.

Dream title:
${entry.title ?? "Untitled Dream"}

Mood:
${entry.mood ?? "Unknown"}

Tags:
${Array.isArray(entry.tags) ? entry.tags.join(", ") : "None"}

Dream text:
${dreamText}

Return ONLY valid JSON with this exact shape:
{
  "summary": "string",
  "emotional_themes": ["string", "string"],
  "pattern_noticed": "string",
  "jungian_lens": "string",
  "freudian_lens": "string",
  "neuroscience_lens": "string",
  "compassionate_reframe": "string",
  "questions": ["string", "string", "string"],
  "action_step": "string",
  "interpretation_note": "string"
}
`,
        },
      ],
    });

    const outputText = response.output_text?.trim() ?? "";

    if (!outputText) {
      return NextResponse.json(
        { error: "Dream interpretation returned empty output." },
        { status: 500 }
      );
    }

    const interpretation = parseDreamInterpretation(outputText);

    const { data: saved, error: saveError } = await supabase
      .from("ai_reflections")
      .insert({
        user_id: user.id,
        journal_entry_id: entry.id,
        reflection_type: "dream",
        summary: interpretation.summary,
        emotional_themes: interpretation.emotional_themes,
        pattern_noticed: interpretation.pattern_noticed,
        jungian_lens: interpretation.jungian_lens,
        freudian_lens: interpretation.freudian_lens,
        neuroscience_lens: interpretation.neuroscience_lens,
        compassionate_reframe: interpretation.compassionate_reframe,
        questions: interpretation.questions,
        action_step: interpretation.action_step,
        interpretation_note: interpretation.interpretation_note,
        model,
      })
      .select(
        "id, journal_entry_id, reflection_type, summary, emotional_themes, pattern_noticed, jungian_lens, freudian_lens, neuroscience_lens, compassionate_reframe, questions, action_step, interpretation_note, model, created_at"
      )
      .single();

    if (saveError || !saved) {
      return NextResponse.json(
        { error: saveError?.message ?? "Interpretation save failed." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      interpretation: saved,
    });
  } catch (error) {
    console.error("Dream interpretation failed:", error);

    return NextResponse.json(
      { error: "Dream interpretation failed." },
      { status: 500 }
    );
  }
}

function parseDreamInterpretation(raw: string): DreamInterpretationResult {
  const cleaned = raw
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned) as Partial<DreamInterpretationResult>;

  return {
    summary: String(parsed.summary ?? ""),
    emotional_themes: Array.isArray(parsed.emotional_themes)
      ? parsed.emotional_themes.map(String)
      : [],
    pattern_noticed: String(parsed.pattern_noticed ?? ""),
    jungian_lens: String(parsed.jungian_lens ?? ""),
    freudian_lens: String(parsed.freudian_lens ?? ""),
    neuroscience_lens: String(parsed.neuroscience_lens ?? ""),
    compassionate_reframe: String(parsed.compassionate_reframe ?? ""),
    questions: Array.isArray(parsed.questions)
      ? parsed.questions.map(String)
      : [],
    action_step: String(parsed.action_step ?? ""),
    interpretation_note: String(parsed.interpretation_note ?? ""),
  };
}