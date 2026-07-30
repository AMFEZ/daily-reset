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

type DreamEntry = {
  id: string;
  entry_type: "dream";
  title: string | null;
  content: string;
  mood: string | null;
  energy: number | null;
  tags: string[] | null;
  symbols: string[] | null;
  audio_path: string | null;
  raw_transcript: string | null;
  cleaned_transcript: string | null;
  created_at: string;
  pending?: boolean;
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

type DreamMutationResponse = {
  entry?: DreamEntry;
  error?: string;
};

type PendingAudioCapture = {
  blobKey: string;
  storagePath: string;
  contentType: string;
};

const DREAM_CACHE_KEY =
  "daily-reset:dream-entries:v1";

export function DreamArchivePanel({
  initialEntries,
  initialInterpretations,
}: DreamArchivePanelProps) {
  const supabase = createClient();
  const [isPending, startTransition] =
    useTransition();

  const [entries, setEntries] =
    useState<DreamEntry[]>(initialEntries);
  const [interpretations, setInterpretations] =
    useState<DreamInterpretation[]>(
      initialInterpretations
    );

  const [captureMode, setCaptureMode] =
    useState<CaptureMode>("manual");
  const [activeEntryId, setActiveEntryId] =
    useState<string | null>(null);
  const [activeCreatedAt, setActiveCreatedAt] =
    useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] =
    useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [symbols, setSymbols] = useState("");
  const [people, setPeople] = useState("");
  const [places, setPlaces] = useState("");
  const [audioPath, setAudioPath] =
    useState<string | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] =
    useState<string | null>(null);
  const [
    pendingAudioCapture,
    setPendingAudioCapture,
  ] = useState<PendingAudioCapture | null>(
    null
  );
  const [rawTranscript, setRawTranscript] =
    useState("");
  const [cleanedTranscript, setCleanedTranscript] =
    useState("");

  const [
    transcribingEntryId,
    setTranscribingEntryId,
  ] = useState<string | null>(null);
  const [
    interpretingEntryId,
    setInterpretingEntryId,
  ] = useState<string | null>(null);
  const [deletingEntryId, setDeletingEntryId] =
    useState<string | null>(null);
  const [message, setMessage] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (navigator.onLine) {
      return;
    }

    void readOfflineCache<DreamEntry[]>(
      DREAM_CACHE_KEY
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
      DREAM_CACHE_KEY,
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
                  "dream"
              ) ||
              (
                operation.kind ===
                  "audio-upload" &&
                operation.payload
                  .entryType ===
                  "dream"
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

  const interpretationByEntry = useMemo(
    () =>
      interpretations.reduce<
        Record<string, DreamInterpretation>
      >((accumulator, item) => {
        if (!accumulator[item.journal_entry_id]) {
          accumulator[item.journal_entry_id] =
            item;
        }
        return accumulator;
      }, {}),
    [interpretations]
  );

  const currentSourceText =
    captureMode === "manual"
      ? content.trim()
      : (
          cleanedTranscript.trim() ||
          rawTranscript.trim()
        );

  const canInterpretCurrent = Boolean(
    activeEntryId &&
      !entries.find((entry) =>
        entry.id === activeEntryId
      )?.pending &&
      !hasUnsavedChanges &&
      currentSourceText.length >= 2
  );

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
    setTitle("");
    setContent("");
    setSymbols("");
    setPeople("");
    setPlaces("");
    setAudioPath(null);
    setAudioPreviewUrl(null);
    setPendingAudioCapture(null);
    setRawTranscript("");
    setCleanedTranscript("");
    setMessage(null);
  }

  function switchCaptureMode(
    nextMode: CaptureMode
  ) {
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
      setContent("");
    }
  }

  function loadEntry(entry: DreamEntry) {
    const nextMode: CaptureMode =
      entry.audio_path ? "voice" : "manual";

    setActiveEntryId(entry.id);
    setActiveCreatedAt(entry.created_at);
    setCaptureMode(nextMode);
    setTitle(entry.title ?? "");
    setContent(
      nextMode === "manual"
        ? entry.content
        : ""
    );
    setSymbols(
      (entry.symbols ?? []).join(", ")
    );
    setPeople("");
    setPlaces("");
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

    setRawTranscript(
      entry.raw_transcript ?? ""
    );
    setCleanedTranscript(
      entry.cleaned_transcript ?? ""
    );
    setHasUnsavedChanges(false);
    setMessage(
      "Dream loaded into the editor."
    );

    requestAnimationFrame(() => {
      document
        .getElementById("dream-editor")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    });
  }

  function saveDream() {
    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    const cleanRaw = rawTranscript.trim();
    const cleanCleaned =
      cleanedTranscript.trim();
    const parsedSymbols =
      parseList(symbols);

    if (
      captureMode === "manual" &&
      cleanContent.length < 2
    ) {
      setMessage(
        "Write the dream details before saving."
      );
      return;
    }

    if (
      captureMode === "voice" &&
      !audioPath
    ) {
      setMessage(
        "Record the dream before saving."
      );
      return;
    }

    setMessage(null);

    startTransition(async () => {
      const existingEntry = activeEntryId
        ? entries.find(
            (entry) =>
              entry.id === activeEntryId
          ) ?? null
        : null;
      const entityId =
        existingEntry?.id ??
        createOfflineEntityId();
      const createdAt =
        existingEntry?.created_at ??
        new Date().toISOString();
      const mutationAt =
        new Date().toISOString();
      const hasNewAudio = Boolean(
        captureMode === "voice" &&
          pendingAudioCapture
      );
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
      const storedContent =
        captureMode === "manual"
          ? cleanContent
          : cleanCleaned ||
            cleanRaw ||
            "Voice dream awaiting transcription.";
      const savedEntry: DreamEntry = {
        id: entityId,
        entry_type: "dream",
        title: cleanTitle || null,
        content: storedContent,
        mood:
          existingEntry?.mood ?? null,
        energy:
          existingEntry?.energy ?? null,
        tags:
          existingEntry?.tags ?? [],
        symbols: parsedSymbols,
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
            entryType: "dream",
            title: cleanTitle || null,
            content: storedContent,
            mood:
              existingEntry?.mood ?? null,
            energy:
              existingEntry?.energy ?? null,
            tags:
              existingEntry?.tags ?? [],
            symbols: parsedSymbols,
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
            activity: "dream",
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
              entryType: "dream",
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
        setInterpretations((current) =>
          current.filter(
            (item) =>
              item.journal_entry_id !==
              entityId
          )
        );
        setActiveEntryId(entityId);
        setActiveCreatedAt(createdAt);
        setHasUnsavedChanges(false);

        dispatchDailyResetDataChanged({
          scopes: [
            "journal",
            "analytics",
          ],
          source: "dream",
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
              ? "Dream saved on this device. It will retry automatically."
              : captureMode === "voice"
                ? "Dream and recording synced. Transcription is ready."
                : "Dream saved and synced.")
        );
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Dream could not be stored on this device."
        );
      }
    });
  }

  async function updateDream(
    entryId: string,
    values: {
      title: string;
      content: string;
      symbols: string[];
      captureMode: CaptureMode;
      audioPath: string | null;
      rawTranscript: string;
      cleanedTranscript: string;
    }
  ) {
    const response = await fetch(
      `/api/dreams/${entryId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(values),
      }
    );

    const result =
      (await response.json()) as DreamMutationResponse;

    if (
      !response.ok ||
      !result.entry
    ) {
      throw new Error(
        result.error ??
          "Dream update failed."
      );
    }

    return result.entry;
  }

  async function transcribeDream(
    entry: Pick<
      DreamEntry,
      "id" | "audio_path" | "pending"
    >
  ) {
    if (entry.pending || !navigator.onLine) {
      setMessage(
        "Sync the dream before transcription."
      );
      return;
    }

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

      setInterpretations((current) =>
        current.filter(
          (item) =>
            item.journal_entry_id !==
            entry.id
        )
      );

      if (activeEntryId === entry.id) {
        setRawTranscript(
          result.rawTranscript
        );
        setCleanedTranscript(
          result.cleanedTranscript
        );
        setHasUnsavedChanges(false);
      }

      setMessage(
        "Dream audio transcribed. The transcript is now editable."
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
    setInterpretations((current) =>
      current.filter(
        (item) =>
          item.journal_entry_id !==
          activeEntryId
      )
    );
    setMessage(
      "Transcript cleared in the editor. Save changes to sync the deletion."
    );
  }

  async function interpretDream(
    entry: DreamEntry
  ) {
    if (entry.pending || !navigator.onLine) {
      setMessage(
        "Sync the dream before AI interpretation."
      );
      return;
    }

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

      const interpretation =
        result.interpretation;

      setInterpretations((current) => [
        interpretation,
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

  async function interpretCurrentDream() {
    if (!activeEntryId) return;

    const entry = entries.find(
      (candidate) =>
        candidate.id === activeEntryId
    );

    if (!entry) return;
    await interpretDream(entry);
  }

  async function deleteDream(
    entry: DreamEntry
  ) {
    const confirmed = window.confirm(
      `Delete "${
        entry.title || "Untitled Dream"
      }" and its transcript/interpretation? This cannot be undone.`
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
      setInterpretations((current) =>
        current.filter(
          (item) =>
            item.journal_entry_id !==
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
          ? "Dream deletion saved on this device. It will sync automatically."
          : "Dream and attached audio deleted."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Dream deletion failed."
      );
    } finally {
      setDeletingEntryId(null);
    }
  }

  const activeEntry = activeEntryId
    ? entries.find(
        (entry) =>
          entry.id === activeEntryId
      ) ?? null
    : null;

  return (
    <TerminalBlock>
      <div
        id="dream-editor"
        className="scroll-mt-20"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f4b32] bg-[#06110a] px-3 py-3">
          <div>
            <p className="terminal-green text-sm font-semibold tracking-[0.08em]">
              &gt;{" "}
              {activeEntryId
                ? "Edit Dream"
                : "New Dream"}
            </p>
            {activeCreatedAt ? (
              <p className="terminal-muted mt-1 text-[10px]">
                saved{" "}
                {new Date(
                  activeCreatedAt
                ).toLocaleString()}
              </p>
            ) : null}
          </div>

          {activeEntryId ? (
            <button
              type="button"
              onClick={resetEditor}
              className="min-h-[38px] border border-[#365341] px-3 text-xs text-[#9fd8b5] transition hover:border-[#39ff88] hover:text-[#39ff88]"
            >
              new dream
            </button>
          ) : null}
        </div>

        <div className="p-3">
          <FieldLabel>
            Capture method
          </FieldLabel>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <ModeButton
              active={
                captureMode === "manual"
              }
              label="Manual"
              onClick={() =>
                switchCaptureMode(
                  "manual"
                )
              }
            />
            <ModeButton
              active={
                captureMode === "voice"
              }
              label="Voice"
              onClick={() =>
                switchCaptureMode(
                  "voice"
                )
              }
            />
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <FieldLabel>
                Title
              </FieldLabel>
              <input
                value={title}
                onChange={(event) => {
                  setTitle(
                    event.target.value
                  );
                  markChanged();
                }}
                className={inputClassName}
              />
            </label>

            <label className="block">
              <FieldLabel>
                Symbols
              </FieldLabel>
              <input
                value={symbols}
                onChange={(event) => {
                  setSymbols(
                    event.target.value
                  );
                  markChanged();
                }}
                className={inputClassName}
              />
            </label>
          </div>

          {!activeEntryId ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <FieldLabel>
                  People
                </FieldLabel>
                <input
                  value={people}
                  onChange={(event) => {
                    setPeople(
                      event.target.value
                    );
                    markChanged();
                  }}
                  className={
                    inputClassName
                  }
                />
              </label>

              <label className="block">
                <FieldLabel>
                  Places
                </FieldLabel>
                <input
                  value={places}
                  onChange={(event) => {
                    setPlaces(
                      event.target.value
                    );
                    markChanged();
                  }}
                  className={
                    inputClassName
                  }
                />
              </label>
            </div>
          ) : null}

          <div className="mt-4">
            <FieldLabel>
              Dream details
            </FieldLabel>

            {captureMode ===
            "manual" ? (
              <textarea
                value={content}
                onChange={(event) => {
                  setContent(
                    event.target.value
                  );
                  markChanged();
                }}
                className={`${inputClassName} min-h-[220px] resize-y leading-6`}
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
                    setHasUnsavedChanges(
                      true
                    );
                    setMessage(
                      captureState?.pendingUpload
                        ? "Audio saved on this device. Save the dream to queue upload."
                        : "Audio uploaded. Save the dream before transcription."
                    );
                  }}
                  contextLabel="dream"
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
                    Boolean(
                      activeEntryId
                    ) &&
                    transcribingEntryId ===
                      activeEntryId
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
                        "Save the voice dream before transcribing it."
                      );
                      return;
                    }

                    await transcribeDream({
                      id: activeEntryId,
                      audio_path:
                        audioPath,
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
                        src={
                          audioPreviewUrl
                        }
                        className="mt-3 w-full"
                      />
                    ) : null}
                  </div>
                ) : null}

                {rawTranscript ||
                cleanedTranscript ? (
                  <div className="mt-4 space-y-3 border-t border-[#242424] pt-4">
                    <label className="block">
                      <FieldLabel>
                        Raw transcript
                      </FieldLabel>
                      <textarea
                        value={
                          rawTranscript
                        }
                        onChange={(
                          event
                        ) => {
                          setRawTranscript(
                            event.target
                              .value
                          );
                          markChanged();
                        }}
                        className={`${inputClassName} min-h-[110px] resize-y leading-6`}
                      />
                    </label>

                    <label className="block">
                      <FieldLabel>
                        Cleaned transcript
                      </FieldLabel>
                      <textarea
                        value={
                          cleanedTranscript
                        }
                        onChange={(
                          event
                        ) => {
                          setCleanedTranscript(
                            event.target
                              .value
                          );
                          markChanged();
                        }}
                        className={`${inputClassName} min-h-[110px] resize-y leading-6`}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        void clearTranscript()
                      }
                      disabled={isPending}
                      className="min-h-[42px] w-full border border-[#6b3030] px-3 py-2 text-left text-xs text-[#ff7b7b] transition hover:border-[#ff4d4d] disabled:opacity-50"
                    >
                      &gt; delete transcript
                    </button>
                  </div>
                ) : null}
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                void interpretCurrentDream()
              }
              disabled={
                !canInterpretCurrent ||
                interpretingEntryId ===
                  activeEntryId
              }
              className="mt-3 min-h-[48px] w-full border border-[#39ff88] bg-[#041008] px-3 py-3 text-left text-sm text-[#39ff88] transition hover:bg-[#07150b] disabled:cursor-not-allowed disabled:border-[#242424] disabled:bg-black disabled:text-[#666666]"
            >
              &gt;{" "}
              {interpretingEntryId ===
              activeEntryId
                ? "interpreting dream..."
                : !activeEntryId
                  ? "save first, then interpret"
                  : activeEntry?.pending
                    ? "waiting for sync"
                  : hasUnsavedChanges
                    ? "save changes before interpretation"
                    : interpretationByEntry[
                          activeEntryId
                        ]
                      ? "re-interpret dream"
                      : "interpret dream"}
            </button>

            {activeEntry &&
            interpretationByEntry[
              activeEntry.id
            ] ? (
              <DreamInterpretationView
                interpretation={
                  interpretationByEntry[
                    activeEntry.id
                  ]
                }
              />
            ) : null}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={saveDream}
              disabled={isPending}
              className="min-h-[50px] w-full border border-[#39ff88] bg-[#000000] px-4 py-3 text-left text-sm text-[#39ff88] disabled:opacity-60"
            >
              &gt;{" "}
              {isPending
                ? "saving dream..."
                : activeEntryId
                  ? "save dream changes"
                  : "save dream"}
            </button>

            <button
              type="button"
              onClick={resetEditor}
              disabled={isPending}
              className="min-h-[50px] w-full border border-[#365341] bg-[#000000] px-4 py-3 text-left text-sm text-[#9fd8b5] disabled:opacity-60"
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
          title="Recent Dream Signals"
          count={sortedEntries.length}
        >
          <div className="min-w-0 max-w-full overflow-hidden border border-[#242424] sm:max-h-[680px] sm:overflow-y-auto">
            {sortedEntries.length > 0 ? (
              sortedEntries.map(
                (entry) => {
                  const created = new Date(
                    entry.created_at
                  );
                  const interpretation =
                    interpretationByEntry[
                      entry.id
                    ];
                  const isVoice =
                    Boolean(
                      entry.audio_path
                    );
                  const sourceText = isVoice
                    ? entry.cleaned_transcript ||
                      entry.raw_transcript ||
                      ""
                    : entry.content;
                  const timestamp = `${created.toLocaleDateString()} ${created.toLocaleTimeString(
                    [],
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  )}`;

                  return (
                    <SignalEntryDisclosure
                      key={entry.id}
                      title={
                        entry.title ||
                        "Untitled Dream"
                      }
                      meta={
                        entry.pending
                          ? `${timestamp} · pending sync`
                          : timestamp
                      }
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="border border-[#365341] bg-[#06110a] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[#9fd8b5]">
                          {entry.pending
                            ? "manual · pending sync"
                            : isVoice
                              ? "voice"
                              : "manual"}
                        </span>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              loadEntry(
                                entry
                              )
                            }
                            className="min-h-[38px] border border-[#365341] px-3 text-xs text-[#9fd8b5] transition hover:border-[#39ff88] hover:text-[#39ff88]"
                          >
                            edit
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void deleteDream(
                                entry
                              )
                            }
                            disabled={
                              deletingEntryId ===
                              entry.id
                            }
                            className="min-h-[38px] border border-[#6b3030] px-3 text-xs text-[#ff7b7b] transition hover:border-[#ff4d4d] disabled:opacity-50"
                          >
                            {deletingEntryId ===
                            entry.id
                              ? "deleting..."
                              : "delete"}
                          </button>
                        </div>
                      </div>

                      {!isVoice &&
                      sourceText ? (
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
                            {
                              entry.audio_path
                            }
                          </p>

                          <button
                            type="button"
                            onClick={() =>
                              void transcribeDream(
                                entry
                              )
                            }
                            disabled={
                              transcribingEntryId ===
                              entry.id
                            }
                            className="mt-3 min-h-[44px] w-full border border-[#39ff88] px-3 py-2 text-left text-xs text-[#39ff88] disabled:opacity-50"
                          >
                            &gt;{" "}
                            {transcribingEntryId ===
                            entry.id
                              ? "transcribing..."
                              : entry.raw_transcript ||
                                  entry.cleaned_transcript
                                ? "re-transcribe audio"
                                : "speech to text"}
                          </button>

                          <TranscriptView
                            raw={
                              entry.raw_transcript
                            }
                            cleaned={
                              entry.cleaned_transcript
                            }
                          />
                        </div>
                      ) : null}

                      <button
                        type="button"
                        onClick={() =>
                          void interpretDream(
                            entry
                          )
                        }
                        disabled={
                          interpretingEntryId ===
                            entry.id ||
                          sourceText.trim()
                            .length < 2
                        }
                        className="mt-3 min-h-[44px] w-full border border-[#39ff88] bg-[#041008] px-3 py-2 text-left text-xs text-[#39ff88] disabled:border-[#242424] disabled:bg-black disabled:text-[#666666]"
                      >
                        &gt;{" "}
                        {interpretingEntryId ===
                        entry.id
                          ? "interpreting..."
                          : interpretation
                            ? "re-interpret dream"
                            : "interpret dream"}
                      </button>

                      {interpretation ? (
                        <DreamInterpretationView
                          interpretation={
                            interpretation
                          }
                        />
                      ) : null}
                    </SignalEntryDisclosure>
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
    <div className="mt-3 border-t border-[#242424] pt-3">
      {raw ? (
        <div>
          <p className="terminal-green text-xs">
            raw transcript:
          </p>
          <p className="terminal-muted mt-1 whitespace-pre-wrap break-words text-xs leading-6 [overflow-wrap:anywhere]">
            {raw}
          </p>
        </div>
      ) : null}

      {cleaned ? (
        <div className={raw ? "mt-3" : ""}>
          <p className="terminal-green text-xs">
            cleaned transcript:
          </p>
          <p className="terminal-muted mt-1 whitespace-pre-wrap break-words text-xs leading-6 [overflow-wrap:anywhere]">
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
        &gt; dream interpretation
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
  children,
}: {
  children: ReactNode;
}) {
  return <div className="p-3">{children}</div>;
}

function getLocalDateKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
