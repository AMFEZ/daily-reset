"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { createClient } from "@/utils/supabase/client";

type JournalSection =
  | "desires"
  | "emotions"
  | "beliefs";

type AlignmentStatus =
  | "allowing"
  | "blocking";

export type ReprogramDesire = {
  id: string;
  desire: string;
  desire_emotions: string;
  absence_emotions: string | null;
  current_emotional_satisfaction: number;
  created_at: string;
  updated_at: string;
};

export type ReprogramEmotionLog = {
  id: string;
  trigger: string;
  emotion: string;
  alignment_status: AlignmentStatus;
  occurred_at: string;
  created_at: string;
  updated_at: string;
};

export type ReprogramBelief = {
  id: string;
  faulty_belief: string;
  reconstruction_script: string;
  intensity_score: number;
  is_displaced: boolean;
  displaced_at: string | null;
  created_at: string;
  updated_at: string;
};

type ReprogramJournalPanelProps = {
  userId: string;
  initialDesires: ReprogramDesire[];
  initialEmotionLogs: ReprogramEmotionLog[];
  initialBeliefs: ReprogramBelief[];
};

const sectionLabels: Record<
  JournalSection,
  string
> = {
  desires: "01 / DESIRES",
  emotions: "02 / EMOTION TRACKER",
  beliefs: "03 / BELIEF DISPLACEMENT",
};

export function ReprogramJournalPanel({
  userId,
  initialDesires,
  initialEmotionLogs,
  initialBeliefs,
}: ReprogramJournalPanelProps) {
  const supabase = createClient();

  const [isPending, startTransition] =
    useTransition();

  const [activeSection, setActiveSection] =
    useState<JournalSection>("desires");

  const [desires, setDesires] = useState(
    initialDesires
  );

  const [emotionLogs, setEmotionLogs] =
    useState(initialEmotionLogs);

  const [beliefs, setBeliefs] = useState(
    initialBeliefs
  );

  const [message, setMessage] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setMessage(null);
    }, 3200);

    return () => window.clearTimeout(timeout);
  }, [message]);

  const sectionCounts: Record<
    JournalSection,
    number
  > = {
    desires: desires.length,
    emotions: emotionLogs.length,
    beliefs: beliefs.length,
  };

  return (
    <TerminalBlock title="reprogram.journal">
      <p className="terminal-muted text-xs leading-6">
        &gt; Capture desires, identify emotional
        resistance, and reconstruct beliefs that no
        longer serve the person you are becoming.
      </p>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {(
          Object.keys(
            sectionLabels
          ) as JournalSection[]
        ).map((section) => (
          <button
            key={section}
            type="button"
            onClick={() => {
              setActiveSection(section);
              setMessage(null);
            }}
            className={
              activeSection === section
                ? "min-h-[48px] border border-[#39ff88] bg-[#0d0d0d] px-3 py-3 text-left text-xs text-[#39ff88]"
                : "min-h-[48px] border border-[#242424] bg-[#050505] px-3 py-3 text-left text-xs text-[#8a8a8a] transition hover:border-[#39ff88] hover:text-[#39ff88]"
            }
          >
            &gt; {sectionLabels[section]} ({sectionCounts[section]})
          </button>
        ))}
      </div>

      <PatternReview
        emotionLogs={emotionLogs}
        beliefs={beliefs}
      />

      <div className="mt-4">
        {activeSection === "desires" ? (
          <DesireSection
            userId={userId}
            desires={desires}
            setDesires={setDesires}
            setMessage={setMessage}
            startTransition={startTransition}
            isPending={isPending}
          />
        ) : null}

        {activeSection === "emotions" ? (
          <EmotionSection
            userId={userId}
            emotionLogs={emotionLogs}
            setEmotionLogs={setEmotionLogs}
            setMessage={setMessage}
            startTransition={startTransition}
            isPending={isPending}
          />
        ) : null}

        {activeSection === "beliefs" ? (
          <BeliefSection
            userId={userId}
            beliefs={beliefs}
            setBeliefs={setBeliefs}
            setMessage={setMessage}
            startTransition={startTransition}
            isPending={isPending}
          />
        ) : null}
      </div>

      {message ? (
        <div className="mt-4 border border-[#39ff88] bg-[#080808] p-3 text-xs leading-5 text-[#39ff88]">
          <p>&gt; {message}</p>
          <p>&gt; sync complete</p>
        </div>
      ) : null}
    </TerminalBlock>
  );
}

function DesireSection({
  userId,
  desires,
  setDesires,
  setMessage,
  startTransition,
  isPending,
}: {
  userId: string;
  desires: ReprogramDesire[];
  setDesires: React.Dispatch<
    React.SetStateAction<ReprogramDesire[]>
  >;
  setMessage: React.Dispatch<
    React.SetStateAction<string | null>
  >;
  startTransition: React.TransitionStartFunction;
  isPending: boolean;
}) {
  const supabase = createClient();

  const [desire, setDesire] = useState("");
  const [
    desireEmotions,
    setDesireEmotions,
  ] = useState("");
  const [
    absenceEmotions,
    setAbsenceEmotions,
  ] = useState("");
  const [
    emotionalSatisfaction,
    setEmotionalSatisfaction,
  ] = useState("50");

  function saveDesire() {
    const cleanDesire = desire.trim();
    const cleanDesireEmotions =
      desireEmotions.trim();

    const satisfaction = Number(
      emotionalSatisfaction
    );

    if (cleanDesire.length < 2) {
      setMessage(
        "Describe the desire before saving."
      );
      return;
    }

    if (cleanDesireEmotions.length < 2) {
      setMessage(
        "Add the emotions related to having the desire."
      );
      return;
    }

    if (
      Number.isNaN(satisfaction) ||
      satisfaction < 0 ||
      satisfaction > 100
    ) {
      setMessage(
        "Emotional satisfaction must be between 0 and 100."
      );
      return;
    }

    setMessage(null);

    startTransition(async () => {
      const { data, error } = await supabase
        .from("reprogram_desires")
        .insert({
          user_id: userId,
          desire: cleanDesire,
          desire_emotions:
            cleanDesireEmotions,
          absence_emotions:
            absenceEmotions.trim() || null,
          current_emotional_satisfaction:
            satisfaction,
        })
        .select(
          "id, desire, desire_emotions, absence_emotions, current_emotional_satisfaction, created_at, updated_at"
        )
        .single();

      if (error) {
        console.error(
          "Desire save failed:",
          error.message
        );

        setMessage(
          `Desire save failed: ${error.message}`
        );
        return;
      }

      setDesires((current) => [
        data as ReprogramDesire,
        ...current,
      ]);

      setDesire("");
      setDesireEmotions("");
      setAbsenceEmotions("");
      setEmotionalSatisfaction("50");

      setMessage("desire_signal saved");
    });
  }

  return (
    <SectionLayout
      title="01 / IDENTIFYING DESIRES"
      description="Add a desire whenever it enters your awareness. Record both the emotional presence of having it and the resistance connected to its absence."
    >
      <div className="grid gap-3">
        <FieldLabel label="Desire">
          <textarea
            value={desire}
            onChange={(event) =>
              setDesire(event.target.value)
            }
            className={textareaClass}
            placeholder="What do I want?"
          />
        </FieldLabel>

        <FieldLabel label="Emotions related to the desire">
          <textarea
            value={desireEmotions}
            onChange={(event) =>
              setDesireEmotions(
                event.target.value
              )
            }
            className={textareaClass}
            placeholder="How would having this feel?"
          />
        </FieldLabel>

        <FieldLabel label="Emotions related to the desire not being present">
          <textarea
            value={absenceEmotions}
            onChange={(event) =>
              setAbsenceEmotions(
                event.target.value
              )
            }
            className={textareaClass}
            placeholder="What emotions appear when I notice it is not here yet?"
          />
        </FieldLabel>

        <FieldLabel label="Emotional satisfaction with current condition">
          <div className="mt-2 grid gap-3 md:grid-cols-[1fr_100px]">
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={emotionalSatisfaction}
              onChange={(event) =>
                setEmotionalSatisfaction(
                  event.target.value
                )
              }
              className="w-full accent-[#39ff88]"
            />

            <div className="border border-[#242424] bg-[#050505] px-3 py-3 text-center text-sm text-[#39ff88]">
              {emotionalSatisfaction}%
            </div>
          </div>
        </FieldLabel>

        <SaveButton
          onClick={saveDesire}
          disabled={isPending}
          pendingLabel="saving desire..."
          label="save desire_signal"
        />
      </div>

      <CollapsibleHistory
        title="saved.desires"
        count={desires.length}
        resetKey={desires.length}
      >
        <div className={historyContainerClass}>
          {desires.length > 0 ? (
            desires.map((entry) => (
              <EditableDesireCard
                key={entry.id}
                entry={entry}
                onUpdated={(updated) =>
                  setDesires((current) =>
                    current.map((item) =>
                      item.id === updated.id
                        ? updated
                        : item
                    )
                  )
                }
                onDeleted={(id) =>
                  setDesires((current) =>
                    current.filter(
                      (item) => item.id !== id
                    )
                  )
                }
                setMessage={setMessage}
              />
            ))
          ) : (
            <EmptyHistory text="No desires recorded yet." />
          )}
        </div>
      </CollapsibleHistory>
    </SectionLayout>
  );
}

function EmotionSection({
  userId,
  emotionLogs,
  setEmotionLogs,
  setMessage,
  startTransition,
  isPending,
}: {
  userId: string;
  emotionLogs: ReprogramEmotionLog[];
  setEmotionLogs: React.Dispatch<
    React.SetStateAction<
      ReprogramEmotionLog[]
    >
  >;
  setMessage: React.Dispatch<
    React.SetStateAction<string | null>
  >;
  startTransition: React.TransitionStartFunction;
  isPending: boolean;
}) {
  const supabase = createClient();

  const [trigger, setTrigger] = useState("");
  const [emotion, setEmotion] = useState("");
  const [
    alignmentStatus,
    setAlignmentStatus,
  ] =
    useState<AlignmentStatus>("blocking");

  const [emotionFilter, setEmotionFilter] =
    useState<"all" | AlignmentStatus>("all");

  const filteredEmotionLogs = useMemo(
    () =>
      emotionFilter === "all"
        ? emotionLogs
        : emotionLogs.filter(
            (entry) =>
              entry.alignment_status ===
              emotionFilter
          ),
    [emotionFilter, emotionLogs]
  );

  function saveEmotion() {
    const cleanTrigger = trigger.trim();
    const cleanEmotion = emotion.trim();

    if (cleanTrigger.length < 2) {
      setMessage(
        "Describe the thought or event trigger."
      );
      return;
    }

    if (cleanEmotion.length < 2) {
      setMessage(
        "Describe the emotion that appeared."
      );
      return;
    }

    setMessage(null);

    startTransition(async () => {
      const { data, error } = await supabase
        .from("reprogram_emotion_logs")
        .insert({
          user_id: userId,
          trigger: cleanTrigger,
          emotion: cleanEmotion,
          alignment_status: alignmentStatus,
        })
        .select(
          "id, trigger, emotion, alignment_status, occurred_at, created_at, updated_at"
        )
        .single();

      if (error) {
        console.error(
          "Emotion save failed:",
          error.message
        );

        setMessage(
          `Emotion save failed: ${error.message}`
        );
        return;
      }

      setEmotionLogs((current) => [
        data as ReprogramEmotionLog,
        ...current,
      ]);

      setTrigger("");
      setEmotion("");
      setAlignmentStatus("blocking");

      setMessage("emotion_signal saved");
    });
  }

  return (
    <SectionLayout
      title="02 / DAILY EMOTION TRACKER"
      description="Log the moments that create an emotional signal, especially triggers, memories, internal struggles, and recurring reactions."
    >
      <div className="grid gap-3">
        <FieldLabel label="Thought / event trigger">
          <textarea
            value={trigger}
            onChange={(event) =>
              setTrigger(event.target.value)
            }
            className={textareaClass}
            placeholder="What happened, or what thought appeared?"
          />
        </FieldLabel>

        <FieldLabel label="Emotion felt">
          <input
            value={emotion}
            onChange={(event) =>
              setEmotion(event.target.value)
            }
            className={inputClass}
            placeholder="frustrated, afraid, ashamed, calm..."
          />
        </FieldLabel>

        <FieldLabel label="Is the emotion allowing or blocking?">
          <div className="mt-2 grid grid-cols-2 gap-2">
            <AlignmentButton
              label="ALLOWING"
              selected={
                alignmentStatus === "allowing"
              }
              onClick={() =>
                setAlignmentStatus("allowing")
              }
            />

            <AlignmentButton
              label="BLOCKING"
              selected={
                alignmentStatus === "blocking"
              }
              onClick={() =>
                setAlignmentStatus("blocking")
              }
            />
          </div>
        </FieldLabel>

        <SaveButton
          onClick={saveEmotion}
          disabled={isPending}
          pendingLabel="saving emotion..."
          label="save emotion_signal"
        />
      </div>

      <FilterBar
        label="emotion filter"
        options={[
          { label: "ALL", value: "all" },
          { label: "ALLOWING", value: "allowing" },
          { label: "BLOCKING", value: "blocking" },
        ]}
        value={emotionFilter}
        onChange={(value) =>
          setEmotionFilter(
            value as "all" | AlignmentStatus
          )
        }
      />

      <CollapsibleHistory
        title="daily.emotion.signals"
        count={filteredEmotionLogs.length}
        resetKey={`${emotionLogs.length}-${emotionFilter}`}
      >
        <div className={historyContainerClass}>
          {filteredEmotionLogs.length > 0 ? (
            filteredEmotionLogs.map((entry) => (
              <EditableEmotionCard
                key={entry.id}
                entry={entry}
                onUpdated={(updated) =>
                  setEmotionLogs((current) =>
                    current.map((item) =>
                      item.id === updated.id
                        ? updated
                        : item
                    )
                  )
                }
                onDeleted={(id) =>
                  setEmotionLogs((current) =>
                    current.filter(
                      (item) => item.id !== id
                    )
                  )
                }
                setMessage={setMessage}
              />
            ))
          ) : (
            <EmptyHistory text="No emotion signals match this filter." />
          )}
        </div>
      </CollapsibleHistory>
    </SectionLayout>
  );
}

function BeliefSection({
  userId,
  beliefs,
  setBeliefs,
  setMessage,
  startTransition,
  isPending,
}: {
  userId: string;
  beliefs: ReprogramBelief[];
  setBeliefs: React.Dispatch<
    React.SetStateAction<ReprogramBelief[]>
  >;
  setMessage: React.Dispatch<
    React.SetStateAction<string | null>
  >;
  startTransition: React.TransitionStartFunction;
  isPending: boolean;
}) {
  const supabase = createClient();

  const [
    faultyBelief,
    setFaultyBelief,
  ] = useState("");

  const [
    reconstructionScript,
    setReconstructionScript,
  ] = useState("");

  const [intensity, setIntensity] =
    useState("5");

  const [beliefFilter, setBeliefFilter] =
    useState<"all" | "active" | "displaced">(
      "all"
    );

  const filteredBeliefs = useMemo(
    () =>
      beliefFilter === "all"
        ? beliefs
        : beliefs.filter((entry) =>
            beliefFilter === "displaced"
              ? entry.is_displaced
              : !entry.is_displaced
          ),
    [beliefFilter, beliefs]
  );

  function saveBelief() {
    const cleanBelief = faultyBelief.trim();

    const cleanScript =
      reconstructionScript.trim();

    const parsedIntensity = Number(intensity);

    if (cleanBelief.length < 2) {
      setMessage(
        "Describe the faulty belief before saving."
      );
      return;
    }

    if (cleanScript.length < 2) {
      setMessage(
        "Write a reconstruction script before saving."
      );
      return;
    }

    if (
      Number.isNaN(parsedIntensity) ||
      parsedIntensity < 0 ||
      parsedIntensity > 10
    ) {
      setMessage(
        "Belief intensity must be between 0 and 10."
      );
      return;
    }

    setMessage(null);

    startTransition(async () => {
      const { data, error } = await supabase
        .from("reprogram_beliefs")
        .insert({
          user_id: userId,
          faulty_belief: cleanBelief,
          reconstruction_script: cleanScript,
          intensity_score: parsedIntensity,
        })
        .select(
          "id, faulty_belief, reconstruction_script, intensity_score, is_displaced, displaced_at, created_at, updated_at"
        )
        .single();

      if (error) {
        console.error(
          "Belief save failed:",
          error.message
        );

        setMessage(
          `Belief save failed: ${error.message}`
        );
        return;
      }

      setBeliefs((current) => [
        data as ReprogramBelief,
        ...current,
      ]);

      setFaultyBelief("");
      setReconstructionScript("");
      setIntensity("5");

      setMessage("belief_signal saved");
    });
  }

  return (
    <SectionLayout
      title="03 / FAULTY BELIEF DISPLACEMENT"
      description="Identify the belief beneath the emotional trigger. Write a reconstruction script that returns you to a more natural, grounded, and useful belief."
    >
      <div className="grid gap-3">
        <FieldLabel label="Faulty belief">
          <textarea
            value={faultyBelief}
            onChange={(event) =>
              setFaultyBelief(
                event.target.value
              )
            }
            className={textareaClass}
            placeholder="I am not good enough to complete this job."
          />
        </FieldLabel>

        <FieldLabel label="Reconstruction script">
          <textarea
            value={reconstructionScript}
            onChange={(event) =>
              setReconstructionScript(
                event.target.value
              )
            }
            className="mt-2 min-h-[180px] w-full resize-y border border-[#242424] bg-[#050505] px-3 py-3 text-sm leading-6 text-[#e5e5e5] outline-none focus:border-[#39ff88]"
            placeholder="What is more accurate, natural, compassionate, and useful?"
          />
        </FieldLabel>

        <FieldLabel label="Intensity score">
          <div className="mt-2 grid gap-3 md:grid-cols-[1fr_100px]">
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={intensity}
              onChange={(event) =>
                setIntensity(
                  event.target.value
                )
              }
              className="w-full accent-[#39ff88]"
            />

            <div className="border border-[#242424] bg-[#050505] px-3 py-3 text-center text-sm text-[#39ff88]">
              {intensity}/10
            </div>
          </div>

          <p className="terminal-muted mt-2 text-[11px] leading-5">
            &gt; A score of 0 marks the belief as
            displaced.
          </p>
        </FieldLabel>

        <SaveButton
          onClick={saveBelief}
          disabled={isPending}
          pendingLabel="saving belief..."
          label="save belief_signal"
        />
      </div>

      <FilterBar
        label="belief filter"
        options={[
          { label: "ALL", value: "all" },
          { label: "ACTIVE", value: "active" },
          { label: "DISPLACED", value: "displaced" },
        ]}
        value={beliefFilter}
        onChange={(value) =>
          setBeliefFilter(
            value as
              | "all"
              | "active"
              | "displaced"
          )
        }
      />

      <CollapsibleHistory
        title="belief.displacement.tracker"
        count={filteredBeliefs.length}
        resetKey={`${beliefs.length}-${beliefFilter}`}
      >
        <div className={historyContainerClass}>
          {filteredBeliefs.length > 0 ? (
            filteredBeliefs.map((entry) => (
              <EditableBeliefCard
                key={entry.id}
                entry={entry}
                onUpdated={(updated) =>
                  setBeliefs((current) =>
                    current.map((item) =>
                      item.id === updated.id
                        ? updated
                        : item
                    )
                  )
                }
                onDeleted={(id) =>
                  setBeliefs((current) =>
                    current.filter(
                      (item) => item.id !== id
                    )
                  )
                }
                setMessage={setMessage}
              />
            ))
          ) : (
            <EmptyHistory text="No beliefs match this filter." />
          )}
        </div>
      </CollapsibleHistory>
    </SectionLayout>
  );
}

function PatternReview({
  emotionLogs,
  beliefs,
}: {
  emotionLogs: ReprogramEmotionLog[];
  beliefs: ReprogramBelief[];
}) {
  const sevenDaysAgo = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - 6);
    return date;
  }, []);

  const emotionCounts = useMemo(
    () => countNormalizedValues(
      emotionLogs.map((entry) => entry.emotion)
    ),
    [emotionLogs]
  );

  const triggerCounts = useMemo(
    () => countTriggerKeywords(emotionLogs),
    [emotionLogs]
  );

  const weeklyEmotionLogs = useMemo(
    () =>
      emotionLogs.filter(
        (entry) =>
          new Date(entry.occurred_at) >=
          sevenDaysAgo
      ),
    [emotionLogs, sevenDaysAgo]
  );

  const weeklyBeliefs = useMemo(
    () =>
      beliefs.filter(
        (entry) =>
          new Date(entry.updated_at) >=
          sevenDaysAgo
      ),
    [beliefs, sevenDaysAgo]
  );

  const weeklyEmotionCounts = useMemo(
    () => countNormalizedValues(
      weeklyEmotionLogs.map(
        (entry) => entry.emotion
      )
    ),
    [weeklyEmotionLogs]
  );

  const weeklyBlockingTriggers = useMemo(
    () => countTriggerKeywords(
      weeklyEmotionLogs.filter(
        (entry) =>
          entry.alignment_status === "blocking"
      )
    ),
    [weeklyEmotionLogs]
  );

  const displacedCount = beliefs.filter(
    (entry) => entry.is_displaced
  ).length;
  const activeCount = beliefs.length - displacedCount;
  const averageIntensity = beliefs.length
    ? (
        beliefs.reduce(
          (total, entry) =>
            total + entry.intensity_score,
          0
        ) / beliefs.length
      ).toFixed(1)
    : "0.0";

  const improvedThisWeek = weeklyBeliefs.filter(
    (entry) =>
      entry.is_displaced ||
      entry.intensity_score <= 3
  ).length;

  const strongestEmotion =
    weeklyEmotionCounts[0]?.label ?? "none yet";
  const biggestBlockingPattern =
    weeklyBlockingTriggers[0]?.label ??
    "none yet";

  return (
    <details className="mt-4 border border-[#242424] bg-[#050505]">
      <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-xs uppercase tracking-[0.2em] text-[#39ff88] [&::-webkit-details-marker]:hidden">
        <span>&gt; pattern.review</span>
        <span className="terminal-muted tracking-normal">
          7 days
        </span>
      </summary>

      <div className="grid gap-4 border-t border-[#242424] p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="ACTIVE BELIEFS"
            value={String(activeCount)}
          />
          <MetricCard
            label="DISPLACED BELIEFS"
            value={String(displacedCount)}
            green
          />
          <MetricCard
            label="AVG. INTENSITY"
            value={`${averageIntensity}/10`}
          />
          <MetricCard
            label="IMPROVED THIS WEEK"
            value={String(improvedThisWeek)}
            green={improvedThisWeek > 0}
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <PatternList
            title="most.logged.emotions"
            items={emotionCounts.slice(0, 5)}
            empty="No emotions logged yet."
          />
          <PatternList
            title="most.common.trigger.words"
            items={triggerCounts.slice(0, 5)}
            empty="No trigger patterns yet."
          />
        </div>

        <div className="border border-[#242424] bg-[#080808] p-3">
          <p className="terminal-green text-xs uppercase tracking-[0.2em]">
            &gt; weekly.review
          </p>

          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <TerminalRow
              label="EMOTION SIGNALS"
              value={String(weeklyEmotionLogs.length)}
            />
            <TerminalRow
              label="BELIEFS UPDATED"
              value={String(weeklyBeliefs.length)}
            />
            <TerminalRow
              label="STRONGEST RECURRING EMOTION"
              value={strongestEmotion.toUpperCase()}
              green={strongestEmotion !== "none yet"}
            />
            <TerminalRow
              label="BIGGEST BLOCKING PATTERN"
              value={biggestBlockingPattern.toUpperCase()}
            />
          </div>
        </div>
      </div>
    </details>
  );
}

function FilterBar({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{
    label: string;
    value: string;
  }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mt-6 border border-[#242424] bg-[#080808] p-3">
      <p className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
        &gt; {label}
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={
              value === option.value
                ? "min-h-[40px] border border-[#39ff88] bg-[#0d0d0d] px-3 text-xs text-[#39ff88]"
                : "min-h-[40px] border border-[#242424] bg-[#050505] px-3 text-xs text-[#8a8a8a] transition hover:border-[#39ff88] hover:text-[#39ff88]"
            }
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  green = false,
}: {
  label: string;
  value: string;
  green?: boolean;
}) {
  return (
    <div className="border border-[#242424] bg-[#080808] p-3">
      <p className="terminal-muted text-[10px] uppercase tracking-[0.16em]">
        {label}
      </p>
      <p
        className={`mt-2 text-lg ${
          green ? "terminal-green" : "text-[#e5e5e5]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function PatternList({
  title,
  items,
  empty,
}: {
  title: string;
  items: Array<{ label: string; count: number }>;
  empty: string;
}) {
  return (
    <div className="border border-[#242424] bg-[#080808] p-3">
      <p className="terminal-green text-xs uppercase tracking-[0.2em]">
        &gt; {title}
      </p>

      <div className="mt-3 grid gap-2">
        {items.length > 0 ? (
          items.map((item, index) => (
            <div
              key={`${item.label}-${index}`}
              className="flex items-center justify-between gap-3 border-t border-[#242424] pt-2 text-xs first:border-t-0 first:pt-0"
            >
              <span className="text-[#d0d0d0]">
                {item.label}
              </span>
              <span className="terminal-green">
                {item.count}
              </span>
            </div>
          ))
        ) : (
          <p className="terminal-muted text-xs">
            &gt; {empty}
          </p>
        )}
      </div>
    </div>
  );
}

function countNormalizedValues(values: string[]) {
  const counts = new Map<string, number>();

  values.forEach((value) => {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

    if (!normalized) {
      return;
    }

    counts.set(
      normalized,
      (counts.get(normalized) ?? 0) + 1
    );
  });

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.label.localeCompare(b.label)
    );
}

function countTriggerKeywords(
  logs: ReprogramEmotionLog[]
) {
  const stopWords = new Set([
    "about", "after", "again", "because", "before",
    "being", "could", "didnt", "doesnt", "feeling",
    "from", "have", "just", "like", "more", "myself",
    "that", "their", "there", "they", "this", "thought",
    "through", "trigger", "very", "want", "when", "where",
    "which", "with", "would", "your", "youre",
  ]);

  const counts = new Map<string, number>();

  logs.forEach((entry) => {
    const uniqueWords = new Set(
      entry.trigger
        .toLowerCase()
        .replace(/[^a-z0-9' ]/g, " ")
        .split(/\s+/)
        .map((word) => word.replace(/'/g, ""))
        .filter(
          (word) =>
            word.length >= 4 &&
            !stopWords.has(word)
        )
    );

    uniqueWords.forEach((word) => {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.label.localeCompare(b.label)
    );
}

function SectionLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 border border-[#242424] bg-[#080808] p-3">
        <p className="terminal-green text-xs uppercase tracking-[0.2em]">
          &gt; {title}
        </p>

        <p className="terminal-muted mt-3 text-xs leading-6">
          &gt; {description}
        </p>
      </div>

      {children}
    </section>
  );
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
        {label}
      </span>

      {children}
    </label>
  );
}

function AlignmentButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        selected
          ? "min-h-[48px] border border-[#39ff88] bg-[#0d0d0d] px-3 py-3 text-left text-xs text-[#39ff88]"
          : "min-h-[48px] border border-[#242424] bg-[#050505] px-3 py-3 text-left text-xs text-[#8a8a8a] transition hover:border-[#39ff88] hover:text-[#39ff88]"
      }
    >
      &gt; {label}
    </button>
  );
}

function SaveButton({
  onClick,
  disabled,
  pendingLabel,
  label,
}: {
  onClick: () => void;
  disabled: boolean;
  pendingLabel: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-1 min-h-[48px] w-full border border-[#39ff88] bg-[#050505] px-4 py-3 text-left text-sm text-[#39ff88] transition hover:bg-[#0d0d0d] disabled:cursor-not-allowed disabled:opacity-60"
    >
      &gt; {disabled ? pendingLabel : label}
    </button>
  );
}

function CollapsibleHistory({
  title,
  count,
  resetKey,
  children,
}: {
  title: string;
  count: number;
  resetKey: number;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [resetKey]);

  return (
    <details
      open={isOpen}
      onToggle={(event) =>
        setIsOpen(event.currentTarget.open)
      }
      className="mt-6 border border-[#242424] bg-[#050505]"
    >
      <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-xs uppercase tracking-[0.2em] text-[#39ff88] [&::-webkit-details-marker]:hidden">
        <span>
          {isOpen ? "−" : "+"} {title}
        </span>

        <span className="terminal-muted tracking-normal">
          {count}
        </span>
      </summary>

      <div className="border-t border-[#242424]">
        {children}
      </div>
    </details>
  );
}

function EditableDesireCard({
  entry,
  onUpdated,
  onDeleted,
  setMessage,
}: {
  entry: ReprogramDesire;
  onUpdated: (entry: ReprogramDesire) => void;
  onDeleted: (id: string) => void;
  setMessage: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const supabase = createClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [desire, setDesire] = useState(entry.desire);
  const [desireEmotions, setDesireEmotions] = useState(entry.desire_emotions);
  const [absenceEmotions, setAbsenceEmotions] = useState(entry.absence_emotions ?? "");
  const [satisfaction, setSatisfaction] = useState(String(entry.current_emotional_satisfaction));

  function cancelEdit() {
    setDesire(entry.desire);
    setDesireEmotions(entry.desire_emotions);
    setAbsenceEmotions(entry.absence_emotions ?? "");
    setSatisfaction(String(entry.current_emotional_satisfaction));
    setIsEditing(false);
  }

  async function saveChanges() {
    const parsed = Number(satisfaction);
    if (desire.trim().length < 2 || desireEmotions.trim().length < 2 || Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
      setMessage("Complete the desire fields before updating.");
      return;
    }
    setIsBusy(true);
    const { data, error } = await supabase
      .from("reprogram_desires")
      .update({
        desire: desire.trim(),
        desire_emotions: desireEmotions.trim(),
        absence_emotions: absenceEmotions.trim() || null,
        current_emotional_satisfaction: parsed,
      })
      .eq("id", entry.id)
      .select("id, desire, desire_emotions, absence_emotions, current_emotional_satisfaction, created_at, updated_at")
      .single();
    setIsBusy(false);
    if (error) {
      setMessage(`Desire update failed: ${error.message}`);
      return;
    }
    onUpdated(data as ReprogramDesire);
    setIsEditing(false);
    setMessage("desire_signal updated");
  }

  async function deleteEntry() {
    setIsBusy(true);
    const { error } = await supabase.from("reprogram_desires").delete().eq("id", entry.id);
    setIsBusy(false);
    if (error) {
      setMessage(`Desire delete failed: ${error.message}`);
      return;
    }
    onDeleted(entry.id);
    setMessage("desire_signal deleted");
  }

  return (
    <HistoryEntryCard title={entry.desire} date={entry.created_at} updatedAt={entry.updated_at}>
      {isEditing ? (
        <div className="grid gap-3 pt-3">
          <FieldLabel label="Desire"><textarea value={desire} onChange={(e) => setDesire(e.target.value)} className={textareaClass} /></FieldLabel>
          <FieldLabel label="Emotions related to the desire"><textarea value={desireEmotions} onChange={(e) => setDesireEmotions(e.target.value)} className={textareaClass} /></FieldLabel>
          <FieldLabel label="Emotions related to the desire not being present"><textarea value={absenceEmotions} onChange={(e) => setAbsenceEmotions(e.target.value)} className={textareaClass} /></FieldLabel>
          <FieldLabel label="Emotional satisfaction"><div className="mt-2 grid gap-3 md:grid-cols-[1fr_100px]"><input type="range" min="0" max="100" value={satisfaction} onChange={(e) => setSatisfaction(e.target.value)} className="w-full accent-[#39ff88]" /><div className="border border-[#242424] bg-[#050505] px-3 py-3 text-center text-sm text-[#39ff88]">{satisfaction}%</div></div></FieldLabel>
          <EditActions isBusy={isBusy} onSave={saveChanges} onCancel={cancelEdit} />
        </div>
      ) : (
        <>
          <HistoryField label="DESIRE EMOTIONS" value={entry.desire_emotions} />
          <HistoryField label="ABSENCE EMOTIONS" value={entry.absence_emotions || "No resistance recorded."} />
          <TerminalRow label="CURRENT EMOTIONAL SATISFACTION" value={`${entry.current_emotional_satisfaction}%`} green />
          <ManageActions isBusy={isBusy} confirmDelete={confirmDelete} onEdit={() => setIsEditing(true)} onDelete={() => confirmDelete ? deleteEntry() : setConfirmDelete(true)} onCancelDelete={() => setConfirmDelete(false)} />
        </>
      )}
    </HistoryEntryCard>
  );
}

function EditableEmotionCard({
  entry,
  onUpdated,
  onDeleted,
  setMessage,
}: {
  entry: ReprogramEmotionLog;
  onUpdated: (entry: ReprogramEmotionLog) => void;
  onDeleted: (id: string) => void;
  setMessage: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const supabase = createClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [trigger, setTrigger] = useState(entry.trigger);
  const [emotion, setEmotion] = useState(entry.emotion);
  const [alignment, setAlignment] = useState<AlignmentStatus>(entry.alignment_status);

  function cancelEdit() {
    setTrigger(entry.trigger);
    setEmotion(entry.emotion);
    setAlignment(entry.alignment_status);
    setIsEditing(false);
  }

  async function saveChanges() {
    if (trigger.trim().length < 2 || emotion.trim().length < 2) {
      setMessage("Complete the emotion fields before updating.");
      return;
    }
    setIsBusy(true);
    const { data, error } = await supabase
      .from("reprogram_emotion_logs")
      .update({ trigger: trigger.trim(), emotion: emotion.trim(), alignment_status: alignment })
      .eq("id", entry.id)
      .select("id, trigger, emotion, alignment_status, occurred_at, created_at, updated_at")
      .single();
    setIsBusy(false);
    if (error) {
      setMessage(`Emotion update failed: ${error.message}`);
      return;
    }
    onUpdated(data as ReprogramEmotionLog);
    setIsEditing(false);
    setMessage("emotion_signal updated");
  }

  async function deleteEntry() {
    setIsBusy(true);
    const { error } = await supabase.from("reprogram_emotion_logs").delete().eq("id", entry.id);
    setIsBusy(false);
    if (error) {
      setMessage(`Emotion delete failed: ${error.message}`);
      return;
    }
    onDeleted(entry.id);
    setMessage("emotion_signal deleted");
  }

  return (
    <HistoryEntryCard title={entry.trigger} date={entry.occurred_at} updatedAt={entry.updated_at}>
      {isEditing ? (
        <div className="grid gap-3 pt-3">
          <FieldLabel label="Thought / event trigger"><textarea value={trigger} onChange={(e) => setTrigger(e.target.value)} className={textareaClass} /></FieldLabel>
          <FieldLabel label="Emotion felt"><input value={emotion} onChange={(e) => setEmotion(e.target.value)} className={inputClass} /></FieldLabel>
          <FieldLabel label="Alignment"><div className="mt-2 grid grid-cols-2 gap-2"><AlignmentButton label="ALLOWING" selected={alignment === "allowing"} onClick={() => setAlignment("allowing")} /><AlignmentButton label="BLOCKING" selected={alignment === "blocking"} onClick={() => setAlignment("blocking")} /></div></FieldLabel>
          <EditActions isBusy={isBusy} onSave={saveChanges} onCancel={cancelEdit} />
        </div>
      ) : (
        <>
          <HistoryField label="EMOTION" value={entry.emotion} />
          <TerminalRow label="ALIGNMENT" value={entry.alignment_status.toUpperCase()} green={entry.alignment_status === "allowing"} />
          <ManageActions isBusy={isBusy} confirmDelete={confirmDelete} onEdit={() => setIsEditing(true)} onDelete={() => confirmDelete ? deleteEntry() : setConfirmDelete(true)} onCancelDelete={() => setConfirmDelete(false)} />
        </>
      )}
    </HistoryEntryCard>
  );
}

function EditableBeliefCard({
  entry,
  onUpdated,
  onDeleted,
  setMessage,
}: {
  entry: ReprogramBelief;
  onUpdated: (entry: ReprogramBelief) => void;
  onDeleted: (id: string) => void;
  setMessage: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const supabase = createClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [belief, setBelief] = useState(entry.faulty_belief);
  const [script, setScript] = useState(entry.reconstruction_script);
  const [intensity, setIntensity] = useState(String(entry.intensity_score));

  function cancelEdit() {
    setBelief(entry.faulty_belief);
    setScript(entry.reconstruction_script);
    setIntensity(String(entry.intensity_score));
    setIsEditing(false);
  }

  async function persistBelief(nextIntensity?: number) {
    const parsed = nextIntensity ?? Number(intensity);
    if (belief.trim().length < 2 || script.trim().length < 2 || Number.isNaN(parsed) || parsed < 0 || parsed > 10) {
      setMessage("Complete the belief fields before updating.");
      return;
    }
    const displaced = parsed === 0;
    setIsBusy(true);
    const { data, error } = await supabase
      .from("reprogram_beliefs")
      .update({
        faulty_belief: belief.trim(),
        reconstruction_script: script.trim(),
        intensity_score: parsed,
        is_displaced: displaced,
        displaced_at: displaced ? new Date().toISOString() : null,
      })
      .eq("id", entry.id)
      .select("id, faulty_belief, reconstruction_script, intensity_score, is_displaced, displaced_at, created_at, updated_at")
      .single();
    setIsBusy(false);
    if (error) {
      setMessage(`Belief update failed: ${error.message}`);
      return;
    }
    onUpdated(data as ReprogramBelief);
    setIntensity(String(parsed));
    setIsEditing(false);
    setMessage(displaced ? "belief_signal displaced" : "belief_signal updated");
  }

  async function deleteEntry() {
    setIsBusy(true);
    const { error } = await supabase.from("reprogram_beliefs").delete().eq("id", entry.id);
    setIsBusy(false);
    if (error) {
      setMessage(`Belief delete failed: ${error.message}`);
      return;
    }
    onDeleted(entry.id);
    setMessage("belief_signal deleted");
  }

  return (
    <HistoryEntryCard title={entry.faulty_belief} date={entry.created_at} updatedAt={entry.updated_at}>
      {isEditing ? (
        <div className="grid gap-3 pt-3">
          <FieldLabel label="Faulty belief"><textarea value={belief} onChange={(e) => setBelief(e.target.value)} className={textareaClass} /></FieldLabel>
          <FieldLabel label="Reconstruction script"><textarea value={script} onChange={(e) => setScript(e.target.value)} className="mt-2 min-h-[180px] w-full resize-y border border-[#242424] bg-[#050505] px-3 py-3 text-sm leading-6 text-[#e5e5e5] outline-none focus:border-[#39ff88]" /></FieldLabel>
          <FieldLabel label="Intensity score"><div className="mt-2 grid gap-3 md:grid-cols-[1fr_100px]"><input type="range" min="0" max="10" value={intensity} onChange={(e) => setIntensity(e.target.value)} className="w-full accent-[#39ff88]" /><div className="border border-[#242424] bg-[#050505] px-3 py-3 text-center text-sm text-[#39ff88]">{intensity}/10</div></div></FieldLabel>
          <EditActions isBusy={isBusy} onSave={() => persistBelief()} onCancel={cancelEdit} />
        </div>
      ) : (
        <>
          <HistoryField label="RECONSTRUCTION SCRIPT" value={entry.reconstruction_script} />
          <div className="mt-3 grid gap-2 border-t border-[#242424] pt-3 md:grid-cols-2"><TerminalRow label="INTENSITY" value={`${entry.intensity_score}/10`} green={entry.intensity_score <= 3} /><TerminalRow label="STATUS" value={entry.is_displaced ? "DISPLACED" : "ACTIVE"} green={entry.is_displaced} /></div>
          {!entry.is_displaced ? <button type="button" disabled={isBusy} onClick={() => persistBelief(0)} className="mt-3 min-h-[44px] w-full border border-[#39ff88] bg-[#050505] px-3 py-2 text-left text-xs text-[#39ff88] hover:bg-[#0d0d0d] disabled:opacity-60">&gt; mark belief displaced</button> : null}
          <ManageActions isBusy={isBusy} confirmDelete={confirmDelete} onEdit={() => setIsEditing(true)} onDelete={() => confirmDelete ? deleteEntry() : setConfirmDelete(true)} onCancelDelete={() => setConfirmDelete(false)} />
        </>
      )}
    </HistoryEntryCard>
  );
}

function EditActions({ isBusy, onSave, onCancel }: { isBusy: boolean; onSave: () => void; onCancel: () => void }) {
  return <div className="grid grid-cols-2 gap-2"><button type="button" disabled={isBusy} onClick={onSave} className="min-h-[44px] border border-[#39ff88] bg-[#050505] px-3 py-2 text-left text-xs text-[#39ff88] hover:bg-[#0d0d0d] disabled:opacity-60">&gt; {isBusy ? "saving..." : "save changes"}</button><button type="button" disabled={isBusy} onClick={onCancel} className="min-h-[44px] border border-[#242424] bg-[#050505] px-3 py-2 text-left text-xs text-[#8a8a8a] hover:border-[#e5e5e5] hover:text-[#e5e5e5] disabled:opacity-60">&gt; cancel</button></div>;
}

function ManageActions({ isBusy, confirmDelete, onEdit, onDelete, onCancelDelete }: { isBusy: boolean; confirmDelete: boolean; onEdit: () => void; onDelete: () => void; onCancelDelete: () => void }) {
  return <div className="mt-3 grid gap-2 border-t border-[#242424] pt-3 md:grid-cols-2"><button type="button" disabled={isBusy} onClick={onEdit} className="min-h-[42px] border border-[#242424] bg-[#050505] px-3 py-2 text-left text-xs text-[#e5e5e5] hover:border-[#39ff88] hover:text-[#39ff88] disabled:opacity-60">&gt; edit entry</button>{confirmDelete ? <div className="grid grid-cols-2 gap-2"><button type="button" disabled={isBusy} onClick={onDelete} className="min-h-[42px] border border-[#ff5d5d] bg-[#050505] px-3 py-2 text-left text-xs text-[#ff5d5d] disabled:opacity-60">&gt; confirm</button><button type="button" disabled={isBusy} onClick={onCancelDelete} className="min-h-[42px] border border-[#242424] bg-[#050505] px-3 py-2 text-left text-xs text-[#8a8a8a] disabled:opacity-60">&gt; cancel</button></div> : <button type="button" disabled={isBusy} onClick={onDelete} className="min-h-[42px] border border-[#242424] bg-[#050505] px-3 py-2 text-left text-xs text-[#8a8a8a] hover:border-[#ff5d5d] hover:text-[#ff5d5d] disabled:opacity-60">&gt; delete entry</button>}</div>;
}

function HistoryEntryCard({
  title,
  date,
  updatedAt,
  children,
}: {
  title: string;
  date: string;
  updatedAt?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="terminal-line text-xs">
      <summary className="grid min-h-[52px] cursor-pointer list-none gap-1 px-3 py-3 md:grid-cols-[1fr_auto] md:items-center md:gap-4 [&::-webkit-details-marker]:hidden">
        <span className="line-clamp-2 text-sm leading-5 text-[#e5e5e5]">
          {title}
        </span>

        <span className="terminal-muted whitespace-nowrap text-[11px] uppercase tracking-[0.12em]">
          {formatRelativeDate(date)}
          {updatedAt && updatedAt !== date ? (
            <span className="mt-1 block text-[10px] normal-case tracking-normal">
              Updated {formatRelativeDate(updatedAt)}
            </span>
          ) : null}
        </span>
      </summary>

      <div className="border-t border-[#242424] px-3 pb-3">
        {children}
      </div>
    </details>
  );
}

function formatRelativeDate(date: string) {
  const parsedDate = new Date(date);
  const now = new Date();

  const startOfDate = new Date(
    parsedDate.getFullYear(),
    parsedDate.getMonth(),
    parsedDate.getDate()
  );

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const dayDifference = Math.round(
    (startOfToday.getTime() -
      startOfDate.getTime()) /
      86_400_000
  );

  const time = parsedDate.toLocaleTimeString(
    [],
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );

  if (dayDifference === 0) {
    return `Today · ${time}`;
  }

  if (dayDifference === 1) {
    return `Yesterday · ${time}`;
  }

  if (dayDifference > 1 && dayDifference < 7) {
    return `${dayDifference} days ago · ${time}`;
  }

  return `${parsedDate.toLocaleDateString()} · ${time}`;
}

function HistoryField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="mt-3">
      <p className="terminal-green">
        {label}:
      </p>

      <p className="terminal-muted mt-1 whitespace-pre-wrap leading-6">
        {value}
      </p>
    </div>
  );
}

function EmptyHistory({
  text,
}: {
  text: string;
}) {
  return (
    <p className="terminal-muted p-3 text-xs">
      &gt; {text}
    </p>
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

const inputClass =
  "mt-2 w-full border border-[#242424] bg-[#050505] px-3 py-3 text-sm text-[#e5e5e5] outline-none focus:border-[#39ff88]";

const textareaClass =
  "mt-2 min-h-[110px] w-full resize-y border border-[#242424] bg-[#050505] px-3 py-3 text-sm leading-6 text-[#e5e5e5] outline-none focus:border-[#39ff88]";

const historyContainerClass =
  "max-h-[560px] overflow-y-auto";