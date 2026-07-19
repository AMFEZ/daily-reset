import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { logout } from "@/app/login/actions";
import { PWAController } from "@/components/pwa/PWAController";
import { SettingsRuntime } from "@/components/settings/SettingsRuntime";
import { SettingsHub } from "@/components/settings/SettingsHub";
import { SettingsAccountPanel, type UserSettings } from "@/components/settings/SettingsAccountPanel";
import { DataSafetyPanel } from "@/components/settings/DataSafetyPanel";
import { ReleaseReadinessPanel } from "@/components/settings/ReleaseReadinessPanel";
import { ProductionDeploymentPanel } from "@/components/settings/ProductionDeploymentPanel";
import { ReminderRuntime } from "@/components/reminders/ReminderRuntime";
import { ReminderSettingsPanel, type ReminderSetting } from "@/components/reminders/ReminderSettingsPanel";
import { AIReflectionPanel } from "@/components/reset/AIReflectionPanel";
import { BodyDataPanel } from "@/components/reset/BodyDataPanel";
import { DreamArchivePanel } from "@/components/reset/DreamArchivePanel";
import { ModuleAccordion } from "@/components/reset/ModuleAccordion";
import { NutritionPanel } from "@/components/reset/NutritionPanel";
import { ProtocolManagerPanel, type ManagedProtocol } from "@/components/reset/ProtocolManagerPanel";
import { ProtocolReliabilityPanel } from "@/components/reset/ProtocolReliabilityPanel";
import { ReflectionLogPanel } from "@/components/reset/ReflectionLogPanel";
import { ResetCalendarPanel } from "@/components/reset/ResetCalendarPanel";
import { ResetDashboard } from "@/components/reset/ResetDashboard";
import { ResetHistoryPanel } from "@/components/reset/ResetHistoryPanel";
import { ResetStreakPanel } from "@/components/reset/ResetStreakPanel";
import { RoutineTrendPanel } from "@/components/reset/RoutineTrendPanel";
import { ShadowConsolePanel } from "@/components/reset/ShadowConsolePanel";
import { SignalDisclosure } from "@/components/reset/SignalDisclosure";
import { WeeklyResetPanel } from "@/components/reset/WeeklyResetPanel";
import { calculateResetStreak } from "@/utils/reset-streak";
import { createClient } from "@/utils/supabase/server";

const APP_TIME_ZONE = "America/New_York";


export const metadata: Metadata = {
  title: "Daily Reset: The Reprogram",
  description:
    "A private daily protocol, reflection, and consistency system.",
  manifest: "/manifest.webmanifest",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
    noimageindex: true,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Daily Reset",
  },
  icons: {
    icon: [
      {
        url: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: legacyProfile } =
    await supabase
      .from("profiles")
      .select("protein_target")
      .maybeSingle();

  const { error: seedSettingsError } =
    await supabase.rpc(
      "seed_default_reset_settings",
      {
        target_user_id: user.id,
        target_protein_target:
          legacyProfile?.protein_target ??
          150,
      }
    );

  if (seedSettingsError) {
    throw new Error(seedSettingsError.message);
  }

  const {
    data: settingsRow,
    error: settingsRowError,
  } = await supabase
    .from("daily_reset_settings")
    .select(
      "protein_target, weight_unit, timezone, display_density, reduced_motion, updated_at"
    )
    .maybeSingle();

  if (settingsRowError) {
    throw new Error(settingsRowError.message);
  }

  const initialSettings: UserSettings = {
    protein_target: Number(
      settingsRow?.protein_target ?? 150
    ),
    weight_unit:
      settingsRow?.weight_unit === "kg"
        ? "kg"
        : "lbs",
    timezone:
      settingsRow?.timezone ??
      APP_TIME_ZONE,
    display_density:
      settingsRow?.display_density ===
      "compact"
        ? "compact"
        : "comfortable",
    reduced_motion: Boolean(
      settingsRow?.reduced_motion
    ),
    updated_at:
      settingsRow?.updated_at ?? null,
  };

  await supabase.rpc("seed_default_habits", {
    target_user_id: user.id,
  });

  const { error: seedRemindersError } =
    await supabase.rpc("seed_default_reminders", {
      target_user_id: user.id,
    });

  if (seedRemindersError) {
    throw new Error(seedRemindersError.message);
  }

  const today = getTodayKey(
    initialSettings.timezone
  );

  const { data: habits, error: habitsError } = await supabase
    .from("habits")
    .select(
      "id, name, category, section, routine_type, sort_order"
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (habitsError) {
    throw new Error(habitsError.message);
  }

  const {
    data: allHabitRows,
    error: allHabitRowsError,
  } = await supabase
    .from("habits")
    .select(
      "id, name, category, section, routine_type, sort_order, is_active"
    )
    .order("sort_order", { ascending: true });

  if (allHabitRowsError) {
    throw new Error(allHabitRowsError.message);
  }

  const visibleHabits = (
    habits ?? []
  ).filter(
    (habit) =>
      !isRetiredProtocol(habit.name)
  );

  const managedProtocols: ManagedProtocol[] = (
    allHabitRows ?? []
  )
    .filter(
      (habit) =>
        !isRetiredProtocol(habit.name)
    )
    .map((habit) => ({
    id: habit.id,
    name: habit.name,
    category: habit.category,
    section: habit.section,
    routine_type:
      habit.routine_type as ManagedProtocol["routine_type"],
    sort_order: Number(
      habit.sort_order ?? 0
    ),
    is_active: Boolean(habit.is_active),
  }));

  const { data: logs, error: logsError } = await supabase
    .from("habit_logs")
    .select("habit_id, completed, completion_status")
    .eq("date", today);

  if (logsError) {
    throw new Error(logsError.message);
  }

  const { data: weightLogs, error: weightLogsError } =
    await supabase
      .from("weight_logs")
      .select("id, date, weight, unit, note")
      .order("date", { ascending: false })
      .limit(30);

  if (weightLogsError) {
    throw new Error(weightLogsError.message);
  }

  const { data: proteinLogs, error: proteinLogsError } =
    await supabase
      .from("protein_logs")
      .select(
        "id, date, amount, meal_type, note, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(50);

  if (proteinLogsError) {
    throw new Error(proteinLogsError.message);
  }

  const { data: resetScores, error: resetScoresError } =
    await supabase
      .from("daily_reset_scores")
      .select(`
        id,
        date,
        morning_score,
        daily_score,
        night_score,
        trust_score,
        reset_score,
        completed_protocols,
        total_protocols,
        system_status,
        consistency_signal,
        is_locked,
        locked_at,
        created_at
      `)
      .order("date", { ascending: false })
      .limit(30);

  if (resetScoresError) {
    throw new Error(resetScoresError.message);
  }

  const { data: resetScoreDates, error: resetScoreDatesError } =
    await supabase
      .from("daily_reset_scores")
      .select("date")
      .order("date", { ascending: true });

  if (resetScoreDatesError) {
    throw new Error(resetScoreDatesError.message);
  }

  const streakStats = calculateResetStreak(
    (resetScoreDates ?? []).map((score) => score.date)
  );

  const {
    data: reminderRows,
    error: reminderRowsError,
  } = await supabase
    .from("daily_reset_reminders")
    .select(
      "id, reminder_key, label, time_local, enabled, timezone, sort_order, updated_at"
    )
    .order("sort_order", { ascending: true });

  if (reminderRowsError) {
    throw new Error(reminderRowsError.message);
  }

  const initialReminders: ReminderSetting[] = (
    reminderRows ?? []
  ).map((reminder) => ({
    id: reminder.id,
    reminder_key:
      reminder.reminder_key as ReminderSetting["reminder_key"],
    label: reminder.label,
    time_local: String(
      reminder.time_local ?? "00:00"
    ).slice(0, 5),
    enabled: Boolean(reminder.enabled),
    timezone:
      reminder.timezone ?? APP_TIME_ZONE,
    sort_order: Number(
      reminder.sort_order ?? 0
    ),
    updated_at: reminder.updated_at,
  }));

  const {
    data: journalEntries,
    error: journalEntriesError,
  } = await supabase
    .from("journal_entries")
    .select(
      "id, entry_type, title, content, mood, energy, tags, audio_path, raw_transcript, cleaned_transcript, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(25);

  if (journalEntriesError) {
    throw new Error(journalEntriesError.message);
  }

  const shadowEntries = (journalEntries ?? []).filter(
    (entry) => entry.entry_type === "shadow"
  );

  const dreamEntries = (journalEntries ?? []).filter(
    (entry) => entry.entry_type === "dream"
  );

  const {
    data: aiReflections,
    error: aiReflectionsError,
  } = await supabase
    .from("ai_reflections")
    .select(
      "id, journal_entry_id, reflection_type, summary, emotional_themes, pattern_noticed, jungian_lens, freudian_lens, neuroscience_lens, compassionate_reframe, questions, action_step, interpretation_note, model, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(25);

  if (aiReflectionsError) {
    throw new Error(aiReflectionsError.message);
  }

  const dreamInterpretations = (
    aiReflections ?? []
  ).filter(
    (reflection) => reflection.reflection_type === "dream"
  );

  const totalProtocols =
    visibleHabits.length;

  const todayReset =
    (resetScores ?? []).find(
      (score) => score.date === today
    ) ?? null;

  return (
    <main className="min-h-screen bg-black px-0 py-0 text-sm text-[#e5e5e5] sm:px-3 sm:py-4 md:px-8 md:py-8">
      <section className="mx-auto max-w-7xl">
        <div className="terminal-window min-h-screen overflow-hidden rounded-none sm:min-h-0 sm:rounded-lg">
          <div className="terminal-titlebar sticky top-0 z-40 flex min-h-[52px] items-center justify-between px-3 py-2 sm:px-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#ff4d4d]" />
              <span className="h-3 w-3 rounded-full bg-[#ffb020]" />
              <span className="h-3 w-3 rounded-full bg-[#39ff88]" />
            </div>

            <p className="terminal-muted hidden text-xs sm:block">
              daily-reset://the-reprogram
            </p>

            <p className="terminal-muted text-[10px] uppercase tracking-[0.12em] sm:hidden">
              daily.reset
            </p>

            <form action={logout}>
              <button type="submit" className="terminal-dim min-h-[44px] px-2 text-xs transition hover:text-[#39ff88]">
                logout
              </button>
            </form>
          </div>

          <PWAController />
          <SettingsRuntime
            initialSettings={initialSettings}
          />
          <ReminderRuntime
            initialReminders={initialReminders}
          />

          <div className="space-y-3 sm:space-y-4">
            <ResetDashboard
              userEmail={user.email ?? "ONLINE"}
              habits={visibleHabits}
              logs={logs ?? []}
              totalProtocols={totalProtocols}
              initialHasResetRecord={Boolean(todayReset)}
              initialIsLocked={Boolean(
                todayReset?.is_locked
              )}
              initialLockedAt={
                todayReset?.locked_at ?? null
              }
              timeZone={
                initialSettings.timezone
              }
            >
              <div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <ModuleAccordion
                  id="body-data"
                  title="body.data"
                  subtitle="Daily weight tracking and trend signals"
                >
                  <BodyDataPanel
                    timeZone={
                      initialSettings.timezone
                    }
                    initialLogs={(weightLogs ?? []).map(
                      (log) => ({
                        id: log.id,
                        date: log.date,
                        weight: Number(log.weight),
                        unit: log.unit as "lbs" | "kg",
                        note: log.note,
                      })
                    )}
                  />
                </ModuleAccordion>

                <ModuleAccordion
                  id="nutrition-input"
                  title="nutrition.input"
                  subtitle="Protein tracker and nutrition signals"
                >
                  <NutritionPanel
                    initialLogs={(proteinLogs ?? []).map(
                      (log) => ({
                        id: log.id,
                        date: log.date,
                        amount: Number(log.amount),
                        meal_type: log.meal_type as
                          | "breakfast"
                          | "lunch"
                          | "dinner"
                          | "snack"
                          | "custom",
                        note: log.note,
                        created_at: log.created_at,
                      })
                    )}
                    proteinTarget={
                      initialSettings.protein_target
                    }
                  />
                </ModuleAccordion>

                <ModuleAccordion
                  id="reflection-log"
                  title="reflection.log"
                  subtitle="Written, recorded, and transcribed reflection"
                >
                  <ReflectionLogPanel
                    initialEntries={(journalEntries ?? [])
                      .filter(
                        (entry) =>
                          entry.entry_type ===
                            "reflection" ||
                          entry.entry_type ===
                            "freewrite"
                      )
                      .map((entry) => ({
                        id: entry.id,
                        entry_type:
                          entry.entry_type as
                            | "reflection"
                            | "freewrite",
                        title: entry.title,
                        content: entry.content,
                        mood: entry.mood,
                        energy: entry.energy,
                        tags: entry.tags,
                        audio_path:
                          entry.audio_path,
                        raw_transcript:
                          entry.raw_transcript,
                        cleaned_transcript:
                          entry.cleaned_transcript,
                        created_at:
                          entry.created_at,
                      }))}
                  />
                </ModuleAccordion>

                <ModuleAccordion
                  id="shadow-console"
                  title="shadow.console"
                  subtitle="One deep prompt with writing, voice, and transcript"
                >
                  <ShadowConsolePanel
                    initialEntries={shadowEntries.map(
                      (entry) => ({
                        id: entry.id,
                        entry_type: "shadow",
                        title: entry.title,
                        content: entry.content,
                        mood: entry.mood,
                        energy: entry.energy,
                        tags: entry.tags,
                        audio_path:
                          entry.audio_path,
                        raw_transcript:
                          entry.raw_transcript,
                        cleaned_transcript:
                          entry.cleaned_transcript,
                        created_at:
                          entry.created_at,
                      })
                    )}
                  />
                </ModuleAccordion>

                <ModuleAccordion
                  id="dream-archive"
                  title="dream.archive"
                  subtitle="Dream journal and symbol capture"
                >
                  <DreamArchivePanel
                    initialEntries={dreamEntries.map(
                      (entry) => ({
                        id: entry.id,
                        entry_type: "dream",
                        title: entry.title,
                        content: entry.content,
                        mood: entry.mood,
                        energy: entry.energy,
                        tags: entry.tags,
                        audio_path: entry.audio_path,
                        raw_transcript:
                          entry.raw_transcript,
                        cleaned_transcript:
                          entry.cleaned_transcript,
                        created_at: entry.created_at,
                      })
                    )}
                    initialInterpretations={dreamInterpretations.map(
                      (interpretation) => ({
                        id: interpretation.id,
                        journal_entry_id:
                          interpretation.journal_entry_id,
                        reflection_type: "dream",
                        summary: interpretation.summary,
                        emotional_themes:
                          interpretation.emotional_themes,
                        pattern_noticed:
                          interpretation.pattern_noticed,
                        jungian_lens:
                          interpretation.jungian_lens,
                        freudian_lens:
                          interpretation.freudian_lens,
                        neuroscience_lens:
                          interpretation.neuroscience_lens,
                        compassionate_reframe:
                          interpretation.compassionate_reframe,
                        questions:
                          interpretation.questions,
                        action_step:
                          interpretation.action_step,
                        interpretation_note:
                          interpretation.interpretation_note,
                        model: interpretation.model,
                        created_at:
                          interpretation.created_at,
                      })
                    )}
                  />
                </ModuleAccordion>

                <ModuleAccordion
                  id="ai-reflection"
                  title="ai.reflection.workspace"
                  subtitle="Guided pattern review and grounded actions"
                >
                  <AIReflectionPanel
                    entries={(journalEntries ?? []).map(
                      (entry) => ({
                        id: entry.id,
                        entry_type:
                          entry.entry_type as
                            | "reflection"
                            | "gratitude"
                            | "recall"
                            | "shadow"
                            | "dream"
                            | "freewrite",
                        title: entry.title,
                        content: entry.content,
                        mood: entry.mood,
                        energy: entry.energy,
                        tags: entry.tags,
                        created_at: entry.created_at,
                      })
                    )}
                    initialReflections={(
                      aiReflections ?? []
                    ).map((reflection) => ({
                      id: reflection.id,
                      journal_entry_id:
                        reflection.journal_entry_id,
                      reflection_type:
                        reflection.reflection_type as
                          | "journal"
                          | "shadow"
                          | "dream"
                          | "daily_review",
                      summary: reflection.summary,
                      pattern_noticed:
                        reflection.pattern_noticed,
                      compassionate_reframe:
                        reflection.compassionate_reframe,
                      questions: reflection.questions,
                      action_step:
                        reflection.action_step,
                      model: reflection.model,
                      created_at:
                        reflection.created_at,
                    }))}
                  />
                </ModuleAccordion>

              </div>

              <SettingsHub>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <ModuleAccordion
                    id="reminder-center"
                    title="reminder.center"
                    subtitle="Cloud-synced routine notification schedule"
                  >
                    <ReminderSettingsPanel
                      initialReminders={
                        initialReminders
                      }
                    />
                  </ModuleAccordion>

                  <ModuleAccordion
                    id="protocol-manager"
                    title="protocol.manager"
                    subtitle="Create, edit, reorder, disable, and restore protocols"
                  >
                    <ProtocolManagerPanel
                      initialProtocols={
                        managedProtocols
                      }
                    />
                  </ModuleAccordion>

                  <ModuleAccordion
                    id="settings-account"
                    title="settings.account"
                    subtitle="Preferences, timezone, display, and password"
                  >
                    <SettingsAccountPanel
                      userEmail={
                        user.email ?? "ONLINE"
                      }
                      initialSettings={
                        initialSettings
                      }
                    />
                  </ModuleAccordion>

                  <ModuleAccordion
                    id="data-safety"
                    title="data.safety"
                    subtitle="Authenticated backup, inventory, and checksum"
                  >
                    <DataSafetyPanel />
                  </ModuleAccordion>

                  <ModuleAccordion
                    id="release-readiness"
                    title="release.readiness"
                    subtitle="Automated health checks and V1 deployment audit"
                  >
                    <ReleaseReadinessPanel />
                  </ModuleAccordion>

                  <ModuleAccordion
                    id="deployment-control"
                    title="deployment.control"
                    subtitle="Version, environment, PWA, and production status"
                  >
                    <ProductionDeploymentPanel />
                  </ModuleAccordion>
                </div>

                <div className="mt-3">
                  <ModuleAccordion
                    id="reset-analytics"
                    title="reset.analytics"
                    subtitle={`${streakStats.currentStreak}-day current streak · ${streakStats.bestStreak}-day best · ${streakStats.savedLast7}/7 saved recently`}
                  >
                    <div className="space-y-3">
                      <SignalDisclosure
                        title="reset.streak"
                        summary="Current and best consistency streaks"
                      >
                        <ResetStreakPanel
                          stats={streakStats}
                        />
                      </SignalDisclosure>

                      <SignalDisclosure
                        title="weekly.reset.report"
                        summary="Seven-day system review"
                      >
                        <WeeklyResetPanel />
                      </SignalDisclosure>

                      <SignalDisclosure
                        title="reset.calendar"
                        summary="Saved-day calendar and score signals"
                      >
                        <ResetCalendarPanel />
                      </SignalDisclosure>

                      <SignalDisclosure
                        title="routine.trend.analyzer"
                        summary="Thirty-day routine movement"
                      >
                        <RoutineTrendPanel />
                      </SignalDisclosure>

                      <SignalDisclosure
                        title="protocol.reliability"
                        summary="Protocol completion reliability"
                      >
                        <ProtocolReliabilityPanel />
                      </SignalDisclosure>

                      <SignalDisclosure
                        title="reset.history"
                        summary="Saved reset score history"
                        count={(resetScores ?? []).length}
                      >
                        <ResetHistoryPanel
                          initialScores={(
                            resetScores ?? []
                          ).map((score) => ({
                            id: score.id,
                            date: score.date,
                            morning_score: Number(
                              score.morning_score ?? 0
                            ),
                            daily_score: Number(
                              score.daily_score ?? 0
                            ),
                            night_score: Number(
                              score.night_score ?? 0
                            ),
                            trust_score: Number(
                              score.trust_score ?? 0
                            ),
                            reset_score: Number(
                              score.reset_score ?? 0
                            ),
                            completed_protocols: Number(
                              score.completed_protocols ?? 0
                            ),
                            total_protocols: Number(
                              score.total_protocols ?? 0
                            ),
                            system_status:
                              score.system_status ??
                              "NO STATUS",
                            consistency_signal:
                              score.consistency_signal ??
                              "NO SIGNAL",
                            is_locked: Boolean(
                              score.is_locked
                            ),
                            locked_at:
                              score.locked_at ?? null,
                            created_at:
                              score.created_at,
                          }))}
                        />
                      </SignalDisclosure>
                    </div>
                  </ModuleAccordion>
                </div>
              </SettingsHub>

            </div>
            </ResetDashboard>
          </div>
        </div>
      </section>
    </main>
  );
}



const RETIRED_PROTOCOL_NAMES =
  new Set([
    "uptown tonics shot",
    "night stretches",
    "leg stretches",
    "tmj exercises",
    "tmj excercises",
    "foam roller",
  ]);

function isRetiredProtocol(
  name: string
) {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  return RETIRED_PROTOCOL_NAMES.has(
    normalized
  );
}

function getTodayKey(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}
