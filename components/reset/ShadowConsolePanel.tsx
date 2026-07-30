"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  ContextAudioRecorder,
  type CapturedAudioState,
} from "@/components/reset/ContextAudioRecorder";
import { SignalDisclosure } from "@/components/reset/SignalDisclosure";
import { SignalEntryDisclosure } from "@/components/reset/SignalEntryDisclosure";
import { completeActivityHabit } from "@/lib/completeActivityHabit";
import { dispatchDailyResetDataChanged } from "@/lib/dailyResetEvents";
import {
  OFFLINE_QUEUE_EVENT,
  cancelPendingAudioForEntity,
  createOfflineAudioPreviewUrl,
  createOfflineEntityId,
  enqueueOfflineOperation,
  getOfflineOperations,
  getPendingAudioUpload,
  readOfflineCache,
  removeOfflineAudio,
  removeOfflineOperation,
  syncOfflineQueue,
  writeOfflineCache,
} from "@/lib/offlineStore";
import { createClient } from "@/utils/supabase/client";

type CaptureMode = "manual" | "voice";

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
  pending?: boolean;
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

type AIReflection = {
  id: string;
  journal_entry_id: string;
  reflection_type: "journal" | "shadow" | "dream" | "daily_review";
  summary: string | null;
  pattern_noticed: string | null;
  compassionate_reframe: string | null;
  questions: string[] | null;
  action_step: string | null;
  model: string | null;
  created_at: string;
};

type ShadowConsolePanelProps = {
  initialEntries: ShadowEntry[];
  initialReflections: AIReflection[];
};

type TranscriptionResponse = {
  rawTranscript?: string;
  cleanedTranscript?: string;
  content?: string;
  error?: string;
};

type ReflectionResponse = {
  reflection?: AIReflection;
  error?: string;
};

type ShadowMutationResponse = {
  entry?: ShadowEntry;
  error?: string;
};

type PendingAudioCapture = {
  blobKey: string;
  storagePath: string;
  contentType: string;
};

const ACTION_MARKER = "\n\n[GROUNDED ACTION]\n";
const SHADOW_CACHE_KEY =
  "daily-reset:shadow-entries:v1";

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
  initialReflections,
}: ShadowConsolePanelProps) {
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  const dailyPrompt = useMemo(() => {
    const now = new Date();
    const seed =
      now.getFullYear() * 10000 +
      (now.getMonth() + 1) * 100 +
      now.getDate();

    return hardShadowPrompts[seed % hardShadowPrompts.length];
  }, []);

  const [entries, setEntries] = useState<ShadowEntry[]>(initialEntries);
  const [reflections, setReflections] =
    useState<AIReflection[]>(initialReflections);

  const [captureMode, setCaptureMode] =
    useState<CaptureMode>("manual");
  const [activeEntryId, setActiveEntryId] =
    useState<string | null>(null);
  const [activeCreatedAt, setActiveCreatedAt] =
    useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [promptText, setPromptText] = useState(dailyPrompt);
  const [responseText, setResponseText] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] =
    useState<string | null>(null);
  const [
    pendingAudioCapture,
    setPendingAudioCapture,
  ] = useState<PendingAudioCapture | null>(
    null
  );
  const [rawTranscript, setRawTranscript] = useState("");
  const [cleanedTranscript, setCleanedTranscript] = useState("");
  const [transcribingEntryId, setTranscribingEntryId] =
    useState<string | null>(null);
  const [reflectingEntryId, setReflectingEntryId] =
    useState<string | null>(null);
  const [deletingEntryId, setDeletingEntryId] =
    useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (navigator.onLine) {
      return;
    }

    void readOfflineCache<ShadowEntry[]>(
      SHADOW_CACHE_KEY
    ).then((cached) => {
      if (
        !cancelled &&
        cached &&
        cached.length > 0
      ) {
        setEntries(cached);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void writeOfflineCache(
      SHADOW_CACHE_KEY,
      entries
    );
  }, [entries]);

  useEffect(() => {
    const refreshPending = async () => {
      const operations =
        await getOfflineOperations();
      const pendingIds = new Set(
        operations
          .filter(
            (operation) =>
              (
                operation.kind ===
                  "journal" &&
                operation.payload
                  .entryType ===
                  "shadow"
              ) ||
              (
                operation.kind ===
                  "audio-upload" &&
                operation.payload
                  .entryType ===
                  "shadow"
              )
          )
          .map((operation) =>
            operation.kind ===
              "journal" ||
            operation.kind ===
              "audio-upload"
              ? operation.payload
                  .entityId
              : ""
          )
      );

      setEntries((current) =>
        current.map((entry) => ({
          ...entry,
          pending: pendingIds.has(entry.id),
        }))
      );
    };

    const handleQueue = (
      event: Event
    ) => {
      const detail = (
        event as CustomEvent<{
          lastError?: string | null;
        }>
      ).detail;

      if (
        detail?.lastError?.startsWith(
          "[CONFLICT]"
        ) ||
        detail?.lastError?.startsWith(
          "[MISSING AUDIO]"
        )
      ) {
        setMessage(
          detail.lastError
        );
      }

      void refreshPending();
    };

    window.addEventListener(
      OFFLINE_QUEUE_EVENT,
      handleQueue
    );
    void refreshPending();

    return () => {
      window.removeEventListener(
        OFFLINE_QUEUE_EVENT,
        handleQueue
      );
    };
  }, []);

  const sortedEntries = useMemo(
    () =>
      [...entries].sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
      ),
    [entries]
  );

  const reflectionByEntry = useMemo(
    () =>
      reflections.reduce<Record<string, AIReflection>>(
        (accumulator, reflection) => {
          if (!accumulator[reflection.journal_entry_id]) {
            accumulator[reflection.journal_entry_id] = reflection;
          }
          return accumulator;
        },
        {}
      ),
    [reflections]
  );

  const currentSourceText =
    captureMode === "manual"
      ? responseText.trim()
      : cleanedTranscript.trim() || rawTranscript.trim();

  const canReflectCurrent = Boolean(
    activeEntryId &&
      !entries.find((entry) => entry.id === activeEntryId)?.pending &&
      !hasUnsavedChanges &&
      currentSourceText.length >= 2
  );

  const activeEntry = activeEntryId
    ? entries.find((entry) => entry.id === activeEntryId) ?? null
    : null;

  function markChanged() {
    setHasUnsavedChanges(true);
    setMessage(null);
  }

  function resetEditor() {
    if (
      pendingAudioCapture &&
      !activeEntryId
    ) {
      void removeOfflineAudio(
        pendingAudioCapture.blobKey
      );
    }

    setCaptureMode("manual");
    setActiveEntryId(null);
    setActiveCreatedAt(null);
    setHasUnsavedChanges(false);
    setPromptText(dailyPrompt);
    setResponseText("");
    setNextAction("");
    setAudioPath(null);
    setAudioPreviewUrl(null);
    setPendingAudioCapture(null);
    setRawTranscript("");
    setCleanedTranscript("");
    setMessage(null);
  }

  function switchCaptureMode(nextMode: CaptureMode) {
    if (nextMode === captureMode) return;

    setCaptureMode(nextMode);
    setHasUnsavedChanges(true);
    setMessage(null);

    if (nextMode === "manual") {
      if (
        pendingAudioCapture &&
        !activeEntryId
      ) {
        void removeOfflineAudio(
          pendingAudioCapture.blobKey
        );
      }

      setAudioPath(null);
      setAudioPreviewUrl(null);
      setPendingAudioCapture(null);
      setRawTranscript("");
      setCleanedTranscript("");
    } else {
      setResponseText("");
    }
  }

  function loadEntry(entry: ShadowEntry) {
    const nextMode: CaptureMode = entry.audio_path ? "voice" : "manual";
    const parts = splitShadowContent(entry.content);

    setActiveEntryId(entry.id);
    setActiveCreatedAt(entry.created_at);
    setCaptureMode(nextMode);
    setPromptText(entry.title || dailyPrompt);
    setResponseText(nextMode === "manual" ? parts.response : "");
    setNextAction(parts.action);
    setAudioPath(entry.audio_path);
    setAudioPreviewUrl(null);
    setPendingAudioCapture(null);

    void getPendingAudioUpload(
      entry.id
    ).then(async (operation) => {
      if (!operation) {
        return;
      }

      setPendingAudioCapture({
        blobKey:
          operation.payload.blobKey,
        storagePath:
          operation.payload.storagePath,
        contentType:
          operation.payload.contentType,
      });

      const previewUrl =
        await createOfflineAudioPreviewUrl(
          entry.id
        );

      if (previewUrl) {
        setAudioPreviewUrl(
          previewUrl
        );
      }
    });

    setRawTranscript(entry.raw_transcript ?? "");
    setCleanedTranscript(entry.cleaned_transcript ?? "");
    setHasUnsavedChanges(false);
    setMessage("Shadow entry loaded into the editor.");

    requestAnimationFrame(() => {
      document.getElementById("shadow-editor")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function saveShadowEntry() {
    const cleanPrompt = promptText.trim();
    const cleanResponse = responseText.trim();
    const cleanAction = nextAction.trim();
    const cleanRaw = rawTranscript.trim();
    const cleanCleaned =
      cleanedTranscript.trim();

    if (cleanPrompt.length < 2) {
      setMessage(
        "A shadow prompt is required."
      );
      return;
    }

    if (
      captureMode === "manual" &&
      cleanResponse.length < 2
    ) {
      setMessage(
        "Write an honest response before saving."
      );
      return;
    }

    if (
      captureMode === "voice" &&
      !audioPath
    ) {
      setMessage(
        "Record the shadow response before saving."
      );
      return;
    }

    const existingEntry = activeEntryId
      ? entries.find(
          (entry) =>
            entry.id === activeEntryId
        ) ?? null
      : null;
    const hasNewAudio = Boolean(
      captureMode === "voice" &&
        pendingAudioCapture
    );
    const sourceText =
      captureMode === "manual"
        ? cleanResponse
        : cleanCleaned ||
          cleanRaw ||
          "Voice response awaiting transcription.";
    const storedContent =
      composeShadowContent(
        sourceText,
        cleanAction
      );

    setMessage(null);

    startTransition(async () => {
      const entityId =
        existingEntry?.id ??
        createOfflineEntityId();
      const createdAt =
        existingEntry?.created_at ??
        new Date().toISOString();
      const mutationAt =
        new Date().toISOString();
      const localAudioPath =
        captureMode === "voice"
          ? audioPath
          : null;
      const serverAudioPath =
        captureMode === "voice"
          ? hasNewAudio
            ? existingEntry?.pending
              ? null
              : existingEntry?.audio_path ?? null
            : audioPath
          : null;
      const nextRawTranscript =
        captureMode === "voice" &&
        !hasNewAudio
          ? cleanRaw || null
          : null;
      const nextCleanedTranscript =
        captureMode === "voice" &&
        !hasNewAudio
          ? cleanCleaned || null
          : null;
      const savedEntry: ShadowEntry = {
        id: entityId,
        entry_type: "shadow",
        title: cleanPrompt,
        content: storedContent,
        mood:
          existingEntry?.mood ?? null,
        energy:
          existingEntry?.energy ?? null,
        tags:
          existingEntry?.tags ?? [],
        audio_path: localAudioPath,
        raw_transcript:
          nextRawTranscript,
        cleaned_transcript:
          nextCleanedTranscript,
        created_at: createdAt,
        pending: true,
      };

      try {
        await removeOfflineOperation(
          `journal-delete:${entityId}`
        );

        if (
          captureMode === "manual"
        ) {
          await cancelPendingAudioForEntity(
            entityId
          );
        }

        await enqueueOfflineOperation({
          id: `journal:${entityId}`,
          kind: "journal",
          createdAt: mutationAt,
          payload: {
            entityId,
            entryType: "shadow",
            title: cleanPrompt,
            content: storedContent,
            mood:
              existingEntry?.mood ?? null,
            energy:
              existingEntry?.energy ?? null,
            tags:
              existingEntry?.tags ?? [],
            symbols: null,
            createdAt,
            audioPath:
              serverAudioPath,
            rawTranscript:
              nextRawTranscript,
            cleanedTranscript:
              nextCleanedTranscript,
            conflictGuard: Boolean(
              existingEntry &&
                !existingEntry.pending
            ),
            activity: "shadow",
            date: getLocalDateKey(),
          },
        });

        if (
          hasNewAudio &&
          pendingAudioCapture
        ) {
          await enqueueOfflineOperation({
            id:
              `audio-upload:${entityId}`,
            kind: "audio-upload",
            createdAt: mutationAt,
            payload: {
              entityId,
              entryType: "shadow",
              blobKey:
                pendingAudioCapture.blobKey,
              storagePath:
                pendingAudioCapture.storagePath,
              contentType:
                pendingAudioCapture.contentType,
            },
          });
        }

        setEntries((current) => [
          savedEntry,
          ...current.filter(
            (entry) =>
              entry.id !== entityId
          ),
        ]);
        setReflections((current) =>
          current.filter(
            (reflection) =>
              reflection.journal_entry_id !==
              entityId
          )
        );
        setActiveEntryId(entityId);
        setActiveCreatedAt(createdAt);
        setHasUnsavedChanges(false);

        dispatchDailyResetDataChanged({
          scopes: [
            "shadow",
            "journal",
            "analytics",
          ],
          source: "shadow",
          date: getLocalDateKey(),
        });

        const summary =
          await syncOfflineQueue();
        const stillPending =
          (
            await getOfflineOperations()
          ).some(
            (operation) =>
              operation.id ===
                `journal:${entityId}` ||
              operation.id ===
                `audio-upload:${entityId}`
          );

        setEntries((current) =>
          current.map((entry) =>
            entry.id === entityId
              ? {
                  ...entry,
                  pending: stillPending,
                }
              : entry
          )
        );

        if (!stillPending) {
          setPendingAudioCapture(null);
        }

        const conflict =
          summary.conflicts[0];

        setMessage(
          conflict ??
            (stillPending ||
            summary.errors.length > 0
              ? "Shadow entry saved on this device. It will retry automatically."
              : captureMode === "voice"
                ? "Shadow entry and recording synced. Transcription is ready."
                : "Shadow entry saved and synced.")
        );
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Shadow entry could not be stored on this device."
        );
      }
    });
  }

  async function updateShadow(
    entryId: string,
    values: {
      title: string;
      content: string;
      captureMode: CaptureMode;
      audioPath: string | null;
      rawTranscript: string;
      cleanedTranscript: string;
    }
  ) {
    const response = await fetch(`/api/shadows/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const result = (await response.json()) as ShadowMutationResponse;

    if (!response.ok || !result.entry) {
      throw new Error(result.error ?? "Shadow update failed.");
    }

    return result.entry;
  }

  async function transcribeEntry(
    entry: Pick<ShadowEntry, "id" | "audio_path" | "pending">
  ) {
    if (entry.pending || !navigator.onLine) {
      setMessage(
        "Sync the shadow entry before transcription."
      );
      return;
    }

    if (!entry.audio_path) {
      setMessage("No audio is attached to this shadow entry.");
      return;
    }

    setTranscribingEntryId(entry.id);
    setMessage(null);

    try {
      const response = await fetch("/api/transcribe-shadow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journalEntryId: entry.id,
          audioPath: entry.audio_path,
        }),
      });

      const result = (await response.json()) as TranscriptionResponse;

      if (
        !response.ok ||
        typeof result.rawTranscript !== "string" ||
        typeof result.cleanedTranscript !== "string"
      ) {
        throw new Error(result.error ?? "No transcript was returned.");
      }

      setEntries((current) =>
        current.map((candidate) =>
          candidate.id === entry.id
            ? {
                ...candidate,
                content: result.content ?? candidate.content,
                raw_transcript: result.rawTranscript ?? null,
                cleaned_transcript: result.cleanedTranscript ?? null,
              }
            : candidate
        )
      );

      setReflections((current) =>
        current.filter(
          (reflection) => reflection.journal_entry_id !== entry.id
        )
      );

      if (activeEntryId === entry.id) {
        setRawTranscript(result.rawTranscript);
        setCleanedTranscript(result.cleanedTranscript);
        setHasUnsavedChanges(false);
      }

      setMessage(
        "Shadow audio transcribed. The transcript is now editable."
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Transcription failed."
      );
    } finally {
      setTranscribingEntryId(null);
    }
  }

  async function clearTranscript() {
    if (
      !activeEntryId ||
      captureMode !== "voice" ||
      !audioPath
    ) {
      return;
    }

    setRawTranscript("");
    setCleanedTranscript("");
    setHasUnsavedChanges(true);
    setReflections((current) =>
      current.filter(
        (reflection) =>
          reflection.journal_entry_id !==
          activeEntryId
      )
    );
    setMessage(
      "Transcript cleared in the editor. Save changes to sync the deletion."
    );
  }

  async function reflectShadow(entry: ShadowEntry) {
    if (entry.pending || !navigator.onLine) {
      setMessage(
        "Sync the shadow entry before AI reflection."
      );
      return;
    }

    setReflectingEntryId(entry.id);
    setMessage(null);

    try {
      const response = await fetch("/api/reflect-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journalEntryId: entry.id }),
      });

      const result = (await response.json()) as ReflectionResponse;

      if (!response.ok || !result.reflection) {
        throw new Error(result.error ?? "No reflection was returned.");
      }

      const reflection = result.reflection;

      setReflections((current) => [
        reflection,
        ...current.filter(
          (item) => item.journal_entry_id !== entry.id
        ),
      ]);
      setMessage("Shadow reflection generated.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Shadow reflection failed."
      );
    } finally {
      setReflectingEntryId(null);
    }
  }

  async function reflectCurrent() {
    if (!activeEntryId) return;
    const entry = entries.find((candidate) => candidate.id === activeEntryId);
    if (entry) await reflectShadow(entry);
  }

  async function deleteShadow(
    entry: ShadowEntry
  ) {
    const confirmed = window.confirm(
      "Delete this shadow entry and its transcript/reflection? This cannot be undone."
    );

    if (!confirmed) return;

    setDeletingEntryId(entry.id);
    setMessage(null);

    try {
      await removeOfflineOperation(
        `journal:${entry.id}`
      );
      await cancelPendingAudioForEntity(
        entry.id
      );
      await enqueueOfflineOperation({
        id:
          `journal-delete:${entry.id}`,
        kind: "journal-delete",
        createdAt:
          new Date().toISOString(),
        payload: {
          entityId: entry.id,
        },
      });

      setEntries((current) =>
        current.filter(
          (candidate) =>
            candidate.id !== entry.id
        )
      );
      setReflections((current) =>
        current.filter(
          (reflection) =>
            reflection.journal_entry_id !==
            entry.id
        )
      );

      if (activeEntryId === entry.id) {
        resetEditor();
      }

      const summary =
        await syncOfflineQueue();
      const stillPending =
        (
          await getOfflineOperations()
        ).some(
          (operation) =>
            operation.id ===
            `journal-delete:${entry.id}`
        );

      setMessage(
        stillPending ||
          summary.errors.length > 0
          ? "Shadow deletion saved on this device. It will sync automatically."
          : "Shadow entry and attached audio deleted."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Shadow deletion failed."
      );
    } finally {
      setDeletingEntryId(null);
    }
  }

  return (
    <div className="p-3">
      <div id="shadow-editor" className="scroll-mt-20">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f4b32] bg-[#06110a] px-3 py-3">
          <div>
            <p className="terminal-green text-sm font-semibold tracking-[0.08em]">
              &gt; {activeEntryId ? "Edit Shadow Entry" : "Today's Shadow Work"}
            </p>
            {activeCreatedAt ? (
              <p className="terminal-muted mt-1 text-[10px]">
                saved {new Date(activeCreatedAt).toLocaleString()}
              </p>
            ) : null}
          </div>

          {activeEntryId ? (
            <button
              type="button"
              onClick={resetEditor}
              className="min-h-[38px] border border-[#365341] px-3 text-xs text-[#9fd8b5] transition hover:border-[#39ff88] hover:text-[#39ff88]"
            >
              new entry
            </button>
          ) : null}
        </div>

        <div className="p-3">
          <div className="border border-[#39ff88] bg-black p-4">
            <p className="terminal-muted text-[10px] uppercase tracking-[0.18em]">
              SHADOW PROMPT
            </p>
            <textarea
              value={promptText}
              onChange={(event) => {
                setPromptText(event.target.value);
                markChanged();
              }}
              className="terminal-green mt-3 min-h-[88px] w-full resize-y border-0 bg-transparent p-0 leading-7 outline-none"
            />
          </div>

          <div className="mt-4">
            <FieldLabel>Capture method</FieldLabel>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <ModeButton
                active={captureMode === "manual"}
                label="Manual"
                onClick={() => switchCaptureMode("manual")}
              />
              <ModeButton
                active={captureMode === "voice"}
                label="Voice"
                onClick={() => switchCaptureMode("voice")}
              />
            </div>
          </div>

          <div className="mt-4">
            <FieldLabel>Honest response</FieldLabel>

            {captureMode === "manual" ? (
              <textarea
                value={responseText}
                onChange={(event) => {
                  setResponseText(event.target.value);
                  markChanged();
                }}
                className={`${inputClassName} min-h-[240px] resize-y leading-6`}
              />
            ) : (
              <div className="mt-2 border border-[#242424] bg-[#030303] p-3">
                <ContextAudioRecorder
                  onAudioUploaded={(
                    path,
                    previewUrl,
                    captureState
                  ) => {
                    if (
                      pendingAudioCapture &&
                      pendingAudioCapture.blobKey !==
                        captureState?.blobKey
                    ) {
                      void removeOfflineAudio(
                        pendingAudioCapture.blobKey
                      );
                    }

                    setAudioPath(path);
                    setAudioPreviewUrl(
                      previewUrl
                    );
                    setPendingAudioCapture(
                      toPendingAudioCapture(
                        captureState
                      )
                    );
                    setRawTranscript("");
                    setCleanedTranscript("");
                    setHasUnsavedChanges(true);
                    setMessage(
                      captureState?.pendingUpload
                        ? "Audio saved on this device. Save the shadow entry to queue upload."
                        : "Audio uploaded. Save the shadow entry before transcription."
                    );
                  }}
                  contextLabel="shadow"
                  savedDreamId={
                    hasUnsavedChanges ||
                    activeEntry?.pending ||
                    Boolean(
                      pendingAudioCapture
                    )
                      ? null
                      : activeEntryId
                  }
                  savedAudioPath={
                    hasUnsavedChanges ||
                    activeEntry?.pending ||
                    Boolean(
                      pendingAudioCapture
                    )
                      ? null
                      : audioPath
                  }
                  isTranscribing={
                    Boolean(activeEntryId) &&
                    transcribingEntryId === activeEntryId
                  }
                  onTranscribe={async () => {
                    if (
                      !activeEntryId ||
                      !audioPath ||
                      hasUnsavedChanges ||
                      activeEntry?.pending ||
                      Boolean(
                        pendingAudioCapture
                      )
                    ) {
                      setMessage(
                        "Save the voice entry before transcribing it."
                      );
                      return;
                    }

                    await transcribeEntry({
                      id: activeEntryId,
                      audio_path: audioPath,
                      pending:
                        activeEntry?.pending,
                    });
                  }}
                />

                {audioPath ? (
                  <div className="mt-3 border-t border-[#242424] pt-3">
                    <p className="terminal-green text-xs">
                      &gt;{" "}
                      {pendingAudioCapture ||
                      activeEntry?.pending
                        ? "recording stored on device"
                        : "recording attached"}
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

                {rawTranscript || cleanedTranscript ? (
                  <div className="mt-4 space-y-3 border-t border-[#242424] pt-4">
                    <label className="block">
                      <FieldLabel>Raw transcript</FieldLabel>
                      <textarea
                        value={rawTranscript}
                        onChange={(event) => {
                          setRawTranscript(event.target.value);
                          markChanged();
                        }}
                        className={`${inputClassName} min-h-[110px] resize-y leading-6`}
                      />
                    </label>

                    <label className="block">
                      <FieldLabel>Cleaned transcript</FieldLabel>
                      <textarea
                        value={cleanedTranscript}
                        onChange={(event) => {
                          setCleanedTranscript(event.target.value);
                          markChanged();
                        }}
                        className={`${inputClassName} min-h-[110px] resize-y leading-6`}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => void clearTranscript()}
                      disabled={isPending}
                      className="min-h-[42px] w-full border border-[#6b3030] px-3 py-2 text-left text-xs text-[#ff7b7b] transition hover:border-[#ff4d4d] disabled:opacity-50"
                    >
                      &gt; delete transcript
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <label className="mt-4 block">
            <FieldLabel>One grounded action</FieldLabel>
            <input
              value={nextAction}
              onChange={(event) => {
                setNextAction(event.target.value);
                markChanged();
              }}
              className={inputClassName}
            />
          </label>

          <button
            type="button"
            onClick={() => void reflectCurrent()}
            disabled={
              !canReflectCurrent || reflectingEntryId === activeEntryId
            }
            className="mt-3 min-h-[48px] w-full border border-[#39ff88] bg-[#041008] px-3 py-3 text-left text-sm text-[#39ff88] transition hover:bg-[#07150b] disabled:cursor-not-allowed disabled:border-[#242424] disabled:bg-black disabled:text-[#666666]"
          >
            &gt;{" "}
            {reflectingEntryId === activeEntryId
              ? "reflecting..."
              : !activeEntryId
                ? "save first, then reflect"
                : activeEntry?.pending
                  ? "waiting for sync"
                : hasUnsavedChanges
                  ? "save changes before reflection"
                  : reflectionByEntry[activeEntryId]
                    ? "re-run AI reflection"
                    : "run AI reflection"}
          </button>

          {activeEntry && reflectionByEntry[activeEntry.id] ? (
            <ShadowReflectionView
              reflection={reflectionByEntry[activeEntry.id]}
            />
          ) : null}

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={saveShadowEntry}
              disabled={isPending}
              className="min-h-[50px] w-full border border-[#39ff88] bg-black px-4 py-3 text-left text-sm text-[#39ff88] disabled:opacity-60"
            >
              &gt;{" "}
              {isPending
                ? "saving..."
                : activeEntryId
                  ? "save shadow changes"
                  : "save shadow entry"}
            </button>

            <button
              type="button"
              onClick={resetEditor}
              disabled={isPending}
              className="min-h-[50px] w-full border border-[#365341] bg-black px-4 py-3 text-left text-sm text-[#9fd8b5] disabled:opacity-60"
            >
              &gt; clear editor
            </button>
          </div>

          {message ? (
            <p className="mt-3 text-xs leading-6 text-[#ffb020]">
              &gt; {message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <SignalDisclosure
          title="Recent Shadow Signals"
          count={sortedEntries.length}
        >
          <div className="min-w-0 max-w-full overflow-hidden border border-[#242424] sm:max-h-[680px] sm:overflow-y-auto">
            {sortedEntries.length > 0 ? (
              sortedEntries.map((entry) => {
                const created = new Date(entry.created_at);
                const reflection = reflectionByEntry[entry.id];
                const isVoice = Boolean(entry.audio_path);
                const contentParts = splitShadowContent(entry.content);
                const sourceText = isVoice
                  ? entry.cleaned_transcript || entry.raw_transcript || ""
                  : contentParts.response;
                const timestamp = `${created.toLocaleDateString()} ${created.toLocaleTimeString(
                  [],
                  { hour: "2-digit", minute: "2-digit" }
                )}`;

                return (
                  <SignalEntryDisclosure
                    key={entry.id}
                    title={entry.title || "Shadow Entry"}
                    meta={timestamp}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="border border-[#365341] bg-[#06110a] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[#9fd8b5]">
                        {isVoice ? "voice" : "manual"}
                      </span>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => loadEntry(entry)}
                          className="min-h-[38px] border border-[#365341] px-3 text-xs text-[#9fd8b5] transition hover:border-[#39ff88] hover:text-[#39ff88]"
                        >
                          edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteShadow(entry)}
                          disabled={deletingEntryId === entry.id}
                          className="min-h-[38px] border border-[#6b3030] px-3 text-xs text-[#ff7b7b] transition hover:border-[#ff4d4d] disabled:opacity-50"
                        >
                          {deletingEntryId === entry.id
                            ? "deleting..."
                            : "delete"}
                        </button>
                      </div>
                    </div>

                    {!isVoice && sourceText ? (
                      <p className="mt-3 max-w-full whitespace-pre-wrap break-words leading-6 [overflow-wrap:anywhere]">
                        {sourceText}
                      </p>
                    ) : null}

                    {isVoice ? (
                      <div className="mt-3 border border-[#242424] bg-[#030303] p-3">
                        <p className="terminal-green text-xs">
                          &gt; audio recording
                        </p>
                        <p className="terminal-muted mt-1 break-all text-[10px]">
                          {entry.audio_path}
                        </p>
                        <button
                          type="button"
                          onClick={() => void transcribeEntry(entry)}
                          disabled={transcribingEntryId === entry.id}
                          className="mt-3 min-h-[44px] w-full border border-[#39ff88] px-3 py-2 text-left text-xs text-[#39ff88] disabled:opacity-50"
                        >
                          &gt;{" "}
                          {transcribingEntryId === entry.id
                            ? "transcribing..."
                            : entry.raw_transcript || entry.cleaned_transcript
                              ? "re-transcribe audio"
                              : "speech to text"}
                        </button>
                        <TranscriptView
                          raw={entry.raw_transcript}
                          cleaned={entry.cleaned_transcript}
                        />
                      </div>
                    ) : null}

                    {contentParts.action ? (
                      <div className="mt-3 border-l border-[#365341] pl-3">
                        <p className="terminal-green text-[10px] uppercase tracking-[0.14em]">
                          Grounded action
                        </p>
                        <p className="terminal-muted mt-1 whitespace-pre-wrap leading-6">
                          {contentParts.action}
                        </p>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => void reflectShadow(entry)}
                      disabled={
                        reflectingEntryId === entry.id ||
                        sourceText.trim().length < 2
                      }
                      className="mt-3 min-h-[44px] w-full border border-[#39ff88] bg-[#041008] px-3 py-2 text-left text-xs text-[#39ff88] disabled:border-[#242424] disabled:bg-black disabled:text-[#666666]"
                    >
                      &gt;{" "}
                      {reflectingEntryId === entry.id
                        ? "reflecting..."
                        : reflection
                          ? "re-run AI reflection"
                          : "run AI reflection"}
                    </button>

                    {reflection ? (
                      <ShadowReflectionView reflection={reflection} />
                    ) : null}
                  </SignalEntryDisclosure>
                );
              })
            ) : (
              <p className="terminal-muted p-3 text-xs">
                &gt; No shadow signals saved yet.
              </p>
            )}
          </div>
        </SignalDisclosure>
      </div>
    </div>
  );
}

function toPendingAudioCapture(
  captureState:
    | CapturedAudioState
    | undefined
): PendingAudioCapture | null {
  if (
    !captureState?.pendingUpload ||
    !captureState.blobKey
  ) {
    return null;
  }

  return {
    blobKey:
      captureState.blobKey,
    storagePath:
      captureState.storagePath,
    contentType:
      captureState.contentType,
  };
}

function ModeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "min-h-[44px] border border-[#39ff88] bg-[#06110a] px-3 text-left text-sm text-[#39ff88]"
          : "min-h-[44px] border border-[#242424] bg-black px-3 text-left text-sm text-[#8a8a8a] transition hover:border-[#365341] hover:text-[#9fd8b5]"
      }
    >
      &gt; {label}
    </button>
  );
}

function composeShadowContent(response: string, action: string) {
  const cleanResponse = response.trim();
  const cleanAction = action.trim();
  return cleanAction
    ? `${cleanResponse}${ACTION_MARKER}${cleanAction}`
    : cleanResponse;
}

function splitShadowContent(content: string) {
  const markerIndex = content.indexOf(ACTION_MARKER);

  if (markerIndex < 0) {
    return { response: content.trim(), action: "" };
  }

  return {
    response: content.slice(0, markerIndex).trim(),
    action: content.slice(markerIndex + ACTION_MARKER.length).trim(),
  };
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
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!audioPath && !rawTranscript && !cleanedTranscript) {
    return { ok: true };
  }

  try {
    const response = await fetch("/api/journal-audio", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({
        journalEntryId,
        audioPath,
        rawTranscript,
        cleanedTranscript,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    if (!response.ok) {
      return {
        ok: false,
        error: payload?.error ?? "Attachment update failed.",
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

function TranscriptView({
  raw,
  cleaned,
}: {
  raw: string | null;
  cleaned: string | null;
}) {
  if (!raw && !cleaned) return null;

  return (
    <div className="mt-3 border-t border-[#242424] pt-3">
      {raw ? (
        <div>
          <p className="terminal-green text-xs">raw transcript:</p>
          <p className="terminal-muted mt-1 whitespace-pre-wrap break-words text-xs leading-6 [overflow-wrap:anywhere]">
            {raw}
          </p>
        </div>
      ) : null}

      {cleaned ? (
        <div className={raw ? "mt-3" : ""}>
          <p className="terminal-green text-xs">cleaned transcript:</p>
          <p className="terminal-muted mt-1 whitespace-pre-wrap break-words text-xs leading-6 [overflow-wrap:anywhere]">
            {cleaned}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ShadowReflectionView({
  reflection,
}: {
  reflection: AIReflection;
}) {
  return (
    <div className="mt-3 border border-[#39ff88] bg-black p-3 text-xs leading-6">
      <p className="terminal-green mb-3 uppercase tracking-[0.18em]">
        &gt; shadow reflection
      </p>
      <ReflectionSection title="SUMMARY" content={reflection.summary} />
      <ReflectionSection
        title="PATTERN NOTICED"
        content={reflection.pattern_noticed}
      />
      <ReflectionSection
        title="COMPASSIONATE REFRAME"
        content={reflection.compassionate_reframe}
      />

      {reflection.questions && reflection.questions.length > 0 ? (
        <div className="mt-3">
          <p className="terminal-green">QUESTIONS:</p>
          <ul className="terminal-muted mt-1 space-y-1">
            {reflection.questions.map((question, index) => (
              <li key={`${question}-${index}`}>&gt; {question}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <ReflectionSection
        title="ONE GROUNDED ACTION"
        content={reflection.action_step}
      />
    </div>
  );
}

function ReflectionSection({
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

const inputClassName =
  "mt-2 w-full border border-[#242424] bg-black px-3 py-3 text-sm text-[#e5e5e5] outline-none focus:border-[#39ff88]";

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
      {children}
    </span>
  );
}

function getLocalDateKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
