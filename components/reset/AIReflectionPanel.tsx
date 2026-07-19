"use client";

import {
  useMemo,
  useState,
} from "react";
import { SignalDisclosure } from "@/components/reset/SignalDisclosure";

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

type ReflectionResponse = {
  reflection?: AIReflection;
  error?: string;
};

type AIReflectionPanelProps = {
  entries: JournalEntry[];
  initialReflections: AIReflection[];
};

const labels: Record<
  EntryType,
  string
> = {
  reflection: "Daily Reflection",
  gratitude: "Gratitude",
  recall: "RECALL",
  shadow: "Shadow Console",
  dream: "Dream",
  freewrite: "Freewrite",
};

export function AIReflectionPanel({
  entries,
  initialReflections,
}: AIReflectionPanelProps) {
  const sortedEntries = useMemo(
    () =>
      [...entries].sort((a, b) =>
        b.created_at.localeCompare(
          a.created_at
        )
      ),
    [entries]
  );
  const [reflections, setReflections] =
    useState<AIReflection[]>(
      initialReflections
    );
  const [
    selectedEntryId,
    setSelectedEntryId,
  ] = useState(
    sortedEntries[0]?.id ?? ""
  );
  const [isGenerating, setIsGenerating] =
    useState(false);
  const [message, setMessage] =
    useState<string | null>(null);

  const selectedEntry =
    sortedEntries.find(
      (entry) =>
        entry.id === selectedEntryId
    ) ?? null;

  const sortedReflections = useMemo(
    () =>
      [...reflections].sort((a, b) =>
        b.created_at.localeCompare(
          a.created_at
        )
      ),
    [reflections]
  );

  async function generateReflection() {
    if (!selectedEntry) {
      setMessage(
        "Select a source signal first."
      );
      return;
    }

    setIsGenerating(true);
    setMessage(null);

    try {
      const response = await fetch(
        "/api/reflect-entry",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            journalEntryId:
              selectedEntry.id,
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
            "No reflection was returned."
        );
      }

      setReflections((current) => [
        result.reflection as AIReflection,
        ...current.filter(
          (reflection) =>
            reflection.journal_entry_id !==
            selectedEntry.id
        ),
      ]);
      setMessage(
        "Guided reflection generated."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Reflection generation failed."
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <TerminalBlock title="ai.reflection.workspace">
      <p className="terminal-muted text-xs leading-6">
        &gt; Select a saved signal and generate a
        grounded pattern review. Reflection and Shadow
        capture remain free of automatic interpretation.
      </p>

      <label className="mt-3 block">
        <FieldLabel>Source signal</FieldLabel>
        <select
          value={selectedEntryId}
          onChange={(event) =>
            setSelectedEntryId(
              event.target.value
            )
          }
          className={inputClassName}
        >
          {sortedEntries.length === 0 ? (
            <option value="">
              no saved signals
            </option>
          ) : (
            sortedEntries.map((entry) => (
              <option
                key={entry.id}
                value={entry.id}
              >
                {labels[entry.entry_type]} —{" "}
                {new Date(
                  entry.created_at
                ).toLocaleDateString()}
              </option>
            ))
          )}
        </select>
      </label>

      {selectedEntry ? (
        <div className="mt-3 border border-[#242424] bg-[#030303] p-3">
          <p className="terminal-green text-xs uppercase tracking-[0.16em]">
            &gt; source.preview
          </p>
          <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-[#e5e5e5]">
            {selectedEntry.content}
          </p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={generateReflection}
        disabled={
          isGenerating ||
          !selectedEntry
        }
        className="mt-4 min-h-[50px] w-full border border-[#39ff88] bg-[#050505] px-4 py-3 text-left text-sm text-[#39ff88] transition hover:bg-[#0d0d0d] disabled:cursor-not-allowed disabled:opacity-50"
      >
        &gt;{" "}
        {isGenerating
          ? "generating_reflection..."
          : "generate_reflection"}
      </button>

      {message ? (
        <p className="mt-3 text-xs text-[#ffb020]">
          &gt; {message}
        </p>
      ) : null}

      <div className="mt-5">
        <SignalDisclosure
          title="recent.ai.reflections"
          count={sortedReflections.length}
          summary="Saved pattern reviews and grounded actions"
        >
          <div className="max-h-[680px] overflow-y-auto border border-[#242424]">
            {sortedReflections.length >
            0 ? (
              sortedReflections.map(
                (reflection, index) => (
                  <ReflectionView
                    key={`${reflection.id}-${reflection.created_at}-${index}`}
                    reflection={
                      reflection
                    }
                  />
                )
              )
            ) : (
              <p className="terminal-muted p-3 text-xs">
                &gt; No generated reflections saved yet.
              </p>
            )}
          </div>
        </SignalDisclosure>
      </div>
    </TerminalBlock>
  );
}

function ReflectionView({
  reflection,
}: {
  reflection: AIReflection;
}) {
  const created = new Date(
    reflection.created_at
  );

  return (
    <article className="terminal-line p-3 text-xs leading-6">
      <div className="mb-2 flex flex-wrap justify-between gap-2">
        <span className="terminal-green uppercase">
          {reflection.reflection_type}
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

      <Section
        title="SUMMARY"
        content={reflection.summary}
      />
      <Section
        title="PATTERN NOTICED"
        content={
          reflection.pattern_noticed
        }
      />
      <Section
        title="COMPASSIONATE REFRAME"
        content={
          reflection.compassionate_reframe
        }
      />

      {reflection.questions &&
      reflection.questions.length > 0 ? (
        <div className="mt-3">
          <p className="terminal-green">
            QUESTIONS:
          </p>
          <ul className="terminal-muted mt-1 space-y-1">
            {reflection.questions.map(
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

      <Section
        title="ONE GROUNDED ACTION"
        content={reflection.action_step}
      />
    </article>
  );
}

function Section({
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
