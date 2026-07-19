"use client";

import {
  useMemo,
  useState,
  useTransition,
} from "react";
import { ContextAudioRecorder } from "@/components/reset/ContextAudioRecorder";
import { SignalDisclosure } from "@/components/reset/SignalDisclosure";
import { createClient } from "@/utils/supabase/client";

type EntryType =
  | "reflection"
  | "freewrite";

type JournalEntry = {
  id: string;
  entry_type: EntryType;
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

type SavedJournalEntryRow = {
  log_id: string;
  log_entry_type: EntryType;
  log_title: string | null;
  log_content: string;
  log_mood: string | null;
  log_energy: number | null;
  log_tags: string[] | null;
  log_created_at: string;
};

type TranscriptionResponse = {
  rawTranscript?: string;
  cleanedTranscript?: string;
  error?: string;
};

type ReflectionLogPanelProps = {
  initialEntries: JournalEntry[];
};

export function ReflectionLogPanel({
  initialEntries,
}: ReflectionLogPanelProps) {
  const supabase = createClient();
  const [isPending, startTransition] =
    useTransition();
  const [entries, setEntries] =
    useState<JournalEntry[]>(initialEntries);
  const [entryType, setEntryType] =
    useState<EntryType>("reflection");
  const [mood, setMood] = useState("");
  const [content, setContent] =
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

  function saveEntry() {
    const cleanContent = content.trim();
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
        "Write, record, or transcribe at least one reflection signal."
      );
      return;
    }

    const storedContent =
      cleanContent ||
      cleanCleaned ||
      cleanRaw ||
      "Audio reflection signal.";

    setMessage(null);

    startTransition(async () => {
      const { data: rawData, error } =
        await supabase
          .rpc("add_journal_entry", {
            target_entry_type: entryType,
            target_title: null,
            target_content: storedContent,
            target_mood:
              mood.trim() || null,
            target_energy: null,
            target_tags: [],
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
          "Reflection saved, but no record was returned."
        );
        return;
      }

      const data =
        rawData as unknown as SavedJournalEntryRow;

      const attachmentResult =
        await attachJournalMedia({
          journalEntryId: data.log_id,
          audioPath,
          rawTranscript:
            cleanRaw || null,
          cleanedTranscript:
            cleanCleaned || null,
        });

      if (!attachmentResult.ok) {
        setMessage(
          `Reflection saved, but audio/transcript linking failed: ${attachmentResult.error}`
        );
      } else {
        setMessage(
          "Reflection signal saved."
        );
      }

      const savedEntry: JournalEntry = {
        id: data.log_id,
        entry_type:
          data.log_entry_type,
        title: null,
        content: data.log_content,
        mood: data.log_mood,
        energy: null,
        tags: [],
        audio_path: audioPath,
        raw_transcript:
          cleanRaw || null,
        cleaned_transcript:
          cleanCleaned || null,
        created_at:
          data.log_created_at,
      };

      setEntries((current) => [
        savedEntry,
        ...current,
      ]);
      setContent("");
      setMood("");
      setAudioPath(null);
      setAudioPreviewUrl(null);
      setRawTranscript("");
      setCleanedTranscript("");
    });
  }

  async function transcribeEntry(
    entry: JournalEntry
  ) {
    if (!entry.audio_path) {
      setMessage(
        "No audio is attached to this reflection."
      );
      return;
    }

    setMessage(null);
    setTranscribingEntryId(entry.id);

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
        "Reflection audio transcribed."
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

  return (
    <TerminalBlock title="reflection.log">
      <p className="terminal-muted mb-3 text-xs leading-6">
        &gt; Write or speak the signal. Reflection
        capture stays separate from AI interpretation.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <FieldLabel>Entry type</FieldLabel>
          <select
            value={entryType}
            onChange={(event) =>
              setEntryType(
                event.target.value as EntryType
              )
            }
            className={inputClassName}
          >
            <option value="reflection">
              daily reflection
            </option>
            <option value="freewrite">
              freewrite
            </option>
          </select>
        </label>

        <label className="block">
          <FieldLabel>Mood</FieldLabel>
          <input
            value={mood}
            onChange={(event) =>
              setMood(event.target.value)
            }
            placeholder="calm, heavy, focused..."
            className={inputClassName}
          />
        </label>
      </div>

      <label className="mt-3 block">
        <FieldLabel>Reflection</FieldLabel>
        <textarea
          value={content}
          onChange={(event) =>
            setContent(event.target.value)
          }
          placeholder="Type the signal..."
          className={`${inputClassName} min-h-[220px] resize-y leading-6`}
        />
      </label>

      <div className="mt-4 space-y-3">
        <SignalDisclosure
          title="reflection.audio.recorder"
          summary="Record and attach a spoken reflection"
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
                &gt; Reflection recording attached.
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
          title="reflection.transcript"
          summary="Raw and cleaned reflection transcript"
        >
          <TranscriptFields
            rawTranscript={rawTranscript}
            cleanedTranscript={
              cleanedTranscript
            }
            setRawTranscript={
              setRawTranscript
            }
            setCleanedTranscript={
              setCleanedTranscript
            }
          />
        </SignalDisclosure>
      </div>

      <button
        type="button"
        onClick={saveEntry}
        disabled={isPending}
        className="mt-4 min-h-[50px] w-full border border-[#39ff88] bg-[#050505] px-4 py-3 text-left text-sm text-[#39ff88] transition hover:bg-[#0d0d0d] disabled:cursor-not-allowed disabled:opacity-60"
      >
        &gt;{" "}
        {isPending
          ? "saving reflection..."
          : "save reflection_log"}
      </button>

      {message ? (
        <p className="mt-3 text-xs text-[#ffb020]">
          &gt; {message}
        </p>
      ) : null}

      <div className="mt-5">
        <SignalDisclosure
          title="recent.reflection.signals"
          count={sortedEntries.length}
          summary="Written, recorded, and transcribed reflections"
        >
          <div className="max-h-[560px] overflow-y-auto border border-[#242424]">
            {sortedEntries.length > 0 ? (
              sortedEntries.map(
                (entry, index) => (
                  <JournalHistoryEntry
                    key={`${entry.id}-${entry.created_at}-${index}`}
                    entry={entry}
                    transcribing={
                      transcribingEntryId ===
                      entry.id
                    }
                    onTranscribe={() =>
                      transcribeEntry(entry)
                    }
                  />
                )
              )
            ) : (
              <p className="terminal-muted p-3 text-xs">
                &gt; No reflection signals saved yet.
              </p>
            )}
          </div>
        </SignalDisclosure>
      </div>
    </TerminalBlock>
  );
}

async function attachJournalMedia({
  journalEntryId,
  audioPath,
  rawTranscript,
  cleanedTranscript,
}: {
  journalEntryId: string;
  audioPath: string | null;
  rawTranscript: string | null;
  cleanedTranscript: string | null;
}): Promise<
  | { ok: true }
  | { ok: false; error: string }
> {
  if (
    !audioPath &&
    !rawTranscript &&
    !cleanedTranscript
  ) {
    return { ok: true };
  }

  try {
    const response = await fetch(
      "/api/journal-audio",
      {
        method: "PATCH",
        headers: {
          "Content-Type":
            "application/json",
        },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({
          journalEntryId,
          audioPath,
          rawTranscript,
          cleanedTranscript,
        }),
      }
    );

    const payload =
      (await response
        .json()
        .catch(() => null)) as
        | { error?: string }
        | null;

    if (!response.ok) {
      return {
        ok: false,
        error:
          payload?.error ??
          "Attachment update failed.",
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Attachment update failed.",
    };
  }
}

function JournalHistoryEntry({
  entry,
  transcribing,
  onTranscribe,
}: {
  entry: JournalEntry;
  transcribing: boolean;
  onTranscribe: () => void;
}) {
  const created = new Date(
    entry.created_at
  );

  return (
    <article className="terminal-line p-3 text-xs">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="terminal-green">
          {entry.entry_type ===
          "freewrite"
            ? "Freewrite"
            : "Daily Reflection"}
        </span>
        <span className="terminal-muted">
          {created.toLocaleDateString()}{" "}
          {created.toLocaleTimeString(
            [],
            {
              hour: "2-digit",
              minute: "2-digit",
            }
          )}
        </span>
      </div>

      <p className="whitespace-pre-wrap leading-6 text-[#e5e5e5]">
        {entry.content}
      </p>

      {entry.mood ? (
        <p className="terminal-muted mt-2">
          mood: {entry.mood}
        </p>
      ) : null}

      {entry.audio_path ? (
        <div className="mt-3 border border-[#242424] bg-[#030303] p-3">
          <p className="terminal-green break-all">
            audio: {entry.audio_path}
          </p>
          <button
            type="button"
            onClick={onTranscribe}
            disabled={transcribing}
            className="mt-3 min-h-[46px] w-full border border-[#39ff88] bg-[#000000] px-3 py-2 text-left text-[#39ff88] disabled:opacity-50"
          >
            &gt;{" "}
            {transcribing
              ? "transcribing_reflection..."
              : "speech_to_text"}
          </button>
        </div>
      ) : null}

      <TranscriptView
        raw={entry.raw_transcript}
        cleaned={
          entry.cleaned_transcript
        }
      />
    </article>
  );
}

function TranscriptFields({
  rawTranscript,
  cleanedTranscript,
  setRawTranscript,
  setCleanedTranscript,
}: {
  rawTranscript: string;
  cleanedTranscript: string;
  setRawTranscript: (
    value: string
  ) => void;
  setCleanedTranscript: (
    value: string
  ) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="block">
        <FieldLabel>Raw transcript</FieldLabel>
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
      <label className="mt-3 block">
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
          placeholder="Cleaned version..."
        />
      </label>
    </div>
  );
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

const inputClassName =
  "mt-2 w-full border border-[#242424] bg-[#050505] px-3 py-3 text-sm text-[#e5e5e5] outline-none focus:border-[#39ff88]";

function FieldLabel({
  children,
}: {
  children: React.ReactNode;
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
  children: React.ReactNode;
}) {
  return (
    <section className="border border-[#242424] bg-[#050505]">
      <div className="border-b border-[#242424] bg-[#0d0d0d] px-3 py-2">
        <p className="terminal-green text-xs uppercase tracking-[0.2em]">
          &gt; {title}
        </p>
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}
