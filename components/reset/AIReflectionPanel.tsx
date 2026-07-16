"use client";

import { useMemo, useState, useTransition } from "react";
import { createClient } from "@/utils/supabase/client";

type EntryType =
  | "reflection"
  | "gratitude"
  | "recall"
  | "shadow"
  | "dream"
  | "freewrite";

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

type SavedAIReflectionRow = {
  log_id: string;
  log_journal_entry_id: string;
  log_reflection_type: AIReflection["reflection_type"];
  log_summary: string | null;
  log_pattern_noticed: string | null;
  log_compassionate_reframe: string | null;
  log_questions: string[] | null;
  log_action_step: string | null;
  log_model: string | null;
  log_created_at: string;
};

type DraftReflection = {
  reflection_type: "journal" | "shadow" | "dream" | "daily_review";
  summary: string;
  pattern_noticed: string;
  compassionate_reframe: string;
  questions: string[];
  action_step: string;
};

type AIReflectionPanelProps = {
  entries: JournalEntry[];
  initialReflections: AIReflection[];
};

const entryTypeLabels: Record<EntryType, string> = {
  reflection: "Daily Reflection",
  gratitude: "Gratitude",
  recall: "RECALL",
  shadow: "Shadow Console",
  dream: "Dream Note",
  freewrite: "Freewrite",
};

export function AIReflectionPanel({
  entries,
  initialReflections,
}: AIReflectionPanelProps) {
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );
  }, [entries]);

  const [reflections, setReflections] =
    useState<AIReflection[]>(initialReflections);

  const [selectedEntryId, setSelectedEntryId] = useState(
    sortedEntries[0]?.id ?? ""
  );

  const selectedEntry = sortedEntries.find(
    (entry) => entry.id === selectedEntryId
  );

  const [draft, setDraft] = useState<DraftReflection | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const sortedReflections = useMemo(() => {
    return [...reflections].sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );
  }, [reflections]);

  function generateMockReflection() {
    if (!selectedEntry) {
      setMessage("No reflection source selected.");
      return;
    }

    const reflectionType =
      selectedEntry.entry_type === "shadow"
        ? "shadow"
        : selectedEntry.entry_type === "dream"
          ? "dream"
          : "journal";

    const generated = buildMockReflection(
      selectedEntry,
      reflectionType
    );

    setDraft(generated);
    setMessage(
      "Mock AI reflection generated. Review before saving."
    );
  }

  function saveReflection() {
    if (!selectedEntry || !draft) {
      setMessage("Generate a reflection draft first.");
      return;
    }

    setMessage(null);

    startTransition(async () => {
      const { data: rawData, error } = await supabase
        .rpc("add_ai_reflection", {
          target_journal_entry_id: selectedEntry.id,
          target_reflection_type: draft.reflection_type,
          target_summary: draft.summary,
          target_pattern_noticed: draft.pattern_noticed,
          target_compassionate_reframe:
            draft.compassionate_reframe,
          target_questions: draft.questions,
          target_action_step: draft.action_step,
          target_model: "mock-local",
        })
        .single();

      if (error) {
        console.error(
          "AI reflection save failed:",
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
        rawData as unknown as SavedAIReflectionRow;

      const savedReflection: AIReflection = {
        id: data.log_id,
        journal_entry_id: data.log_journal_entry_id,
        reflection_type: data.log_reflection_type,
        summary: data.log_summary,
        pattern_noticed: data.log_pattern_noticed,
        compassionate_reframe:
          data.log_compassionate_reframe,
        questions: data.log_questions,
        action_step: data.log_action_step,
        model: data.log_model,
        created_at: data.log_created_at,
      };

      setReflections((current) => [
        savedReflection,
        ...current,
      ]);

      setDraft(null);
      setMessage("AI reflection saved.");
    });
  }

  return (
    <TerminalBlock title="ai.reflection.engine">
      <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <p className="terminal-muted mb-3 text-xs leading-6">
            &gt; Mock engine active. This prepares the reflection
            flow before connecting the real API.
          </p>

          <label className="block">
            <span className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
              Source entry
            </span>

            <select
              value={selectedEntryId}
              onChange={(event) => {
                setSelectedEntryId(event.target.value);
                setDraft(null);
                setMessage(null);
              }}
              className="mt-2 w-full border border-[#242424] bg-[#050505] px-3 py-3 text-sm text-[#e5e5e5] outline-none focus:border-[#39ff88]"
            >
              {sortedEntries.length > 0 ? (
                sortedEntries.map((entry) => {
                  const created = new Date(entry.created_at);

                  return (
                    <option key={entry.id} value={entry.id}>
                      {entryTypeLabels[entry.entry_type]} —{" "}
                      {entry.title ||
                        entry.content.slice(0, 50)}{" "}
                      — {created.toLocaleDateString()}
                    </option>
                  );
                })
              ) : (
                <option value="">No entries yet</option>
              )}
            </select>
          </label>

          {selectedEntry ? (
            <div className="mt-3 border border-[#242424] bg-[#080808] p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="terminal-green">
                  {selectedEntry.title ||
                    entryTypeLabels[
                      selectedEntry.entry_type
                    ]}
                </span>

                <span className="terminal-muted">
                  {
                    entryTypeLabels[
                      selectedEntry.entry_type
                    ]
                  }
                </span>
              </div>

              <p className="max-h-[180px] overflow-y-auto whitespace-pre-wrap text-xs leading-6 text-[#e5e5e5]">
                {selectedEntry.content}
              </p>
            </div>
          ) : (
            <p className="terminal-muted mt-3 text-xs">
              &gt; Save a journal or shadow entry first.
            </p>
          )}

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={generateMockReflection}
              disabled={!selectedEntry || isPending}
              className="border border-[#39ff88] bg-[#050505] px-4 py-3 text-left text-sm text-[#39ff88] transition hover:bg-[#0d0d0d] disabled:cursor-not-allowed disabled:opacity-50"
            >
              &gt; generate_mock_reflection
            </button>

            <button
              type="button"
              onClick={saveReflection}
              disabled={!draft || isPending}
              className="border border-[#242424] bg-[#050505] px-4 py-3 text-left text-sm text-[#e5e5e5] transition hover:border-[#39ff88] hover:text-[#39ff88] disabled:cursor-not-allowed disabled:opacity-50"
            >
              &gt;{" "}
              {isPending
                ? "saving_ai_reflection..."
                : "save_ai_reflection"}
            </button>
          </div>

          {message ? (
            <p className="mt-3 text-xs text-[#ffb020]">
              &gt; {message}
            </p>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="border border-[#242424] bg-[#080808] p-3">
            <TerminalRow
              label="ENGINE"
              value="MOCK-LOCAL"
              green
            />

            <TerminalRow
              label="REAL API"
              value="ALPHA 1.0"
            />

            <TerminalRow
              label="SAVED REFLECTIONS"
              value={String(reflections.length)}
              green={reflections.length > 0}
            />

            <p className="terminal-muted mt-4 text-xs leading-6">
              &gt; Real API connection comes next. This panel
              already uses the same save structure.
            </p>
          </div>

          {draft ? (
            <div className="border border-[#39ff88] bg-[#050505] p-3">
              <p className="terminal-green mb-3 text-xs uppercase tracking-[0.2em]">
                &gt; generated.reflection.draft
              </p>

              <ReflectionDraftView draft={draft} />
            </div>
          ) : (
            <div className="border border-[#242424] bg-[#080808] p-3">
              <p className="terminal-muted text-xs leading-6">
                &gt; Select an entry and generate a mock
                reflection.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5">
        <p className="terminal-green mb-2 text-xs uppercase tracking-[0.2em]">
          &gt; recent.ai.reflections
        </p>

        <div className="max-h-[380px] overflow-y-auto border border-[#242424]">
          {sortedReflections.length > 0 ? (
            sortedReflections
              .slice(0, 8)
              .map((reflection, index) => {
                const created = new Date(
                  reflection.created_at
                );

                return (
                  <div
                    key={`${reflection.id ?? "ai-reflection"}-${reflection.created_at}-${index}`}
                    className="terminal-line p-3 text-xs"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="terminal-green">
                        {reflection.reflection_type.toUpperCase()}{" "}
                        REFLECTION
                      </span>

                      <span className="terminal-muted">
                        {created.toLocaleDateString()}{" "}
                        {created.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <ReflectionSavedView
                      reflection={reflection}
                    />
                  </div>
                );
              })
          ) : (
            <p className="terminal-muted p-3 text-xs">
              &gt; No AI reflections saved yet.
            </p>
          )}
        </div>
      </div>
    </TerminalBlock>
  );
}

function buildMockReflection(
  entry: JournalEntry,
  reflectionType:
    | "journal"
    | "shadow"
    | "dream"
    | "daily_review"
): DraftReflection {
  void entry;

  if (reflectionType === "shadow") {
    return {
      reflection_type: "shadow",
      summary:
        "This entry suggests a moment where a trigger activated an older response pattern.",
      pattern_noticed:
        "There may be a loop between feeling unseen, creating a story around the situation, and reacting from protection instead of choice.",
      compassionate_reframe:
        "The response makes sense as a protective signal. It does not mean the old pattern has to keep running the system.",
      questions: [
        "What did this moment remind you of?",
        "What did you need but not ask for directly?",
        "What would a grounded response look like before reacting?",
      ],
      action_step:
        "Tomorrow, pause before responding and name the actual need in one clear sentence.",
    };
  }

  if (reflectionType === "dream") {
    return {
      reflection_type: "dream",
      summary:
        "This dream note may be holding emotional residue, memory fragments, or symbolic material from the day.",
      pattern_noticed:
        "The strongest details may point toward unresolved emotion rather than literal meaning.",
      compassionate_reframe:
        "Dreams do not need to be solved perfectly. They can be treated as signals from the nervous system and imagination.",
      questions: [
        "What emotion was strongest in the dream?",
        "What symbol or person stood out most?",
        "What situation in waking life has a similar feeling?",
      ],
      action_step:
        "Write one sentence connecting the dream feeling to your current life, without forcing a perfect interpretation.",
    };
  }

  return {
    reflection_type: "journal",
    summary:
      "This entry captures a useful self-observation signal from the day.",
    pattern_noticed:
      "There may be a pattern worth watching around where your actions matched your intended identity and where the old program pulled you off track.",
    compassionate_reframe:
      "You are allowed to notice the gap without attacking yourself. Awareness is part of the rebuild.",
    questions: [
      "Where did I act like the version of myself I am building?",
      "Where did I break pattern?",
      "What is one simple correction for tomorrow?",
    ],
    action_step:
      "Choose one small protocol tomorrow that proves the new identity is online.",
  };
}

function ReflectionDraftView({
  draft,
}: {
  draft: DraftReflection;
}) {
  return (
    <div className="space-y-3 text-xs leading-6">
      <Section title="SUMMARY" content={draft.summary} />

      <Section
        title="PATTERN NOTICED"
        content={draft.pattern_noticed}
      />

      <Section
        title="COMPASSIONATE REFRAME"
        content={draft.compassionate_reframe}
      />

      <div>
        <p className="terminal-green">
          QUESTIONS TO SIT WITH:
        </p>

        <ul className="terminal-muted mt-1 space-y-1">
          {draft.questions.map((question, index) => (
            <li key={`${question}-${index}`}>
              &gt; {question}
            </li>
          ))}
        </ul>
      </div>

      <Section
        title="ONE ACTION FOR TOMORROW"
        content={draft.action_step}
      />
    </div>
  );
}

function ReflectionSavedView({
  reflection,
}: {
  reflection: AIReflection;
}) {
  return (
    <div className="space-y-3 text-xs leading-6">
      <Section
        title="SUMMARY"
        content={reflection.summary ?? ""}
      />

      <Section
        title="PATTERN NOTICED"
        content={reflection.pattern_noticed ?? ""}
      />

      <Section
        title="COMPASSIONATE REFRAME"
        content={reflection.compassionate_reframe ?? ""}
      />

      {reflection.questions &&
      reflection.questions.length > 0 ? (
        <div>
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

      <Section
        title="ONE ACTION FOR TOMORROW"
        content={reflection.action_step ?? ""}
      />
    </div>
  );
}

function Section({
  title,
  content,
}: {
  title: string;
  content: string;
}) {
  return (
    <div>
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