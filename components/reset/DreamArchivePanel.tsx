"use client";

import {
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { ContextAudioRecorder } from "@/components/reset/ContextAudioRecorder";
import { SignalDisclosure } from "@/components/reset/SignalDisclosure";
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

type DreamArchivePanelProps = {
  initialEntries: DreamEntry[];
  initialInterpretations: DreamInterpretation[];
};

type TranscriptionResponse = {
  rawTranscript?: string;
  cleanedTranscript?: string;
  error?: string;
};

type InterpretationResponse = {
  interpretation?: DreamInterpretation;
  error?: string;
};

export function DreamArchivePanel({
  initialEntries,
  initialInterpretations,
}: DreamArchivePanelProps) {
  const supabase = createClient();
  const [isPending, startTransition] =
    useTransition();
  const [entries, setEntries] =
    useState<DreamEntry[]>(
      initialEntries
    );
  const [
    interpretations,
    setInterpretations,
  ] = useState<DreamInterpretation[]>(
    initialInterpretations
  );
  const [title, setTitle] =
    useState("");
  const [content, setContent] =
    useState("");
  const [symbols, setSymbols] =
    useState("");
  const [people, setPeople] =
    useState("");
  const [places, setPlaces] =
    useState("");
  const [audioPath, setAudioPath] =
    useState<string | null>(null);
  const [
    audioPreviewUrl,
    setAudioPreviewUrl,
  ] = useState<string | null>(null);
  const [
    rawTranscript,
    setRawTranscript,
  ] = useState("");
  const [
    cleanedTranscript,
    setCleanedTranscript,
  ] = useState("");
  const [
    transcribingEntryId,
    setTranscribingEntryId,
  ] = useState<string | null>(null);
  const [
    interpretingEntryId,
    setInterpretingEntryId,
  ] = useState<string | null>(null);
  const [message, setMessage] =
    useState<string | null>(null);

  const sortedEntries = useMemo(
    () =>
      [...entries].sort((a, b) =>
        b.created_at.localeCompare(
          a.created_at
        )
      ),
    [entries]
  );

  const interpretationByEntry =
    useMemo(
      () =>
        interpretations.reduce<
          Record<
            string,
            DreamInterpretation
          >
        >((accumulator, item) => {
          if (
            !accumulator[
              item.journal_entry_id
            ]
          ) {
            accumulator[
              item.journal_entry_id
            ] = item;
          }
          return accumulator;
        }, {}),
      [interpretations]
    );

  function saveDream() {
    const cleanContent =
      content.trim();
    const cleanRaw =
      rawTranscript.trim();
    const cleanCleaned =
      cleanedTranscript.trim();

    if (
      cleanContent.length < 2 &&
      cleanRaw.length < 2 &&
      cleanCleaned.length < 2 &&
      !audioPath
    ) {
      setMessage(
        "Capture at least one dream signal."
      );
      return;
    }

    setMessage(null);

    startTransition(async () => {
      const { data: rawData, error } =
        await supabase
          .rpc("add_dream_entry", {
            target_title:
              title.trim() || null,
            target_content:
              cleanContent,
            target_mood: null,
            target_emotion: null,
            target_symbols:
              parseList(symbols),
            target_people:
              parseList(people),
            target_places:
              parseList(places),
            target_tags: [],
            target_audio_path:
              audioPath,
            target_raw_transcript:
              cleanRaw || null,
            target_cleaned_transcript:
              cleanCleaned || null,
          })
          .single();

      if (error) {
        setMessage(
          `Save failed: ${error.message}`
        );
        return;
      }

      if (!rawData) {
        setMessage(
          "Dream saved, but no record was returned."
        );
        return;
      }

      const data =
        rawData as unknown as SavedDreamEntryRow;

      setEntries((current) => [
        {
          id: data.log_id,
          entry_type: "dream",
          title: data.log_title,
          content: data.log_content,
          mood: null,
          energy: data.log_energy,
          tags: [],
          audio_path:
            data.log_audio_path,
          raw_transcript:
            data.log_raw_transcript,
          cleaned_transcript:
            data.log_cleaned_transcript,
          created_at:
            data.log_created_at,
        },
        ...current,
      ]);

      setTitle("");
      setContent("");
      setSymbols("");
      setPeople("");
      setPlaces("");
      setAudioPath(null);
      setAudioPreviewUrl(null);
      setRawTranscript("");
      setCleanedTranscript("");
      setMessage(
        "Dream signal archived."
      );
    });
  }

  async function transcribeDream(
    entry: DreamEntry
  ) {
    if (!entry.audio_path) {
      setMessage(
        "No audio is attached to this dream."
      );
      return;
    }

    setTranscribingEntryId(entry.id);
    setMessage(null);

    try {
      const response = await fetch(
        "/api/transcribe-dream",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            journalEntryId: entry.id,
            audioPath: entry.audio_path,
          }),
        }
      );

      const result =
        (await response.json()) as TranscriptionResponse;

      if (
        !response.ok ||
        typeof result.rawTranscript !==
          "string" ||
        typeof result.cleanedTranscript !==
          "string"
      ) {
        throw new Error(
          result.error ??
            "No transcript was returned."
        );
      }

      setEntries((current) =>
        current.map((candidate) =>
          candidate.id === entry.id
            ? {
                ...candidate,
                raw_transcript:
                  result.rawTranscript ??
                  null,
                cleaned_transcript:
                  result.cleanedTranscript ??
                  null,
              }
            : candidate
        )
      );

      setMessage(
        "Dream audio transcribed."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Transcription failed."
      );
    } finally {
      setTranscribingEntryId(null);
    }
  }

  async function interpretDream(
    entry: DreamEntry
  ) {
    setInterpretingEntryId(entry.id);
    setMessage(null);

    try {
      const response = await fetch(
        "/api/interpret-dream",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            journalEntryId: entry.id,
          }),
        }
      );

      const result =
        (await response.json()) as InterpretationResponse;

      if (
        !response.ok ||
        !result.interpretation
      ) {
        throw new Error(
          result.error ??
            "No interpretation was returned."
        );
      }

      setInterpretations((current) => [
        result.interpretation as DreamInterpretation,
        ...current.filter(
          (item) =>
            item.journal_entry_id !==
            entry.id
        ),
      ]);
      setMessage(
        "Dream interpretation generated."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Dream interpretation failed."
      );
    } finally {
      setInterpretingEntryId(null);
    }
  }

  return (
    <TerminalBlock title="dream.archive">
      <p className="terminal-muted text-xs leading-6">
        &gt; Capture the dream in writing, audio, or
        transcript. Fragments count.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <FieldLabel>
            Title
          </FieldLabel>
          <input
            value={title}
            onChange={(event) =>
              setTitle(event.target.value)
            }
            placeholder="The flooded apartment..."
            className={inputClassName}
          />
        </label>

        <label className="block">
          <FieldLabel>Symbols</FieldLabel>
          <input
            value={symbols}
            onChange={(event) =>
              setSymbols(event.target.value)
            }
            placeholder="water, teeth, cat..."
            className={inputClassName}
          />
        </label>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <FieldLabel>People</FieldLabel>
          <input
            value={people}
            onChange={(event) =>
              setPeople(event.target.value)
            }
            placeholder="friend, stranger..."
            className={inputClassName}
          />
        </label>

        <label className="block">
          <FieldLabel>Places</FieldLabel>
          <input
            value={places}
            onChange={(event) =>
              setPlaces(event.target.value)
            }
            placeholder="subway, bedroom..."
            className={inputClassName}
          />
        </label>
      </div>

      <label className="mt-3 block">
        <FieldLabel>Dream details</FieldLabel>
        <textarea
          value={content}
          onChange={(event) =>
            setContent(event.target.value)
          }
          placeholder="Record everything you remember..."
          className={`${inputClassName} min-h-[220px] resize-y leading-6`}
        />
      </label>

      <div className="mt-4 space-y-3">
        <SignalDisclosure
          title="dream.audio.recorder"
          summary="Record and attach a spoken dream"
        >
          <ContextAudioRecorder
            onAudioUploaded={(
              path,
              previewUrl
            ) => {
              setAudioPath(path);
              setAudioPreviewUrl(
                previewUrl
              );
            }}
          />

          {audioPath ? (
            <div className="mt-3 border border-[#242424] bg-[#030303] p-3">
              <p className="terminal-green text-xs">
                &gt; Dream recording attached.
              </p>
              <p className="terminal-muted mt-1 break-all text-[10px]">
                {audioPath}
              </p>
              {audioPreviewUrl ? (
                <audio
                  controls
                  src={audioPreviewUrl}
                  className="mt-3 w-full"
                />
              ) : null}
            </div>
          ) : null}
        </SignalDisclosure>

        <SignalDisclosure
          title="dream.transcript"
          summary="Raw and cleaned dream transcript"
        >
          <div className="space-y-3">
            <label className="block">
              <FieldLabel>
                Raw transcript
              </FieldLabel>
              <textarea
                value={rawTranscript}
                onChange={(event) =>
                  setRawTranscript(
                    event.target.value
                  )
                }
                className={`${inputClassName} min-h-[110px] resize-y leading-6`}
                placeholder="Speech-to-text or manual transcript..."
              />
            </label>
            <label className="block">
              <FieldLabel>
                Cleaned transcript
              </FieldLabel>
              <textarea
                value={cleanedTranscript}
                onChange={(event) =>
                  setCleanedTranscript(
                    event.target.value
                  )
                }
                className={`${inputClassName} min-h-[110px] resize-y leading-6`}
                placeholder="Cleaned dream text..."
              />
            </label>
          </div>
        </SignalDisclosure>
      </div>

      <button
        type="button"
        onClick={saveDream}
        disabled={isPending}
        className="mt-4 min-h-[50px] w-full border border-[#39ff88] bg-[#000000] px-4 py-3 text-left text-sm text-[#39ff88] disabled:opacity-60"
      >
        &gt;{" "}
        {isPending
          ? "saving dream..."
          : "save dream_signal"}
      </button>

      {message ? (
        <p className="mt-3 text-xs text-[#ffb020]">
          &gt; {message}
        </p>
      ) : null}

      <div className="mt-5">
        <SignalDisclosure
          title="recent.dream.signals"
          count={sortedEntries.length}
          summary="Dream history, transcripts, and interpretations"
        >
          <div className="max-h-[680px] overflow-y-auto border border-[#242424]">
            {sortedEntries.length > 0 ? (
              sortedEntries.map(
                (entry, index) => {
                  const created =
                    new Date(
                      entry.created_at
                    );
                  const interpretation =
                    interpretationByEntry[
                      entry.id
                    ];

                  return (
                    <article
                      key={`${entry.id}-${entry.created_at}-${index}`}
                      className="terminal-line p-3 text-xs"
                    >
                      <div className="mb-2 flex flex-wrap justify-between gap-2">
                        <span className="terminal-green">
                          {entry.title ||
                            "Untitled Dream"}
                        </span>
                        <span className="terminal-muted">
                          {created.toLocaleDateString()}{" "}
                          {created.toLocaleTimeString(
                            [],
                            {
                              hour: "2-digit",
                              minute:
                                "2-digit",
                            }
                          )}
                        </span>
                      </div>

                      <p className="whitespace-pre-wrap leading-6">
                        {entry.content ||
                          entry.cleaned_transcript ||
                          entry.raw_transcript ||
                          "Audio-only dream signal."}
                      </p>

                      {entry.audio_path ? (
                        <div className="mt-3 border border-[#242424] bg-[#030303] p-3">
                          <p className="terminal-green break-all">
                            audio:{" "}
                            {entry.audio_path}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              transcribeDream(
                                entry
                              )
                            }
                            disabled={
                              transcribingEntryId ===
                              entry.id
                            }
                            className="mt-3 min-h-[46px] w-full border border-[#39ff88] px-3 py-2 text-left text-[#39ff88] disabled:opacity-50"
                          >
                            &gt;{" "}
                            {transcribingEntryId ===
                            entry.id
                              ? "transcribing_dream..."
                              : "speech_to_text"}
                          </button>
                        </div>
                      ) : null}

                      <button
                        type="button"
                        onClick={() =>
                          interpretDream(entry)
                        }
                        disabled={
                          interpretingEntryId ===
                          entry.id
                        }
                        className="mt-3 min-h-[46px] w-full border border-[#39ff88] px-3 py-2 text-left text-[#39ff88] disabled:opacity-50"
                      >
                        &gt;{" "}
                        {interpretingEntryId ===
                        entry.id
                          ? "interpreting_dream..."
                          : interpretation
                            ? "re-interpret_dream"
                            : "interpret_dream"}
                      </button>

                      <TranscriptView
                        raw={
                          entry.raw_transcript
                        }
                        cleaned={
                          entry.cleaned_transcript
                        }
                      />

                      {interpretation ? (
                        <DreamInterpretationView
                          interpretation={
                            interpretation
                          }
                        />
                      ) : null}
                    </article>
                  );
                }
              )
            ) : (
              <p className="terminal-muted p-3 text-xs">
                &gt; No dream signals archived yet.
              </p>
            )}
          </div>
        </SignalDisclosure>
      </div>
    </TerminalBlock>
  );
}

function parseList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function TranscriptView({
  raw,
  cleaned,
}: {
  raw: string | null;
  cleaned: string | null;
}) {
  if (!raw && !cleaned) return null;

  return (
    <div className="mt-3 border border-[#242424] bg-[#030303] p-3">
      {raw ? (
        <div>
          <p className="terminal-green">
            raw transcript:
          </p>
          <p className="terminal-muted mt-1 whitespace-pre-wrap leading-6">
            {raw}
          </p>
        </div>
      ) : null}
      {cleaned ? (
        <div className={raw ? "mt-3" : ""}>
          <p className="terminal-green">
            cleaned transcript:
          </p>
          <p className="terminal-muted mt-1 whitespace-pre-wrap leading-6">
            {cleaned}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function DreamInterpretationView({
  interpretation,
}: {
  interpretation: DreamInterpretation;
}) {
  return (
    <div className="mt-3 border border-[#39ff88] bg-[#000000] p-3 text-xs leading-6">
      <p className="terminal-green mb-3 uppercase tracking-[0.18em]">
        &gt; dream.interpretation
      </p>
      <DreamSection
        title="SUMMARY"
        content={interpretation.summary}
      />
      {interpretation.emotional_themes &&
      interpretation.emotional_themes
        .length > 0 ? (
        <DreamSection
          title="POSSIBLE THEMES"
          content={interpretation.emotional_themes.join(
            ", "
          )}
        />
      ) : null}
      <DreamSection
        title="PATTERN NOTICED"
        content={
          interpretation.pattern_noticed
        }
      />
      <DreamSection
        title="JUNGIAN LENS"
        content={
          interpretation.jungian_lens
        }
      />
      <DreamSection
        title="FREUDIAN LENS"
        content={
          interpretation.freudian_lens
        }
      />
      <DreamSection
        title="NEUROSCIENCE LENS"
        content={
          interpretation.neuroscience_lens
        }
      />
      <DreamSection
        title="COMPASSIONATE REFRAME"
        content={
          interpretation.compassionate_reframe
        }
      />
      {interpretation.questions &&
      interpretation.questions.length >
        0 ? (
        <div className="mt-3">
          <p className="terminal-green">
            QUESTIONS:
          </p>
          <ul className="terminal-muted mt-1 space-y-1">
            {interpretation.questions.map(
              (question, index) => (
                <li
                  key={`${question}-${index}`}
                >
                  &gt; {question}
                </li>
              )
            )}
          </ul>
        </div>
      ) : null}
      <DreamSection
        title="ONE GROUNDED ACTION"
        content={
          interpretation.action_step
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
      <p className="terminal-green">
        {title}:
      </p>
      <p className="terminal-muted mt-1 whitespace-pre-wrap">
        {content}
      </p>
    </div>
  );
}

const inputClassName =
  "mt-2 w-full border border-[#242424] bg-[#000000] px-3 py-3 text-sm text-[#e5e5e5] outline-none focus:border-[#39ff88]";

function FieldLabel({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <span className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
      {children}
    </span>
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
