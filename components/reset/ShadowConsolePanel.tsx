"use client";

import {
  useMemo,
  useState,
  useTransition,
} from "react";
import { ContextAudioRecorder } from "@/components/reset/ContextAudioRecorder";
import { SignalDisclosure } from "@/components/reset/SignalDisclosure";
import { createClient } from "@/utils/supabase/client";

type ShadowEntry = {
  id: string;
  entry_type: "shadow";
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

type SavedShadowEntryRow = {
  log_id: string;
  log_entry_type: "shadow";
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

type ShadowConsolePanelProps = {
  initialEntries: ShadowEntry[];
};

const hardShadowPrompts = [
  "What truth am I avoiding because admitting it would force me to change?",
  "Where am I choosing comfort over becoming who I say I want to be?",
  "What part of me still wants validation from someone who hurt me?",
  "What emotion do I keep disguising as anger?",
  "Where am I abandoning myself to avoid being abandoned by someone else?",
  "What pattern do I keep calling love even though it feels like anxiety?",
  "What am I pretending not to know?",
  "What version of myself am I grieving?",
  "Where am I performing instead of being honest?",
  "What would I have to feel if I stopped distracting myself?",
  "What boundary am I afraid to set because I fear the reaction?",
  "What am I getting from staying stuck?",
  "What need feels embarrassing to admit?",
  "Where am I confusing intensity with connection?",
  "What part of me am I still punishing?",
  "Where am I waiting to be rescued instead of choosing myself?",
  "What fear is running the system today?",
  "What would the greatest version of me tell the part of me that feels rejected?",
];

export function ShadowConsolePanel({
  initialEntries,
}: ShadowConsolePanelProps) {
  const supabase = createClient();
  const [isPending, startTransition] =
    useTransition();
  const [entries, setEntries] =
    useState<ShadowEntry[]>(
      initialEntries
    );
  const [response, setResponse] =
    useState("");
  const [nextAction, setNextAction] =
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

  const dailyPrompt = useMemo(() => {
    const now = new Date();
    const seed =
      now.getFullYear() * 10000 +
      (now.getMonth() + 1) * 100 +
      now.getDate();

    return hardShadowPrompts[
      seed % hardShadowPrompts.length
    ];
  }, []);

  const sortedEntries = useMemo(
    () =>
      [...entries].sort((a, b) =>
        b.created_at.localeCompare(
          a.created_at
        )
      ),
    [entries]
  );

  function saveShadowEntry() {
    const cleanResponse =
      response.trim();
    const cleanRaw =
      rawTranscript.trim();
    const cleanCleaned =
      cleanedTranscript.trim();
    if (
      cleanResponse.length < 2 &&
      cleanRaw.length < 2 &&
      cleanCleaned.length < 2 &&
      !audioPath
    ) {
      setMessage(
        "Write, record, or transcribe at least one shadow signal."
      );
      return;
    }

    const storedContent =
      cleanResponse ||
      cleanCleaned ||
      cleanRaw ||
      "Audio shadow signal.";

    setMessage(null);

    startTransition(async () => {
      const { data: rawData, error } =
        await supabase
          .rpc("add_shadow_entry", {
            target_trigger: dailyPrompt,
            target_emotion: "",
            target_story: storedContent,
            target_need: "",
            target_response: "",
            target_next_action:
              nextAction.trim(),
            target_energy: null,
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
          "Shadow signal saved, but no record was returned."
        );
        return;
      }

      const data =
        rawData as unknown as SavedShadowEntryRow;

      const attachment =
        await attachJournalMedia({
          journalEntryId: data.log_id,
          audioPath,
          rawTranscript:
            cleanRaw || null,
          cleanedTranscript:
            cleanCleaned || null,
        });

      setEntries((current) => [
        {
          id: data.log_id,
          entry_type: "shadow",
          title:
            data.log_title ||
            dailyPrompt,
          content: data.log_content,
          mood: null,
          energy:
            data.log_energy,
          tags: data.log_tags,
          audio_path: audioPath,
          raw_transcript:
            cleanRaw || null,
          cleaned_transcript:
            cleanCleaned || null,
          created_at:
            data.log_created_at,
        },
        ...current,
      ]);

      setResponse("");
      setNextAction("");
      setAudioPath(null);
      setAudioPreviewUrl(null);
      setRawTranscript("");
      setCleanedTranscript("");
      setMessage(
        attachment.ok
          ? "Shadow signal saved."
          : `Shadow signal saved, but audio/transcript linking failed: ${attachment.error}`
      );
    });
  }

  async function transcribeEntry(
    entry: ShadowEntry
  ) {
    if (!entry.audio_path) {
      setMessage(
        "No audio is attached to this shadow entry."
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
        "Shadow audio transcribed."
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
    <TerminalBlock title="shadow.console">
      <p className="terminal-muted text-xs leading-6">
        &gt; One prompt. One honest response. Write
        it or speak it.
      </p>

      <div className="mt-3 border border-[#39ff88] bg-[#000000] p-4">
        <p className="terminal-muted text-[10px] uppercase tracking-[0.18em]">
          TODAY'S QUESTION
        </p>
        <p className="terminal-green mt-3 leading-7">
          {dailyPrompt}
        </p>
      </div>

      <label className="mt-3 block">
        <FieldLabel>Your response</FieldLabel>
        <textarea
          value={response}
          onChange={(event) =>
            setResponse(event.target.value)
          }
          placeholder="Write the answer underneath the first answer..."
          className={`${inputClassName} min-h-[220px] resize-y leading-6`}
        />
      </label>

      <label className="mt-3 block">
        <FieldLabel>
          One grounded action
        </FieldLabel>
        <input
          value={nextAction}
          onChange={(event) =>
            setNextAction(
              event.target.value
            )
          }
          placeholder="What will you do with this awareness?"
          className={inputClassName}
        />
      </label>

      <div className="mt-4 space-y-3">
        <SignalDisclosure
          title="shadow.audio.recorder"
          summary="Record and attach a spoken shadow response"
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
                &gt; Shadow recording attached.
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
          title="shadow.transcript"
          summary="Raw and cleaned shadow transcript"
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
        onClick={saveShadowEntry}
        disabled={isPending}
        className="mt-4 min-h-[50px] w-full border border-[#39ff88] bg-[#050505] px-4 py-3 text-left text-sm text-[#39ff88] transition hover:bg-[#0d0d0d] disabled:opacity-60"
      >
        &gt;{" "}
        {isPending
          ? "saving shadow_signal..."
          : "save shadow_signal"}
      </button>

      {message ? (
        <p className="mt-3 text-xs text-[#ffb020]">
          &gt; {message}
        </p>
      ) : null}

      <div className="mt-5">
        <SignalDisclosure
          title="recent.shadow.signals"
          count={sortedEntries.length}
          summary="Past shadow responses and transcripts"
        >
          <div className="max-h-[560px] overflow-y-auto border border-[#242424]">
            {sortedEntries.length > 0 ? (
              sortedEntries.map(
                (entry, index) => {
                  const created =
                    new Date(
                      entry.created_at
                    );

                  return (
                    <article
                      key={`${entry.id}-${entry.created_at}-${index}`}
                      className="terminal-line p-3 text-xs"
                    >
                      <div className="mb-2 flex flex-wrap justify-between gap-2">
                        <span className="terminal-green">
                          {entry.title ||
                            "Shadow Entry"}
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
                        {entry.content}
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
                              transcribeEntry(
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
                              ? "transcribing_shadow..."
                              : "speech_to_text"}
                          </button>
                        </div>
                      ) : null}

                      <TranscriptView
                        raw={
                          entry.raw_transcript
                        }
                        cleaned={
                          entry.cleaned_transcript
                        }
                      />
                    </article>
                  );
                }
              )
            ) : (
              <p className="terminal-muted p-3 text-xs">
                &gt; No shadow signals saved yet.
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
