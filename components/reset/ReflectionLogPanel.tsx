"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { SignalDisclosure } from "@/components/reset/SignalDisclosure";
import { SignalEntryDisclosure } from "@/components/reset/SignalEntryDisclosure";
import { dispatchDailyResetDataChanged } from "@/lib/dailyResetEvents";
import {
  OFFLINE_QUEUE_EVENT,
  createOfflineEntityId,
  enqueueOfflineOperation,
  getOfflineOperations,
  readOfflineCache,
  removeOfflineOperation,
  syncOfflineQueue,
  writeOfflineCache,
} from "@/lib/offlineStore";

type ReflectionEntryType =
  | "reflection"
  | "freewrite";

type ReflectionEntry = {
  id: string;
  entry_type: ReflectionEntryType;
  title: string | null;
  content: string;
  mood: string | null;
  energy: number | null;
  tags: string[] | null;
  created_at: string;
  pending?: boolean;
  localOnly?: boolean;
};

type AIReflection = {
  id: string;
  journal_entry_id: string;
  reflection_type:
    | "journal"
    | "shadow"
    | "dream"
    | "daily_review";
  summary: string | null;
  pattern_noticed: string | null;
  compassionate_reframe: string | null;
  questions: string[] | null;
  action_step: string | null;
  model: string | null;
  created_at: string;
};

type ReflectionLogPanelProps = {
  initialEntries: ReflectionEntry[];
  initialReflections: AIReflection[];
};

type ReflectionResponse = {
  reflection?: AIReflection;
  error?: string;
};

const CACHE_KEY =
  "daily-reset:reflection-freewrite:v1";

export function ReflectionLogPanel({
  initialEntries,
  initialReflections,
}: ReflectionLogPanelProps) {
  const [isPending, startTransition] =
    useTransition();

  const [entries, setEntries] =
    useState<ReflectionEntry[]>(
      initialEntries.map(
        (entry) => ({
          ...entry,
          pending: false,
          localOnly: false,
        })
      )
    );
  const [
    reflections,
    setReflections,
  ] = useState<AIReflection[]>(
    initialReflections
  );

  const [
    entryType,
    setEntryType,
  ] = useState<ReflectionEntryType>(
    "reflection"
  );
  const [
    activeEntryId,
    setActiveEntryId,
  ] = useState<string | null>(
    null
  );
  const [
    activeCreatedAt,
    setActiveCreatedAt,
  ] = useState<string | null>(
    null
  );
  const [
    activeLocalOnly,
    setActiveLocalOnly,
  ] = useState(false);
  const [
    hasUnsavedChanges,
    setHasUnsavedChanges,
  ] = useState(false);

  const [title, setTitle] =
    useState(
      defaultTitle("reflection")
    );
  const [content, setContent] =
    useState("");
  const [mood, setMood] =
    useState("");
  const [energy, setEnergy] =
    useState("");
  const [tags, setTags] =
    useState("");
  const [message, setMessage] =
    useState<string | null>(
      null
    );
  const [
    reflectingEntryId,
    setReflectingEntryId,
  ] = useState<string | null>(
    null
  );
  const [
    deletingEntryId,
    setDeletingEntryId,
  ] = useState<string | null>(
    null
  );
  const [isOnline, setIsOnline] =
    useState(true);

  useEffect(() => {
    const updateConnection =
      () =>
        setIsOnline(
          navigator.onLine
        );

    updateConnection();

    window.addEventListener(
      "online",
      updateConnection
    );
    window.addEventListener(
      "offline",
      updateConnection
    );

    return () => {
      window.removeEventListener(
        "online",
        updateConnection
      );
      window.removeEventListener(
        "offline",
        updateConnection
      );
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (navigator.onLine) {
      return;
    }

    void readOfflineCache<
      ReflectionEntry[]
    >(CACHE_KEY).then(
      (cached) => {
        if (
          !cancelled &&
          cached &&
          cached.length > 0
        ) {
          setEntries(cached);
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void writeOfflineCache(
      CACHE_KEY,
      entries
    );
  }, [entries]);

  useEffect(() => {
    const refreshPending =
      async () => {
        const operations =
          await getOfflineOperations();

        const pendingUpserts =
          new Set(
            operations
              .filter(
                (operation) =>
                  operation.kind ===
                    "journal" &&
                  (
                    operation.payload
                      .entryType ===
                      "reflection" ||
                    operation.payload
                      .entryType ===
                      "freewrite"
                  )
              )
              .map(
                (operation) =>
                  operation.kind ===
                  "journal"
                    ? operation
                        .payload
                        .entityId
                    : ""
              )
          );

        const pendingDeletes =
          new Set(
            operations
              .filter(
                (operation) =>
                  operation.kind ===
                  "journal-delete"
              )
              .map(
                (operation) =>
                  operation.kind ===
                  "journal-delete"
                    ? operation
                        .payload
                        .entityId
                    : ""
              )
          );

        setEntries((current) =>
          current
            .filter(
              (entry) =>
                !pendingDeletes.has(
                  entry.id
                )
            )
            .map((entry) => {
              const pending =
                pendingUpserts.has(
                  entry.id
                );

              return {
                ...entry,
                pending,
                localOnly: pending
                  ? entry.localOnly
                  : false,
              };
            })
        );
      };

    const handleQueue =
      () => {
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

  const sortedEntries =
    useMemo(
      () =>
        [...entries].sort(
          (a, b) =>
            b.created_at.localeCompare(
              a.created_at
            )
        ),
      [entries]
    );

  const reflectionByEntry =
    useMemo(
      () =>
        reflections.reduce<
          Record<
            string,
            AIReflection
          >
        >(
          (
            accumulator,
            reflection
          ) => {
            if (
              !accumulator[
                reflection
                  .journal_entry_id
              ]
            ) {
              accumulator[
                reflection
                  .journal_entry_id
              ] = reflection;
            }

            return accumulator;
          },
          {}
        ),
      [reflections]
    );

  const activeEntry =
    activeEntryId
      ? entries.find(
          (entry) =>
            entry.id ===
            activeEntryId
        ) ?? null
      : null;

  const canReflectCurrent =
    Boolean(
      activeEntry &&
        !activeEntry.pending &&
        !hasUnsavedChanges &&
        isOnline &&
        content.trim().length >=
          2
    );

  function markChanged() {
    setHasUnsavedChanges(
      true
    );
    setMessage(null);
  }

  function resetEditor(
    nextType: ReflectionEntryType =
      "reflection"
  ) {
    setEntryType(nextType);
    setActiveEntryId(null);
    setActiveCreatedAt(null);
    setActiveLocalOnly(false);
    setHasUnsavedChanges(
      false
    );
    setTitle(
      defaultTitle(nextType)
    );
    setContent("");
    setMood("");
    setEnergy("");
    setTags("");
    setMessage(null);
  }

  function changeEntryType(
    nextType: ReflectionEntryType
  ) {
    setEntryType(nextType);

    if (!activeEntryId) {
      setTitle(
        defaultTitle(nextType)
      );
    }

    markChanged();
  }

  function loadEntry(
    entry: ReflectionEntry
  ) {
    setEntryType(
      entry.entry_type
    );
    setActiveEntryId(
      entry.id
    );
    setActiveCreatedAt(
      entry.created_at
    );
    setActiveLocalOnly(
      Boolean(
        entry.localOnly
      )
    );
    setHasUnsavedChanges(
      false
    );
    setTitle(
      entry.title ??
        defaultTitle(
          entry.entry_type
        )
    );
    setContent(
      entry.content
    );
    setMood(
      entry.mood ?? ""
    );
    setEnergy(
      entry.energy === null
        ? ""
        : String(
            entry.energy
          )
    );
    setTags(
      (entry.tags ?? []).join(
        ", "
      )
    );
    setMessage(
      "Entry loaded into the editor."
    );

    requestAnimationFrame(
      () => {
        document
          .getElementById(
            "reflection-editor"
          )
          ?.scrollIntoView({
            behavior:
              "smooth",
            block: "start",
          });
      }
    );
  }

  function saveEntry() {
    const cleanContent =
      content.trim();
    const cleanTitle =
      title.trim() ||
      defaultTitle(
        entryType
      );
    const cleanMood =
      mood.trim() || null;
    const parsedEnergy =
      energy.trim() === ""
        ? null
        : Number(energy);
    const cleanTags =
      parseList(tags);

    if (
      cleanContent.length < 2
    ) {
      setMessage(
        "Write at least one complete thought before saving."
      );
      return;
    }

    if (
      parsedEnergy !== null &&
      (
        !Number.isInteger(
          parsedEnergy
        ) ||
        parsedEnergy < 1 ||
        parsedEnergy > 10
      )
    ) {
      setMessage(
        "Energy must be a whole number from 1 to 10."
      );
      return;
    }

    setMessage(null);

    startTransition(
      async () => {
        const entityId =
          activeEntryId ??
          createOfflineEntityId();
        const createdAt =
          activeCreatedAt ??
          new Date().toISOString();
        const operationId =
          `journal:${entityId}`;
        const isNew =
          !activeEntryId;

        const savedEntry: ReflectionEntry =
          {
            id: entityId,
            entry_type:
              entryType,
            title:
              cleanTitle,
            content:
              cleanContent,
            mood:
              cleanMood,
            energy:
              parsedEnergy,
            tags:
              cleanTags,
            created_at:
              createdAt,
            pending: true,
            localOnly:
              isNew
                ? true
                : activeLocalOnly,
          };

        setEntries((current) => [
          savedEntry,
          ...current.filter(
            (entry) =>
              entry.id !==
              entityId
          ),
        ]);

        setReflections(
          (current) =>
            current.filter(
              (reflection) =>
                reflection
                  .journal_entry_id !==
                entityId
            )
        );

        setActiveEntryId(
          entityId
        );
        setActiveCreatedAt(
          createdAt
        );
        setActiveLocalOnly(
          savedEntry.localOnly ??
            false
        );
        setHasUnsavedChanges(
          false
        );

        try {
          await removeOfflineOperation(
            `journal-delete:${entityId}`
          );

          await enqueueOfflineOperation(
            {
              id:
                operationId,
              kind:
                "journal",
              createdAt:
                new Date().toISOString(),
              payload: {
                entityId,
                entryType,
                title:
                  cleanTitle,
                content:
                  cleanContent,
                mood:
                  cleanMood,
                energy:
                  parsedEnergy,
                tags:
                  cleanTags,
                symbols: null,
                createdAt,
                activity:
                  entryType ===
                  "reflection"
                    ? "reflection"
                    : null,
                date:
                  getLocalDateKey(),
              },
            }
          );

          dispatchDailyResetDataChanged(
            {
              scopes: [
                "journal",
                "analytics",
              ],
              source:
                "unknown",
              date:
                getLocalDateKey(),
            }
          );

          const summary =
            await syncOfflineQueue();
          const stillPending =
            (
              await getOfflineOperations()
            ).some(
              (operation) =>
                operation.id ===
                operationId
            );

          setEntries(
            (current) =>
              current.map(
                (entry) =>
                  entry.id ===
                  entityId
                    ? {
                        ...entry,
                        pending:
                          stillPending,
                        localOnly:
                          stillPending
                            ? entry.localOnly
                            : false,
                      }
                    : entry
              )
          );
          setActiveLocalOnly(
            stillPending
              ? savedEntry.localOnly ??
                  false
              : false
          );

          setMessage(
            stillPending ||
              summary.errors
                .length > 0
              ? "Saved on this device. It will sync automatically."
              : `${
                  entryType ===
                  "reflection"
                    ? "Daily reflection"
                    : "Freewrite"
                } saved.`
          );
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Entry could not be stored on this device."
          );
        }
      }
    );
  }

  async function reflectEntry(
    entry: ReflectionEntry
  ) {
    if (entry.pending) {
      setMessage(
        "This entry must finish syncing before AI reflection."
      );
      return;
    }

    if (!navigator.onLine) {
      setMessage(
        "AI reflection requires a connection."
      );
      return;
    }

    setReflectingEntryId(
      entry.id
    );
    setMessage(null);

    try {
      const response =
        await fetch(
          "/api/reflect-entry",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                journalEntryId:
                  entry.id,
              }),
          }
        );

      const result =
        (await response.json()) as ReflectionResponse;

      if (
        !response.ok ||
        !result.reflection
      ) {
        throw new Error(
          result.error ??
            "No AI reflection was returned."
        );
      }

      const reflection =
        result.reflection;

      setReflections(
        (current) => [
          reflection,
          ...current.filter(
            (item) =>
              item
                .journal_entry_id !==
              entry.id
          ),
        ]
      );
      setMessage(
        "Guided reflection generated."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "AI reflection failed."
      );
    } finally {
      setReflectingEntryId(
        null
      );
    }
  }

  function deleteEntry(
    entry: ReflectionEntry
  ) {
    const confirmed =
      window.confirm(
        `Delete this ${
          entry.entry_type ===
          "reflection"
            ? "daily reflection"
            : "freewrite"
        }? This cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    setDeletingEntryId(
      entry.id
    );
    setMessage(null);

    startTransition(
      async () => {
        try {
          await removeOfflineOperation(
            `journal:${entry.id}`
          );

          if (
            !entry.localOnly
          ) {
            await enqueueOfflineOperation(
              {
                id:
                  `journal-delete:${entry.id}`,
                kind:
                  "journal-delete",
                createdAt:
                  new Date().toISOString(),
                payload: {
                  entityId:
                    entry.id,
                },
              }
            );
          }

          setEntries(
            (current) =>
              current.filter(
                (candidate) =>
                  candidate.id !==
                  entry.id
              )
          );
          setReflections(
            (current) =>
              current.filter(
                (reflection) =>
                  reflection
                    .journal_entry_id !==
                  entry.id
              )
          );

          if (
            activeEntryId ===
            entry.id
          ) {
            resetEditor(
              entry.entry_type
            );
          }

          if (
            entry.localOnly
          ) {
            setMessage(
              "Pending local entry deleted."
            );
            return;
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
              summary.errors
                .length > 0
              ? "Deletion saved on this device. It will sync automatically."
              : "Entry deleted."
          );
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Entry deletion failed."
          );
        } finally {
          setDeletingEntryId(
            null
          );
        }
      }
    );
  }

  return (
    <div className="p-3">
      <div
        id="reflection-editor"
        className="scroll-mt-20"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f4b32] bg-[#06110a] px-3 py-3">
          <div>
            <p className="terminal-green text-sm font-semibold tracking-[0.08em]">
              &gt;{" "}
              {activeEntryId
                ? "Edit Entry"
                : entryType ===
                    "reflection"
                  ? "Daily Reflection"
                  : "Freewrite"}
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
              onClick={() =>
                resetEditor(
                  entryType
                )
              }
              className="min-h-[38px] border border-[#365341] px-3 text-xs text-[#9fd8b5] transition hover:border-[#39ff88] hover:text-[#39ff88]"
            >
              new entry
            </button>
          ) : null}
        </div>

        <div className="p-3">
          <FieldLabel>
            Entry type
          </FieldLabel>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <ModeButton
              active={
                entryType ===
                "reflection"
              }
              label="Daily Reflection"
              onClick={() =>
                changeEntryType(
                  "reflection"
                )
              }
            />

            <ModeButton
              active={
                entryType ===
                "freewrite"
              }
              label="Freewrite"
              onClick={() =>
                changeEntryType(
                  "freewrite"
                )
              }
            />
          </div>

          <label className="mt-4 block">
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
              className={
                inputClassName
              }
            />
          </label>

          <label className="mt-4 block">
            <FieldLabel>
              {entryType ===
              "reflection"
                ? "What happened, what did you feel, and what did you learn?"
                : "Write without filtering"}
            </FieldLabel>

            <textarea
              value={content}
              onChange={(event) => {
                setContent(
                  event.target.value
                );
                markChanged();
              }}
              className={`${inputClassName} min-h-[260px] resize-y leading-6`}
            />
          </label>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_120px]">
            <label className="block">
              <FieldLabel>
                Mood
              </FieldLabel>

              <input
                value={mood}
                onChange={(
                  event
                ) => {
                  setMood(
                    event.target
                      .value
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
                Energy 1–10
              </FieldLabel>

              <input
                value={energy}
                onChange={(
                  event
                ) => {
                  setEnergy(
                    event.target
                      .value
                  );
                  markChanged();
                }}
                inputMode="numeric"
                className={
                  inputClassName
                }
              />
            </label>
          </div>

          <label className="mt-4 block">
            <FieldLabel>
              Tags
            </FieldLabel>

            <input
              value={tags}
              onChange={(event) => {
                setTags(
                  event.target.value
                );
                markChanged();
              }}
              className={
                inputClassName
              }
              placeholder="work, relationships, progress"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              if (activeEntry) {
                void reflectEntry(
                  activeEntry
                );
              }
            }}
            disabled={
              !canReflectCurrent ||
              reflectingEntryId ===
                activeEntryId
            }
            className="mt-3 min-h-[48px] w-full border border-[#39ff88] bg-[#041008] px-3 py-3 text-left text-sm text-[#39ff88] transition hover:bg-[#07150b] disabled:cursor-not-allowed disabled:border-[#242424] disabled:bg-black disabled:text-[#666666]"
          >
            &gt;{" "}
            {reflectingEntryId ===
            activeEntryId
              ? "reflecting..."
              : !activeEntryId
                ? "save first, then reflect"
                : activeEntry?.pending
                  ? "waiting for sync"
                  : !isOnline
                    ? "AI reflection requires connection"
                    : hasUnsavedChanges
                      ? "save changes before reflection"
                      : reflectionByEntry[
                            activeEntryId
                          ]
                        ? "re-run AI reflection"
                        : "run AI reflection"}
          </button>

          {activeEntry &&
          reflectionByEntry[
            activeEntry.id
          ] ? (
            <ReflectionView
              reflection={
                reflectionByEntry[
                  activeEntry.id
                ]
              }
            />
          ) : null}

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={saveEntry}
              disabled={isPending}
              className="min-h-[50px] w-full border border-[#39ff88] bg-black px-4 py-3 text-left text-sm text-[#39ff88] disabled:opacity-60"
            >
              &gt;{" "}
              {isPending
                ? "saving..."
                : activeEntryId
                  ? "save changes"
                  : "save entry"}
            </button>

            <button
              type="button"
              onClick={() =>
                resetEditor(
                  entryType
                )
              }
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
          title="Recent Reflection Signals"
          count={
            sortedEntries.length
          }
        >
          <div className="min-w-0 max-w-full overflow-hidden border border-[#242424] sm:max-h-[680px] sm:overflow-y-auto">
            {sortedEntries.length >
            0 ? (
              sortedEntries.map(
                (entry) => {
                  const reflection =
                    reflectionByEntry[
                      entry.id
                    ];
                  const created =
                    new Date(
                      entry.created_at
                    );
                  const timestamp =
                    `${created.toLocaleDateString()} ${created.toLocaleTimeString(
                      [],
                      {
                        hour:
                          "2-digit",
                        minute:
                          "2-digit",
                      }
                    )}`;

                  return (
                    <SignalEntryDisclosure
                      key={entry.id}
                      title={
                        entry.title ??
                        defaultTitle(
                          entry
                            .entry_type
                        )
                      }
                      meta={
                        entry.pending
                          ? `${timestamp} · pending sync`
                          : timestamp
                      }
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="border border-[#365341] bg-[#06110a] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[#9fd8b5]">
                          {entry.entry_type ===
                          "reflection"
                            ? "daily reflection"
                            : "freewrite"}
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
                              deleteEntry(
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

                      <p className="mt-3 max-w-full whitespace-pre-wrap break-words leading-6 [overflow-wrap:anywhere]">
                        {entry.content}
                      </p>

                      {entry.mood ||
                      entry.energy !==
                        null ||
                      (
                        entry.tags ?? []
                      ).length > 0 ? (
                        <div className="terminal-muted mt-3 border-t border-[#242424] pt-3 text-xs leading-6">
                          {entry.mood ? (
                            <p>
                              mood:{" "}
                              {entry.mood}
                            </p>
                          ) : null}

                          {entry.energy !==
                          null ? (
                            <p>
                              energy:{" "}
                              {
                                entry.energy
                              }
                              /10
                            </p>
                          ) : null}

                          {(
                            entry.tags ??
                            []
                          ).length >
                          0 ? (
                            <p>
                              tags:{" "}
                              {(
                                entry.tags ??
                                []
                              ).join(
                                ", "
                              )}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      {entry.pending ? (
                        <p className="mt-3 text-xs text-[#ffb020]">
                          &gt; saved locally — pending sync
                        </p>
                      ) : null}

                      <button
                        type="button"
                        onClick={() =>
                          void reflectEntry(
                            entry
                          )
                        }
                        disabled={
                          entry.pending ||
                          !isOnline ||
                          reflectingEntryId ===
                            entry.id
                        }
                        className="mt-3 min-h-[44px] w-full border border-[#39ff88] bg-[#041008] px-3 py-2 text-left text-xs text-[#39ff88] disabled:border-[#242424] disabled:bg-black disabled:text-[#666666]"
                      >
                        &gt;{" "}
                        {reflectingEntryId ===
                        entry.id
                          ? "reflecting..."
                          : entry.pending
                            ? "waiting for sync"
                            : !isOnline
                              ? "AI reflection requires connection"
                              : reflection
                                ? "re-run AI reflection"
                                : "run AI reflection"}
                      </button>

                      {reflection ? (
                        <ReflectionView
                          reflection={
                            reflection
                          }
                        />
                      ) : null}
                    </SignalEntryDisclosure>
                  );
                }
              )
            ) : (
              <p className="terminal-muted p-3 text-xs">
                &gt; No reflection or freewrite signals saved yet.
              </p>
            )}
          </div>
        </SignalDisclosure>
      </div>
    </div>
  );
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

function ReflectionView({
  reflection,
}: {
  reflection: AIReflection;
}) {
  return (
    <div className="mt-3 border border-[#39ff88] bg-black p-3 text-xs leading-6">
      <p className="terminal-green mb-3 uppercase tracking-[0.18em]">
        &gt; guided reflection
      </p>

      <ReflectionSection
        title="SUMMARY"
        content={
          reflection.summary
        }
      />
      <ReflectionSection
        title="PATTERN NOTICED"
        content={
          reflection.pattern_noticed
        }
      />
      <ReflectionSection
        title="COMPASSIONATE REFRAME"
        content={
          reflection.compassionate_reframe
        }
      />

      {reflection.questions &&
      reflection.questions.length >
        0 ? (
        <div className="mt-3">
          <p className="terminal-green">
            QUESTIONS:
          </p>

          <ul className="terminal-muted mt-1 space-y-1">
            {reflection.questions.map(
              (
                question,
                index
              ) => (
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

      <ReflectionSection
        title="ONE GROUNDED ACTION"
        content={
          reflection.action_step
        }
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
  if (!content) {
    return null;
  }

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

function defaultTitle(
  type: ReflectionEntryType
) {
  return type === "reflection"
    ? "Daily Reflection"
    : "Freewrite";
}

function parseList(
  value: string
) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) =>
          item.trim()
        )
        .filter(Boolean)
    )
  );
}

function getLocalDateKey() {
  const now = new Date();
  const offset =
    now.getTimezoneOffset() *
    60_000;

  return new Date(
    now.getTime() - offset
  )
    .toISOString()
    .slice(0, 10);
}

const inputClassName =
  "mt-2 w-full border border-[#242424] bg-black px-3 py-3 text-sm text-[#e5e5e5] outline-none focus:border-[#39ff88]";

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
