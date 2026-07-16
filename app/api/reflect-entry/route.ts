import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/utils/supabase/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ReflectEntryBody = {
  journalEntryId: string;
};

type ReflectionResult = {
  summary: string;
  pattern_noticed: string;
  compassionate_reframe: string;
  questions: string[];
  action_step: string;
};

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as ReflectEntryBody;

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
      .select("id, user_id, entry_type, title, content, mood, energy, tags")
      .eq("id", body.journalEntryId)
      .eq("user_id", user.id)
      .single();

    if (entryError || !entry) {
      return NextResponse.json(
        { error: "Journal entry not found." },
        { status: 404 }
      );
    }

    if (!["reflection", "gratitude", "recall", "shadow", "freewrite"].includes(entry.entry_type)) {
      return NextResponse.json(
        { error: "This entry type is not supported by reflect-entry." },
        { status: 400 }
      );
    }

    const model = process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini";
    const isShadow = entry.entry_type === "shadow";

    const response = await openai.responses.create({
      model,
      input: [
        {
          role: "system",
          content: isShadow
            ? "You are a grounded shadow-work reflection assistant for a private journal. Be direct but not cruel. Do not diagnose. Do not claim certainty. Do not encourage rumination. Help the user notice patterns, reframe compassionately, and choose one grounded action. Return valid JSON only."
            : "You are a grounded self-reflection assistant for a private daily journal. Be supportive, honest, and practical. Do not diagnose. Do not claim certainty. Help the user notice patterns and choose one grounded action. Return valid JSON only.",
        },
        {
          role: "user",
          content: `
Reflect on this journal entry.

Entry type:
${entry.entry_type}

Title:
${entry.title ?? "Untitled"}

Mood:
${entry.mood ?? "Unknown"}

Energy:
${entry.energy ?? "Unknown"}

Tags:
${Array.isArray(entry.tags) ? entry.tags.join(", ") : "None"}

Content:
${entry.content}

Return ONLY valid JSON with this exact shape:
{
  "summary": "string",
  "pattern_noticed": "string",
  "compassionate_reframe": "string",
  "questions": ["string", "string", "string"],
  "action_step": "string"
}
`,
        },
      ],
    });

    const outputText = response.output_text?.trim() ?? "";

    if (!outputText) {
      return NextResponse.json(
        { error: "Reflection returned empty output." },
        { status: 500 }
      );
    }

    const reflection = parseReflection(outputText);

    const { data: saved, error: saveError } = await supabase
      .from("ai_reflections")
      .insert({
        user_id: user.id,
        journal_entry_id: entry.id,
        reflection_type: isShadow ? "shadow" : "journal",
        summary: reflection.summary,
        pattern_noticed: reflection.pattern_noticed,
        compassionate_reframe: reflection.compassionate_reframe,
        questions: reflection.questions,
        action_step: reflection.action_step,
        model,
      })
      .select(
        "id, journal_entry_id, reflection_type, summary, pattern_noticed, compassionate_reframe, questions, action_step, model, created_at"
      )
      .single();

    if (saveError || !saved) {
      return NextResponse.json(
        { error: saveError?.message ?? "Reflection save failed." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      reflection: saved,
    });
  } catch (error) {
    console.error("Entry reflection failed:", error);

    return NextResponse.json(
      { error: "Entry reflection failed." },
      { status: 500 }
    );
  }
}

function parseReflection(raw: string): ReflectionResult {
  const cleaned = raw
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned) as Partial<ReflectionResult>;

  return {
    summary: String(parsed.summary ?? ""),
    pattern_noticed: String(parsed.pattern_noticed ?? ""),
    compassionate_reframe: String(parsed.compassionate_reframe ?? ""),
    questions: Array.isArray(parsed.questions)
      ? parsed.questions.map(String)
      : [],
    action_step: String(parsed.action_step ?? ""),
  };
}