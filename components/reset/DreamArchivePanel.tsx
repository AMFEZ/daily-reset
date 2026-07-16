"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { DreamAudioRecorder } from "@/components/reset/DreamAudioRecorder";
import { createClient } from "@/utils/supabase/client";

type DreamEntry = {
  id: string;
  entry_type: "dream";
  title: string | null;
  content: string;
  mood: string | null;
  energy: number | null;
  tags: string[] | null;
  audio_path: string | null;
  raw_transcript: string | null;
  cleaned_transcript: string | null;
  created_at: string;
};

type SavedDreamEntryRow = {
  log_id: string;
  log_entry_type: "dream";
  log_title: string | null;
  log_content: string;
  log_mood: string | null;
  log_energy: number | null;
  log_tags: string[] | null;
  log_audio_path: string | null;
  log_raw_transcript: string | null;
  log_cleaned_transcript: string | null;
  log_created_at: string;
};

type DreamInterpretation = {
  id: string;
  journal_entry_id: string;
  reflection_type: "dream";
  summary: string | null;
  emotional_themes: string[] | null;
  pattern_noticed: string | null;
  jungian_lens: string | null;
  freudian_lens: string | null;
  neuroscience_lens: string | null;
  compassionate_reframe: string | null;
  questions: string[] | null;
  action_step: string | null;
  interpretation_note: string | null;
  model: string | null;
  created_at: string;
};

type TranscriptionApiResponse = {
  rawTranscript?: string;
  cleanedTranscript?: string;
  error?: string;
};

type InterpretationApiResponse = {
  interpretation?: DreamInterpretation;
  error?: string;
};

type DreamArchivePanelProps = {
  initialEntries: DreamEntry[];
  initialInterpretations: DreamInterpretation[];
};

function parseList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function DreamArchivePanel({
  initialEntries,
  initialInterpretations,
}: DreamArchivePanelProps) {
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  const [entries, setEntries] = useState<DreamEntry[]>(initialEntries);
  const [interpretations, setInterpretations] =
    useState<DreamInterpretation[]>(initialInterpretations);

  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [rawTranscript, setRawTranscript] = useState("");
  const [cleanedTranscript, setCleanedTranscript] = useState("");

  const [transcribingEntryId, setTranscribingEntryId] = useState<string | null>(
    null
  );
  const [interpretingEntryId, setInterpretingEntryId] = useState<string | null>(
    null
  );

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("");
  const [emotion, setEmotion] = useState("");
  const [symbols, setSymbols] = useState("");
  const [people, setPeople] = useState("");
  const [places, setPlaces] = useState("");
  const [tags, setTags] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );
  }, [entries]);

  const interpretationsByEntryId = useMemo(() => {
    return interpretations.reduce<Record<string, DreamInterpretation>>(
      (acc, interpretation) => {
        if (!acc[interpretation.journal_entry_id]) {
          acc[interpretation.journal_entry_id] = interpretation;
        }

        return acc;
      },
      {}
    );
  }, [interpretations]);

  function saveDream() {
    if (
      content.trim().length < 2 &&
      !audioPath &&
      rawTranscript.trim().length < 2
    ) {
      setMessage("Capture at least one dream signal.");
      return;
    }

    setMessage(null);

    startTransition(async () => {
      const { data: rawData, error } = await supabase
        .rpc("add_dream_entry", {
          target_title: title.trim() || null,
          target_content: content.trim(),
          target_mood: mood.trim() || null,
          target_emotion: emotion.trim() || null,
          target_symbols: parseList(symbols),
          target_people: parseList(people),
          target_places: parseList(places),
          target_tags: parseList(tags),
          target_audio_path: audioPath,
          target_raw_transcript: rawTranscript.trim() || null,
          target_cleaned_transcript: cleanedTranscript.trim() || null,
        })
        .single();

      if (error) {
        console.error("Dream save failed:", error.message);
        setMessage(`Save failed: ${error.message}`);
        return;
      }

      if (!rawData) {
        setMessage("Dream saved, but no saved record was returned.");
        return;
      }

      const data = rawData as unknown as SavedDreamEntryRow;

      setEntries((current) => [
        {
          id: data.log_id,
          entry_type: data.log_entry_type,
          title: data.log_title,
          content: data.log_content,
          mood: data.log_mood,
          energy: data.log_energy,
          tags: data.log_tags,
          audio_path: data.log_audio_path,
          raw_transcript: data.log_raw_transcript,
          cleaned_transcript: data.log_cleaned_transcript,
          created_at: data.log_created_at,
        },
        ...current,
      ]);

      setTitle("");
      setContent("");
      setMood("");
      setEmotion("");
      setSymbols("");
      setPeople("");
      setPlaces("");
      setTags("");
      setAudioPath(null);
      setAudioPreviewUrl(null);
      setRawTranscript("");
      setCleanedTranscript("");
      setMessage("Dream signal archived.");
    });
  }

  async function transcribeDream(entry: DreamEntry) {
    if (!entry.audio_path) {
      setMessage("No audio attached to this dream.");
      return;
    }

    setMessage(null);
    setTranscribingEntryId(entry.id);

    try {
      const response = await fetch("/api/transcribe-dream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          journalEntryId: entry.id,
          audioPath: entry.audio_path,
        }),
      });

      const result = (await response.json()) as TranscriptionApiResponse;

      if (!response.ok) {
        setMessage(result.error ?? "Transcription failed.");
        return;
      }

      if (
        typeof result.rawTranscript !== "string" ||
        typeof result.cleanedTranscript !== "string"
      ) {
        setMessage("Transcription completed, but no transcript was returned.");
        return;
      }

      setEntries((current) =>
        current.map((dream) =>
          dream.id === entry.id
            ? {
                ...dream,
                raw_transcript: result.rawTranscript ?? null,
                cleaned_transcript: result.cleanedTranscript ?? null,
              }
            : dream
        )
      );

      setRawTranscript(result.rawTranscript);
      setCleanedTranscript(result.cleanedTranscript);
      setMessage("Dream audio transcribed.");
    } catch (error) {
      console.error("Dream transcription failed:", error);
      setMessage("Transcription failed.");
    } finally {
      setTranscribingEntryId(null);
    }
  }

  async function interpretDream(entry: DreamEntry) {
    setMessage(null);
    setInterpretingEntryId(entry.id);

    try {
      const response = await fetch("/api/interpret-dream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          journalEntryId: entry.id,
        }),
      });

      const result = (await response.json()) as InterpretationApiResponse;

      if (!response.ok) {
        setMessage(result.error ?? "Dream interpretation failed.");
        return;
      }

      if (!result.interpretation) {
        setMessage(
          "Dream interpretation completed, but no result was returned."
        );
        return;
      }

      const nextInterpretation = result.interpretation;

      setInterpretations((current) => [
        nextInterpretation,
        ...current.filter(
          (interpretation) =>
            interpretation.journal_entry_id !== entry.id
        ),
      ]);

      setMessage("Dream interpretation generated.");
    } catch (error) {
      console.error("Dream interpretation failed:", error);
      setMessage("Dream interpretation failed.");
    } finally {
      setInterpretingEntryId(null);
    }
  }

  return (
    <TerminalBlock title="dream.archive">
      <div className="grid gap-4 xl:grid-cols-[1fr_0.75fr]">
        <div>
          <p className="terminal-muted mb-3 text-xs leading-6">
            &gt; Capture the dream before the system deletes it. Fragments count.
            Weird details matter.
          </p>

          <label className="block">
            <span className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
              Dream title
            </span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-2 w-full border border-[#242424] bg-[#000000] px-3 py-3 text-sm text-[#e5e5e5] outline-none focus:border-[#39ff88]"
              placeholder="The hallway, the ocean, the old apartment..."
            />
          </label>

          <label className="mt-3 block">
            <span className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
              Dream content
            </span>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="mt-2 min-h-[280px] w-full resize-y border border-[#242424] bg-[#000000] px-3 py-3 text-sm leading-6 text-[#e5e5e5] outline-none focus:border-[#39ff88]"
              placeholder="Write everything you remember. Even fragments. Even if it makes no sense..."
            />
          </label>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
                Mood
              </span>
              <input
                value={mood}
                onChange={(event) => setMood(event.target.value)}
                className="mt-2 w-full border border-[#242424] bg-[#000000] px-3 py-3 text-sm text-[#e5e5e5] outline-none focus:border-[#39ff88]"
                placeholder="strange, heavy, peaceful..."
              />
            </label>

            <label className="block">
              <span className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
                Main emotion
              </span>
              <input
                value={emotion}
                onChange={(event) => setEmotion(event.target.value)}
                className="mt-2 w-full border border-[#242424] bg-[#000000] px-3 py-3 text-sm text-[#e5e5e5] outline-none focus:border-[#39ff88]"
                placeholder="fear, longing, guilt, excitement..."
              />
            </label>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="block">
              <span className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
                Symbols
              </span>
              <input
                value={symbols}
                onChange={(event) => setSymbols(event.target.value)}
                className="mt-2 w-full border border-[#242424] bg-[#000000] px-3 py-3 text-sm text-[#e5e5e5] outline-none focus:border-[#39ff88]"
                placeholder="water, teeth, cat..."
              />
            </label>

            <label className="block">
              <span className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
                People
              </span>
              <input
                value={people}
                onChange={(event) => setPeople(event.target.value)}
                className="mt-2 w-full border border-[#242424] bg-[#000000] px-3 py-3 text-sm text-[#e5e5e5] outline-none focus:border-[#39ff88]"
                placeholder="mom, friend, stranger..."
              />
            </label>

            <label className="block">
              <span className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
                Places
              </span>
              <input
                value={places}
                onChange={(event) => setPlaces(event.target.value)}
                className="mt-2 w-full border border-[#242424] bg-[#000000] px-3 py-3 text-sm text-[#e5e5e5] outline-none focus:border-[#39ff88]"
                placeholder="school, subway, bedroom..."
              />
            </label>
          </div>

          <label className="mt-3 block">
            <span className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
              Extra tags
            </span>
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              className="mt-2 w-full border border-[#242424] bg-[#000000] px-3 py-3 text-sm text-[#e5e5e5] outline-none focus:border-[#39ff88]"
              placeholder="recurring, childhood, vivid..."
            />
          </label>

          <div className="mt-4">
            <DreamAudioRecorder
              onAudioUploaded={(path, previewUrl) => {
                setAudioPath(path);
                setAudioPreviewUrl(previewUrl);
              }}
            />
          </div>

          <div className="mt-4 border border-[#242424] bg-[#030303] p-3">
            <p className="terminal-green mb-2 text-xs uppercase tracking-[0.2em]">
              &gt; transcript.prep
            </p>

            <p className="terminal-muted mb-3 text-xs leading-6">
              &gt; Audio transcription can be run after the dream is saved. You
              can also paste or clean transcript text manually before saving.
            </p>

            <label className="block">
              <span className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
                Raw transcript
              </span>
              <textarea
                value={rawTranscript}
                onChange={(event) => setRawTranscript(event.target.value)}
                className="mt-2 min-h-[130px] w-full resize-y border border-[#242424] bg-[#000000] px-3 py-3 text-sm leading-6 text-[#e5e5e5] outline-none focus:border-[#39ff88]"
                placeholder="Unedited speech-to-text transcript..."
              />
            </label>

            <label className="mt-3 block">
              <span className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
                Cleaned transcript
              </span>
              <textarea
                value={cleanedTranscript}
                onChange={(event) => setCleanedTranscript(event.target.value)}
                className="mt-2 min-h-[130px] w-full resize-y border border-[#242424] bg-[#000000] px-3 py-3 text-sm leading-6 text-[#e5e5e5] outline-none focus:border-[#39ff88]"
                placeholder="Cleaned dream text..."
              />
            </label>
          </div>

          {audioPath ? (
            <div className="mt-3 border border-[#242424] bg-[#030303] p-3">
              <p className="terminal-green text-xs">&gt; Audio attached.</p>
              <p className="terminal-muted mt-1 break-all text-xs">
                {audioPath}
              </p>

              {audioPreviewUrl ? (
                <audio controls src={audioPreviewUrl} className="mt-3 w-full" />
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 grid gap-2">
            <button
              type="button"
              onClick={saveDream}
              disabled={isPending}
              className="min-h-[52px] w-full whitespace-normal break-words border border-[#39ff88] bg-[#000000] px-4 py-3 text-left text-sm leading-6 text-[#39ff88] transition hover:bg-[#050505] disabled:cursor-not-allowed disabled:opacity-60"
            >
              &gt; {isPending ? "saving dream..." : "save dream_signal"}
            </button>
          </div>

          {message ? (
            <p className="mt-3 text-xs text-[#ffb020]">&gt; {message}</p>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="border border-[#242424] bg-[#030303] p-3">
            <TerminalRow
              label="DREAM ENTRIES"
              value={String(entries.length)}
              green={entries.length > 0}
            />
            <TerminalRow label="AUDIO RECORDING" value="ONLINE" green />
            <TerminalRow label="SPEECH TO TEXT" value="MANUAL" green />
            <TerminalRow label="AI INTERPRETATION" value="ONLINE" green />

            <p className="terminal-muted mt-4 text-xs leading-6">
              &gt; Dream capture, audio, transcription, and interpretation are
              connected.
            </p>
          </div>

          <div className="border border-[#242424] bg-[#030303] p-3">
            <p className="terminal-green mb-2 text-xs uppercase tracking-[0.2em]">
              &gt; dream.capture.rule
            </p>

            <p className="terminal-muted text-xs leading-6">
              Do not wait until the dream makes sense. Record fragments first.
              Meaning can be processed later.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <p className="terminal-green mb-2 text-xs uppercase tracking-[0.2em]">
          &gt; recent.dream.signals
        </p>

        <div className="max-h-[560px] overflow-y-auto border border-[#242424]">
          {sortedEntries.length > 0 ? (
            sortedEntries.slice(0, 8).map((entry, index) => {
              const created = new Date(entry.created_at);
              const interpretation = interpretationsByEntryId[entry.id];

              return (
                <div
                  key={`${entry.id ?? "dream-entry"}-${entry.created_at}-${index}`}
                  className="terminal-line p-3 text-xs"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="terminal-green">
                      {entry.title || "Untitled Dream"}
                    </span>

                    <span className="terminal-muted">
                      {created.toLocaleDateString()} {" "}
                      {created.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <p className="whitespace-pre-wrap leading-6 text-[#e5e5e5]">
                    {entry.content ||
                      entry.cleaned_transcript ||
                      entry.raw_transcript ||
                      "Audio-only dream signal."}
                  </p>

                  <div className="terminal-muted mt-2 flex flex-wrap gap-3">
                    {entry.mood ? <span>mood: {entry.mood}</span> : null}
                    {entry.tags && entry.tags.length > 0 ? (
                      <span>tags: {entry.tags.join(", ")}</span>
                    ) : null}
                  </div>

                  {entry.audio_path ? (
                    <div className="mt-3 border border-[#242424] bg-[#030303] p-3">
                      <p className="terminal-green break-all text-xs">
                        audio: {entry.audio_path}
                      </p>

                      <button
                        type="button"
                        onClick={() => transcribeDream(entry)}
                        disabled={transcribingEntryId === entry.id}
                        className="mt-3 min-h-[48px] w-full whitespace-normal break-words border border-[#39ff88] bg-[#000000] px-4 py-2 text-left text-xs leading-5 text-[#39ff88] transition hover:bg-[#050505] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        &gt; {" "}
                        {transcribingEntryId === entry.id
                          ? "transcribing_dream..."
                          : "speech_to_text"}
                      </button>
                    </div>
                  ) : null}

                  <div className="mt-3 border border-[#242424] bg-[#030303] p-3">
                    <button
                      type="button"
                      onClick={() => interpretDream(entry)}
                      disabled={interpretingEntryId === entry.id}
                      className="min-h-[48px] w-full whitespace-normal break-words border border-[#39ff88] bg-[#000000] px-4 py-2 text-left text-xs leading-5 text-[#39ff88] transition hover:bg-[#050505] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      &gt; {" "}
                      {interpretingEntryId === entry.id
                        ? "interpreting_dream..."
                        : interpretation
                          ? "re-interpret_dream"
                          : "interpret_dream"}
                    </button>
                  </div>

                  {entry.raw_transcript ? (
                    <div className="mt-3 border border-[#242424] bg-[#030303] p-3">
                      <p className="terminal-green mb-1">raw transcript:</p>
                      <p className="terminal-muted whitespace-pre-wrap leading-6">
                        {entry.raw_transcript}
                      </p>
                    </div>
                  ) : null}

                  {entry.cleaned_transcript ? (
                    <div className="mt-3 border border-[#242424] bg-[#030303] p-3">
                      <p className="terminal-green mb-1">cleaned transcript:</p>
                      <p className="terminal-muted whitespace-pre-wrap leading-6">
                        {entry.cleaned_transcript}
                      </p>
                    </div>
                  ) : null}

                  {interpretation ? (
                    <DreamInterpretationView interpretation={interpretation} />
                  ) : null}
                </div>
              );
            })
          ) : (
            <p className="terminal-muted p-3 text-xs">
              &gt; No dream signals archived yet.
            </p>
          )}
        </div>
      </div>
    </TerminalBlock>
  );
}

function DreamInterpretationView({
  interpretation,
}: {
  interpretation: DreamInterpretation;
}) {
  return (
    <div className="mt-3 border border-[#39ff88] bg-[#000000] p-3 text-xs leading-6">
      <p className="terminal-green mb-3 uppercase tracking-[0.2em]">
        &gt; dream.interpretation
      </p>

      <DreamSection title="SUMMARY" content={interpretation.summary} />

      {interpretation.emotional_themes &&
      interpretation.emotional_themes.length > 0 ? (
        <div className="mt-3">
          <p className="terminal-green">POSSIBLE THEMES:</p>
          <p className="terminal-muted mt-1">
            {interpretation.emotional_themes.join(", ")}
          </p>
        </div>
      ) : null}

      <DreamSection
        title="PATTERN NOTICED"
        content={interpretation.pattern_noticed}
      />
      <DreamSection title="JUNGIAN LENS" content={interpretation.jungian_lens} />
      <DreamSection
        title="FREUDIAN LENS"
        content={interpretation.freudian_lens}
      />
      <DreamSection
        title="NEUROSCIENCE LENS"
        content={interpretation.neuroscience_lens}
      />
      <DreamSection
        title="COMPASSIONATE REFRAME"
        content={interpretation.compassionate_reframe}
      />

      {interpretation.questions && interpretation.questions.length > 0 ? (
        <div className="mt-3">
          <p className="terminal-green">QUESTIONS TO SIT WITH:</p>
          <ul className="terminal-muted mt-1 space-y-1">
            {interpretation.questions.map((question, index) => (
              <li key={`${question}-${index}`}>&gt; {question}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <DreamSection
        title="ONE GROUNDED ACTION"
        content={interpretation.action_step}
      />
      <DreamSection
        title="NOTE"
        content={
          interpretation.interpretation_note ||
          "This is a reflection lens, not a certain meaning."
        }
      />
    </div>
  );
}

function DreamSection({
  title,
  content,
}: {
  title: string;
  content: string | null;
}) {
  if (!content) return null;

  return (
    <div className="mt-3">
      <p className="terminal-green">{title}:</p>
      <p className="terminal-muted mt-1 whitespace-pre-wrap">{content}</p>
    </div>
  );
}

function TerminalBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border border-[#242424] bg-[#000000]">
      <div className="border-b border-[#242424] bg-[#050505] px-3 py-2">
        <p className="terminal-green text-xs uppercase tracking-[0.2em]">
          &gt; {title}
        </p>
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function TerminalRow({
  label,
  value,
  green = false,
}: {
  label: string;
  value: string;
  green?: boolean;
}) {
  return (
    <div className="terminal-line flex items-center justify-between gap-4 py-2">
      <span className="terminal-muted text-xs">{label}</span>
      <span
        className={
          green
            ? "terminal-green text-right text-xs"
            : "text-right text-xs text-[#e5e5e5]"
        }
      >
        {value}
      </span>
    </div>
  );
}