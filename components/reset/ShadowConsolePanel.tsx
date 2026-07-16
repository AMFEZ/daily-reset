"use client";

import { useMemo, useState, useTransition } from "react";
import { createClient } from "@/utils/supabase/client";

type ShadowEntry = {
  id: string;
  entry_type: "shadow";
  title: string | null;
  content: string;
  mood: string | null;
  energy: number | null;
  tags: string[] | null;
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

type ShadowConsolePanelProps = {
  initialEntries: ShadowEntry[];
  initialReflections: AIReflection[];
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
  "What do I keep blaming others for that I secretly need to take responsibility for?",
  "What boundary am I afraid to set because I fear the reaction?",
  "What part of my identity is built around being hurt?",
  "What am I getting from staying stuck?",
  "What do I keep chasing that keeps proving I do not feel enough?",
  "What apology am I waiting for before I allow myself to move on?",
  "Where did I betray myself today in a small way?",
  "What am I afraid people would see if I stopped performing?",
  "What need feels embarrassing to admit?",
  "What pain am I trying to turn into control?",
  "What would I do differently if I truly believed I was worthy already?",
  "What am I still trying to earn from someone who cannot give it to me?",
  "What habit is secretly protecting me from feeling something deeper?",
  "Where am I confusing intensity with connection?",
  "What part of me am I still punishing?",
  "What would change if I stopped making excuses for the old version of me?",
  "What do I need to forgive myself for, even if I am not ready yet?",
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

  const [entries, setEntries] =
    useState<ShadowEntry[]>(initialEntries);
  const [reflections, setReflections] =
    useState<AIReflection[]>(initialReflections);

  const [reflectingEntryId, setReflectingEntryId] =
    useState<string | null>(null);

  const [response, setResponse] = useState("");
  const [emotion, setEmotion] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [energy, setEnergy] = useState("5");
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

  function saveShadowEntry() {
    const cleanResponse = response.trim();
    const cleanEmotion = emotion.trim();
    const cleanNextAction = nextAction.trim();
    const parsedEnergy = Number(energy);

    if (cleanResponse.length < 2) {
      setMessage("Write at least one honest shadow signal.");
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
        .rpc("add_shadow_entry", {
          target_trigger: dailyPrompt,
          target_emotion: cleanEmotion,
          target_story: cleanResponse,
          target_need: "",
          target_response: "",
          target_next_action: cleanNextAction,
          target_energy: energy ? parsedEnergy : null,
        })
        .single();

      if (error) {
        console.error(
          "Shadow save failed:",
          error.message
        );
        setMessage(`Save failed: ${error.message}`);
        return;
      }

      if (!rawData) {
        setMessage(
          "Shadow signal saved, but no saved record was returned."
        );
        return;
      }

      const data =
        rawData as unknown as SavedShadowEntryRow;

      const savedEntry: ShadowEntry = {
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

      setResponse("");
      setEmotion("");
      setNextAction("");
      setEnergy("5");
      setMessage("Shadow signal saved.");
    });
  }

  async function reflectShadowEntry(
    entry: ShadowEntry
  ) {
    setMessage(null);
    setReflectingEntryId(entry.id);

    try {
      const responseResult = await fetch(
        "/api/reflect-entry",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            journalEntryId: entry.id,
          }),
        }
      );

      const result =
        (await responseResult.json()) as ReflectEntryResponse;

      if (!responseResult.ok) {
        setMessage(
          result.error ?? "Shadow reflection failed."
        );
        return;
      }

      if (!result.reflection) {
        setMessage(
          "Shadow reflection completed, but no result was returned."
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

      setMessage("Shadow reflection generated.");
    } catch (error) {
      console.error(
        "Shadow reflection failed:",
        error
      );
      setMessage("Shadow reflection failed.");
    } finally {
      setReflectingEntryId(null);
    }
  }

  return (
    <TerminalBlock title="shadow.console">
      <div className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
        <div>
          <p className="terminal-muted mb-3 text-xs leading-6">
            &gt; One question. No rushing. Deep dive for
            15–30 minutes.
          </p>

          <div className="border border-[#39ff88] bg-[#050505] p-4">
            <p className="terminal-green text-xs uppercase tracking-[0.2em]">
              &gt; today.shadow.prompt
            </p>

            <p className="mt-3 text-base leading-7 text-[#e5e5e5]">
              {dailyPrompt}
            </p>
          </div>

          <label className="mt-4 block">
            <span className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
              Deep dive response
            </span>

            <textarea
              value={response}
              onChange={(event) =>
                setResponse(event.target.value)
              }
              className="mt-2 min-h-[300px] w-full resize-y border border-[#242424] bg-[#050505] px-3 py-3 text-sm leading-6 text-[#e5e5e5] outline-none focus:border-[#39ff88]"
              placeholder="Write the honest answer. Do not perform. Do not soften it. Follow the signal..."
            />
          </label>

          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_100px]">
            <label className="block">
              <span className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
                Main emotion
              </span>

              <input
                value={emotion}
                onChange={(event) =>
                  setEmotion(event.target.value)
                }
                className="mt-2 w-full border border-[#242424] bg-[#050505] px-3 py-3 text-sm text-[#e5e5e5] outline-none focus:border-[#39ff88]"
                placeholder="anger, shame, fear, grief, rejection..."
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
          </div>

          <label className="mt-3 block">
            <span className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
              One grounded action for tomorrow
            </span>

            <textarea
              value={nextAction}
              onChange={(event) =>
                setNextAction(event.target.value)
              }
              className="mt-2 min-h-[90px] w-full resize-y border border-[#242424] bg-[#050505] px-3 py-3 text-sm leading-6 text-[#e5e5e5] outline-none focus:border-[#39ff88]"
              placeholder="What does the greatest version do with this awareness?"
            />
          </label>

          <button
            type="button"
            onClick={saveShadowEntry}
            disabled={isPending}
            className="mt-4 min-h-[48px] w-full border border-[#39ff88] bg-[#050505] px-4 py-3 text-left text-sm text-[#39ff88] transition hover:bg-[#0d0d0d] disabled:cursor-not-allowed disabled:opacity-60"
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
        </div>

        <div className="space-y-4">
          <div className="border border-[#242424] bg-[#080808] p-3">
            <TerminalRow
              label="MODE"
              value="ONE PROMPT DAILY"
              green
            />

            <TerminalRow
              label="PROMPT POOL"
              value={`${hardShadowPrompts.length} HARD QUESTIONS`}
            />

            <TerminalRow
              label="AI REFLECTION"
              value="READY"
              green
            />

            <p className="terminal-muted mt-4 text-xs leading-6">
              &gt; The question rotates daily from the hard
              prompt pool. This keeps the session focused instead
              of scattered.
            </p>
          </div>

          <div className="border border-[#242424] bg-[#080808] p-3">
            <p className="terminal-green mb-2 text-xs uppercase tracking-[0.2em]">
              &gt; session.rule
            </p>

            <p className="terminal-muted text-xs leading-6">
              Stay with the question longer than feels
              comfortable. The first answer is usually
              surface-level. The useful answer is underneath.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <p className="terminal-green mb-2 text-xs uppercase tracking-[0.2em]">
          &gt; recent.shadow.signals
        </p>

        <div className="max-h-[480px] overflow-y-auto border border-[#242424]">
          {sortedEntries.length > 0 ? (
            sortedEntries
              .slice(0, 8)
              .map((entry, index) => {
                const created = new Date(
                  entry.created_at
                );
                const reflection =
                  reflectionsByEntryId[entry.id];

                return (
                  <div
                    key={`${entry.id ?? "shadow-entry"}-${entry.created_at}-${index}`}
                    className="terminal-line p-3 text-xs"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="terminal-green">
                        {entry.title ||
                          "Shadow Console Entry"}
                      </span>

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
                        <span>
                          emotion: {entry.mood}
                        </span>
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
                          reflectShadowEntry(entry)
                        }
                        disabled={
                          reflectingEntryId === entry.id
                        }
                        className="min-h-[48px] w-full whitespace-normal break-words border border-[#39ff88] bg-[#000000] px-4 py-2 text-left text-xs leading-5 text-[#39ff88] transition hover:bg-[#050505] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        &gt;{" "}
                        {reflectingEntryId === entry.id
                          ? "generating_shadow_reflection..."
                          : reflection
                            ? "regenerate_shadow_reflection"
                            : "generate_shadow_reflection"}
                      </button>
                    </div>

                    {reflection ? (
                      <IntegratedShadowReflectionView
                        reflection={reflection}
                      />
                    ) : null}
                  </div>
                );
              })
          ) : (
            <p className="terminal-muted p-3 text-xs">
              &gt; No shadow signals logged yet.
            </p>
          )}
        </div>
      </div>
    </TerminalBlock>
  );
}

function IntegratedShadowReflectionView({
  reflection,
}: {
  reflection: AIReflection;
}) {
  return (
    <div className="mt-3 border border-[#39ff88] bg-[#000000] p-3 text-xs leading-6">
      <p className="terminal-green mb-3 uppercase tracking-[0.2em]">
        &gt; shadow.ai.reflection
      </p>

      <ShadowReflectionSection
        title="SUMMARY"
        content={reflection.summary}
      />

      <ShadowReflectionSection
        title="SHADOW PATTERN"
        content={reflection.pattern_noticed}
      />

      <ShadowReflectionSection
        title="COMPASSIONATE REFRAME"
        content={reflection.compassionate_reframe}
      />

      {reflection.questions &&
      reflection.questions.length > 0 ? (
        <div className="mt-3">
          <p className="terminal-green">
            HARD QUESTIONS:
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

      <ShadowReflectionSection
        title="NEXT GROUNDED ACTION"
        content={reflection.action_step}
      />
    </div>
  );
}

function ShadowReflectionSection({
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