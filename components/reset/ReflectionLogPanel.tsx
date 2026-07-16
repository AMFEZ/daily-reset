"use client";

import { useMemo, useState, useTransition } from "react";
import { createClient } from "@/utils/supabase/client";

type EntryType = "reflection" | "freewrite";

type JournalEntry = {
  id: string;
  entry_type: EntryType;
  title: string | null;
  content: string;
  mood: string | null;
  energy: number | null;
  tags: string[] | null;
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

type ReflectEntryResponse = {
  reflection?: AIReflection;
  error?: string;
};

type ReflectionLogPanelProps = {
  initialEntries: JournalEntry[];
  initialReflections: AIReflection[];
};

const entryTypeLabels: Record<EntryType, string> = {
  reflection: "Daily Reflection",
  freewrite: "Freewrite",
};

const promptsByEntryType: Record<EntryType, string[]> = {
  reflection: [
    "What happened today that mattered?",
    "Where did I act like the person I am becoming?",
    "Where did the old pattern take control?",
    "What is one correction I can make tomorrow?",
  ],
  freewrite: [
    "What is taking up the most space in my mind?",
    "What am I avoiding saying clearly?",
    "What do I need to let move through me?",
    "Write without editing until the signal changes.",
  ],
};

function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function ReflectionLogPanel({
  initialEntries,
  initialReflections,
}: ReflectionLogPanelProps) {
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  const [entries, setEntries] =
    useState<JournalEntry[]>(initialEntries);
  const [reflections, setReflections] =
    useState<AIReflection[]>(initialReflections);

  const [entryType, setEntryType] =
    useState<EntryType>("reflection");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("");
  const [energy, setEnergy] = useState("5");
  const [tags, setTags] = useState("");
  const [message, setMessage] =
    useState<string | null>(null);
  const [reflectingEntryId, setReflectingEntryId] =
    useState<string | null>(null);

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );
  }, [entries]);

  const reflectionsByEntryId = useMemo(() => {
    return reflections.reduce<Record<string, AIReflection>>(
      (accumulator, reflection) => {
        if (!accumulator[reflection.journal_entry_id]) {
          accumulator[reflection.journal_entry_id] =
            reflection;
        }

        return accumulator;
      },
      {}
    );
  }, [reflections]);

  const activePrompts = promptsByEntryType[entryType];

  function usePrompt(prompt: string) {
    setContent((current) => {
      const cleanCurrent = current.trimEnd();

      if (!cleanCurrent) {
        return `${prompt}\n\n`;
      }

      return `${cleanCurrent}\n\n${prompt}\n\n`;
    });
  }

  function saveEntry() {
    const cleanContent = content.trim();
    const parsedEnergy = Number(energy);

    if (cleanContent.length < 2) {
      setMessage("Write at least one real signal.");
      return;
    }

    if (
      energy &&
      (Number.isNaN(parsedEnergy) ||
        parsedEnergy < 1 ||
        parsedEnergy > 10)
    ) {
      setMessage("Energy must be between 1 and 10.");
      return;
    }

    setMessage(null);

    startTransition(async () => {
      const { data: rawData, error } = await supabase
        .rpc("add_journal_entry", {
          target_entry_type: entryType,
          target_title: title.trim() || null,
          target_content: cleanContent,
          target_mood: mood.trim() || null,
          target_energy: energy ? parsedEnergy : null,
          target_tags: parseTags(tags),
        })
        .single();

      if (error) {
        console.error(
          "Reflection save failed:",
          error.message
        );
        setMessage(`Save failed: ${error.message}`);
        return;
      }

      if (!rawData) {
        setMessage(
          "Reflection saved, but no saved record was returned."
        );
        return;
      }

      const data =
        rawData as unknown as SavedJournalEntryRow;

      const savedEntry: JournalEntry = {
        id: data.log_id,
        entry_type: data.log_entry_type,
        title: data.log_title,
        content: data.log_content,
        mood: data.log_mood,
        energy: data.log_energy,
        tags: data.log_tags,
        created_at: data.log_created_at,
      };

      setEntries((current) => [
        savedEntry,
        ...current,
      ]);

      setTitle("");
      setContent("");
      setMood("");
      setEnergy("5");
      setTags("");
      setMessage("Reflection signal saved.");
    });
  }

  async function reflectEntry(entry: JournalEntry) {
    setMessage(null);
    setReflectingEntryId(entry.id);

    try {
      const response = await fetch("/api/reflect-entry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          journalEntryId: entry.id,
        }),
      });

      const result =
        (await response.json()) as ReflectEntryResponse;

      if (!response.ok) {
        setMessage(
          result.error ?? "AI reflection failed."
        );
        return;
      }

      if (!result.reflection) {
        setMessage(
          "AI reflection completed, but no result was returned."
        );
        return;
      }

      setReflections((current) => [
        result.reflection as AIReflection,
        ...current.filter(
          (reflection) =>
            reflection.journal_entry_id !== entry.id
        ),
      ]);

      setMessage("AI reflection generated.");
    } catch (error) {
      console.error("AI reflection failed:", error);
      setMessage("AI reflection failed.");
    } finally {
      setReflectingEntryId(null);
    }
  }

  return (
    <TerminalBlock title="reflection.log">
      <div className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
        <div>
          <p className="terminal-muted mb-3 text-xs leading-6">
            &gt; Write the signal. No performance. No perfect
            wording. Pattern recognition begins with honest logs.
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
                Entry type
              </span>

              <select
                value={entryType}
                onChange={(event) => {
                  setEntryType(
                    event.target.value as EntryType
                  );
                  setMessage(null);
                }}
                className="mt-2 w-full border border-[#242424] bg-[#050505] px-3 py-3 text-sm text-[#e5e5e5] outline-none focus:border-[#39ff88]"
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
              <span className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
                Optional title
              </span>

              <input
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value)
                }
                className="mt-2 w-full border border-[#242424] bg-[#050505] px-3 py-3 text-sm text-[#e5e5e5] outline-none focus:border-[#39ff88]"
                placeholder="Today felt like..."
              />
            </label>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_110px_1fr]">
            <label className="block">
              <span className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
                Mood
              </span>

              <input
                value={mood}
                onChange={(event) =>
                  setMood(event.target.value)
                }
                className="mt-2 w-full border border-[#242424] bg-[#050505] px-3 py-3 text-sm text-[#e5e5e5] outline-none focus:border-[#39ff88]"
                placeholder="calm, heavy, focused..."
              />
            </label>

            <label className="block">
              <span className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
                Energy
              </span>

              <input
                value={energy}
                onChange={(event) =>
                  setEnergy(event.target.value)
                }
                inputMode="numeric"
                className="mt-2 w-full border border-[#242424] bg-[#050505] px-3 py-3 text-sm text-[#e5e5e5] outline-none focus:border-[#39ff88]"
                placeholder="1-10"
              />
            </label>

            <label className="block">
              <span className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
                Tags
              </span>

              <input
                value={tags}
                onChange={(event) =>
                  setTags(event.target.value)
                }
                className="mt-2 w-full border border-[#242424] bg-[#050505] px-3 py-3 text-sm text-[#e5e5e5] outline-none focus:border-[#39ff88]"
                placeholder="work, body, dream..."
              />
            </label>
          </div>

          <label className="mt-3 block">
            <span className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
              Log content
            </span>

            <textarea
              value={content}
              onChange={(event) =>
                setContent(event.target.value)
              }
              className="mt-2 min-h-[260px] w-full resize-y border border-[#242424] bg-[#050505] px-3 py-3 text-sm leading-6 text-[#e5e5e5] outline-none focus:border-[#39ff88]"
              placeholder="Type the signal..."
            />
          </label>

          <button
            type="button"
            onClick={saveEntry}
            disabled={isPending}
            className="mt-4 min-h-[48px] w-full border border-[#39ff88] bg-[#050505] px-4 py-3 text-left text-sm text-[#39ff88] transition hover:bg-[#0d0d0d] disabled:cursor-not-allowed disabled:opacity-60"
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
        </div>

        <div className="space-y-4">
          <div className="border border-[#242424] bg-[#080808] p-3">
            <p className="terminal-green mb-3 text-xs uppercase tracking-[0.2em]">
              &gt; prompt.signals
            </p>

            <div className="space-y-2">
              {activePrompts.map((prompt, index) => (
                <button
                  type="button"
                  key={`${entryType}-${index}`}
                  onClick={() => usePrompt(prompt)}
                  className="block w-full border border-[#242424] bg-[#050505] px-3 py-2 text-left text-xs leading-5 text-[#e5e5e5] transition hover:border-[#39ff88] hover:text-[#39ff88]"
                >
                  &gt; {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="border border-[#242424] bg-[#080808] p-3">
            <TerminalRow
              label="ENTRIES"
              value={String(entries.length)}
              green={entries.length > 0}
            />

            <TerminalRow
              label="ACTIVE TYPE"
              value={entryTypeLabels[entryType]}
            />

            <TerminalRow
              label="AI REFLECTION"
              value="ONLINE"
              green
            />

            <p className="terminal-muted mt-4 text-xs leading-6">
              &gt; Save the raw entry first. AI reflection can
              then surface patterns, reframes, and one grounded
              action.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <p className="terminal-green mb-2 text-xs uppercase tracking-[0.2em]">
          &gt; recent.reflection.signals
        </p>

        <div className="max-h-[520px] overflow-y-auto border border-[#242424]">
          {sortedEntries.length > 0 ? (
            sortedEntries
              .slice(0, 10)
              .map((entry, index) => {
                const created = new Date(
                  entry.created_at
                );
                const reflection =
                  reflectionsByEntryId[entry.id];

                return (
                  <div
                    key={`${entry.id ?? "journal-entry"}-${entry.created_at}-${index}`}
                    className="terminal-line p-3 text-xs"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="terminal-green">
                          {entry.title ||
                            entryTypeLabels[
                              entry.entry_type
                            ]}
                        </span>

                        <span className="terminal-muted">
                          {" "}
                          /{" "}
                          {
                            entryTypeLabels[
                              entry.entry_type
                            ]
                          }
                        </span>
                      </div>

                      <span className="terminal-muted">
                        {created.toLocaleDateString()}{" "}
                        {created.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <p className="whitespace-pre-wrap leading-6 text-[#e5e5e5]">
                      {entry.content}
                    </p>

                    <div className="terminal-muted mt-2 flex flex-wrap gap-3">
                      {entry.mood ? (
                        <span>mood: {entry.mood}</span>
                      ) : null}

                      {entry.energy ? (
                        <span>
                          energy: {entry.energy}/10
                        </span>
                      ) : null}

                      {entry.tags &&
                      entry.tags.length > 0 ? (
                        <span>
                          tags: {entry.tags.join(", ")}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() =>
                          reflectEntry(entry)
                        }
                        disabled={
                          reflectingEntryId === entry.id
                        }
                        className="min-h-[48px] w-full whitespace-normal break-words border border-[#39ff88] bg-[#000000] px-4 py-2 text-left text-xs leading-5 text-[#39ff88] transition hover:bg-[#050505] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        &gt;{" "}
                        {reflectingEntryId === entry.id
                          ? "generating_ai_reflection..."
                          : reflection
                            ? "regenerate_ai_reflection"
                            : "generate_ai_reflection"}
                      </button>
                    </div>

                    {reflection ? (
                      <IntegratedReflectionView
                        reflection={reflection}
                      />
                    ) : null}
                  </div>
                );
              })
          ) : (
            <p className="terminal-muted p-3 text-xs">
              &gt; No reflection signals logged yet.
            </p>
          )}
        </div>
      </div>
    </TerminalBlock>
  );
}

function IntegratedReflectionView({
  reflection,
}: {
  reflection: AIReflection;
}) {
  return (
    <div className="mt-3 border border-[#39ff88] bg-[#000000] p-3 text-xs leading-6">
      <p className="terminal-green mb-3 uppercase tracking-[0.2em]">
        &gt; ai.reflection
      </p>

      <ReflectionSection
        title="SUMMARY"
        content={reflection.summary}
      />

      <ReflectionSection
        title="PATTERN NOTICED"
        content={reflection.pattern_noticed}
      />

      <ReflectionSection
        title="COMPASSIONATE REFRAME"
        content={reflection.compassionate_reframe}
      />

      {reflection.questions &&
      reflection.questions.length > 0 ? (
        <div className="mt-3">
          <p className="terminal-green">
            QUESTIONS TO SIT WITH:
          </p>

          <ul className="terminal-muted mt-1 space-y-1">
            {reflection.questions.map(
              (question, index) => (
                <li key={`${question}-${index}`}>
                  &gt; {question}
                </li>
              )
            )}
          </ul>
        </div>
      ) : null}

      <ReflectionSection
        title="ONE ACTION FOR TOMORROW"
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
  if (!content) {
    return null;
  }

  return (
    <div className="mt-3">
      <p className="terminal-green">{title}:</p>
      <p className="terminal-muted mt-1 whitespace-pre-wrap">
        {content}
      </p>
    </div>
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
      <span className="terminal-muted text-xs">
        {label}
      </span>

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