import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
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
import {
  ReprogramJournalPanel,
  type ReprogramBelief,
  type ReprogramDesire,
  type ReprogramEmotionLog,
} from "@/components/reset/ReprogramJournalPanel";
import { ResetCalendarPanel } from "@/components/reset/ResetCalendarPanel";
import { ResetDashboard } from "@/components/reset/ResetDashboard";
import { ResetHistoryPanel } from "@/components/reset/ResetHistoryPanel";
import { ResetStreakPanel } from "@/components/reset/ResetStreakPanel";
import { RoutineTrendPanel } from "@/components/reset/RoutineTrendPanel";
import { ShadowConsolePanel } from "@/components/reset/ShadowConsolePanel";
import { SignalDisclosure } from "@/components/reset/SignalDisclosure";
import { WeeklyResetPanel } from "@/components/reset/WeeklyResetPanel";
import { BootWarningPanel } from "@/components/system/BootWarningPanel";
import { DayRolloverController } from "@/components/system/DayRolloverController";
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

const BOOT_QUERY_TIMEOUT_MS = 8_000;
const SEED_QUERY_TIMEOUT_MS = 5_000;

type DashboardRoutineType =
  | "morning"
  | "daily"
  | "night"
  | "trust_based";

type DashboardCompletionStatus =
  | "complete"
  | "mostly"
  | "skipped"
  | "pending";

function normalizeRoutineType(
  value: string | null
): DashboardRoutineType {
  switch (value) {
    case "morning":
    case "daily":
    case "night":
    case "trust_based":
      return value;
    default:
      return "daily";
  }
}

function normalizeCompletionStatus(
  value: string | null
): DashboardCompletionStatus {
  switch (value) {
    case "complete":
    case "mostly":
    case "skipped":
    case "pending":
      return value;
    default:
      return "pending";
  }
}
async function withBootTimeout<T>(
  label: string,
  operation: PromiseLike<T>,
  timeoutMs = BOOT_QUERY_TIMEOUT_MS
): Promise<T> {
  let timeout:
    | ReturnType<typeof setTimeout>
    | null = null;

  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(
            new Error(
              `${label} timed out after ${
                timeoutMs / 1_000
              } seconds.`
            )
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function logSeedResult(
  label: string,
  result: PromiseSettledResult<{
    error: {
      message: string;
    } | null;
  }>
) {
  if (result.status === "rejected") {
    console.error(
      `${label} failed:`,
      result.reason
    );
    return;
  }

  if (result.value.error) {
    console.error(
      `${label} failed:`,
      result.value.error.message
    );
  }
}

type OptionalBootPayload<T> = {
  data: T | null;
  error: {
    message: string;
  } | null;
};

function readOptionalBootResult<T>(
  label: string,
  result: PromiseSettledResult<
    OptionalBootPayload<T>
  >,
  warnings: string[]
): T | null {
  if (result.status === "rejected") {
    const message =
      result.reason instanceof Error
        ? result.reason.message
        : String(result.reason);

    warnings.push(
      `${label}: ${message}`
    );
    console.error(
      `${label} failed:`,
      result.reason
    );
    return null;
  }

  if (result.value.error) {
    warnings.push(
      `${label}: ${
        result.value.error.message
      }`
    );
    console.error(
      `${label} failed:`,
      result.value.error.message
    );
    return null;
  }

  return result.value.data;
}

export default async function Home() {
  const supabase = await createClient();

  const requestHeaders = await headers();
  const verifiedUserId =
    requestHeaders.get(
      "x-daily-reset-user-id"
    );
  const verifiedUserEmail =
    requestHeaders.get(
      "x-daily-reset-user-email"
    );

  if (!verifiedUserId) {
    redirect("/login");
  }

  const user = {
    id: verifiedUserId,
    email: verifiedUserEmail,
  };

  let legacyProteinTarget = 150;

  try {
    const {
      data: legacyProfile,
      error: legacyProfileError,
    } = await withBootTimeout(
      "Legacy profile",
      supabase
        .from("profiles")
        .select("protein_target")
        .maybeSingle(),
      4_000
    );

    if (legacyProfileError) {
      console.error(
        "Legacy profile lookup failed:",
        legacyProfileError.message
      );
    } else {
      legacyProteinTarget = Number(
        legacyProfile?.protein_target ??
          150
      );
    }
  } catch (error) {
    console.error(
      "Legacy profile lookup failed:",
      error
    );
  }

  const seedResults =
    await Promise.allSettled([
      withBootTimeout(
        "Default settings seed",
        supabase.rpc(
          "seed_default_reset_settings",
          {
            target_user_id: user.id,
            target_protein_target:
              legacyProteinTarget,
          }
        ),
        SEED_QUERY_TIMEOUT_MS
      ),
      withBootTimeout(
        "Default habits seed",
        supabase.rpc(
          "seed_default_habits",
          {
            target_user_id: user.id,
          }
        ),
        SEED_QUERY_TIMEOUT_MS
      ),
      withBootTimeout(
        "Default reminders seed",
        supabase.rpc(
          "seed_default_reminders",
          {
            target_user_id: user.id,
          }
        ),
        SEED_QUERY_TIMEOUT_MS
      ),
    ]);

  logSeedResult(
    "Default settings seed",
    seedResults[0]
  );
  logSeedResult(
    "Default habits seed",
    seedResults[1]
  );
  logSeedResult(
    "Default reminders seed",
    seedResults[2]
  );

  const {
    data: settingsRow,
    error: settingsRowError,
  } = await withBootTimeout(
    "Daily Reset settings",
    supabase
      .from("daily_reset_settings")
      .select(
        "protein_target, weight_unit, timezone, display_density, reduced_motion, updated_at"
      )
      .maybeSingle()
  );

  if (settingsRowError) {
    throw new Error(
      `Settings failed: ${settingsRowError.message}`
    );
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

  const today = getTodayKey(
    initialSettings.timezone
  );

  const [
    habitsResult,
    logsResult,
  ] = await Promise.all([
    withBootTimeout(
      "Active protocols",
      supabase
        .from("habits")
        .select(
          "id, name, category, section, routine_type, sort_order"
        )
        .eq("is_active", true)
        .order("sort_order", {
          ascending: true,
        })
    ),
    withBootTimeout(
      "Today's protocol logs",
      supabase
        .from("habit_logs")
        .select(
          "habit_id, completed, completion_status"
        )
        .eq("date", today)
    ),
  ]);

  const criticalBootErrors = [
    [
      "Active protocols",
      habitsResult.error,
    ],
    [
      "Today's protocol logs",
      logsResult.error,
    ],
  ] as const;

  const firstCriticalBootError =
    criticalBootErrors.find(
      ([, error]) => Boolean(error)
    );

  if (firstCriticalBootError) {
    const [label, error] =
      firstCriticalBootError;

    throw new Error(
      `${label} failed: ${
        error?.message ??
        "Unknown database error."
      }`
    );
  }

  const [
    allHabitsSettled,
    weightLogsSettled,
    proteinLogsSettled,
    resetScoresSettled,
    resetScoreDatesSettled,
    remindersSettled,
    journalEntriesSettled,
    reprogramDesiresSettled,
    reprogramEmotionLogsSettled,
    reprogramBeliefsSettled,
    aiReflectionsSettled,
  ] = await Promise.allSettled([
    withBootTimeout(
      "Protocol manager",
      supabase
        .from("habits")
        .select(
          "id, name, category, section, routine_type, sort_order, is_active"
        )
        .order("sort_order", {
          ascending: true,
        })
    ),
    withBootTimeout(
      "Weight history",
      supabase
        .from("weight_logs")
        .select(
          "id, date, weight, unit, note"
        )
        .order("date", {
          ascending: false,
        })
        .limit(30)
    ),
    withBootTimeout(
      "Protein history",
      supabase
        .from("protein_logs")
        .select(
          "id, date, amount, meal_type, note, created_at"
        )
        .order("created_at", {
          ascending: false,
        })
        .limit(50)
    ),
    withBootTimeout(
      "Reset score history",
      supabase
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
        .order("date", {
          ascending: false,
        })
        .limit(30)
    ),
    withBootTimeout(
      "Reset streak dates",
      supabase
        .from("daily_reset_scores")
        .select("date")
        .order("date", {
          ascending: true,
        })
        .limit(1_500)
    ),
    withBootTimeout(
      "Reminder settings",
      supabase
        .from("daily_reset_reminders")
        .select(
          "id, reminder_key, label, time_local, enabled, timezone, sort_order, updated_at"
        )
        .order("sort_order", {
          ascending: true,
        })
    ),
    withBootTimeout(
      "Journal archive",
      supabase
        .from("journal_entries")
        .select(
          "id, entry_type, title, content, mood, energy, tags, audio_path, raw_transcript, cleaned_transcript, created_at"
        )
        .order("created_at", {
          ascending: false,
        })
        .limit(25)
    ),
    withBootTimeout(
      "Reprogram desires",
      supabase
        .from("reprogram_desires")
        .select(
          "id, desire, desire_emotions, absence_emotions, current_emotional_satisfaction, created_at, updated_at"
        )
        .order("created_at", {
          ascending: false,
        })
        .limit(100)
    ),
    withBootTimeout(
      "Reprogram emotion logs",
      supabase
        .from("reprogram_emotion_logs")
        .select(
          "id, trigger, emotion, alignment_status, occurred_at, created_at, updated_at"
        )
        .order("occurred_at", {
          ascending: false,
        })
        .limit(100)
    ),
    withBootTimeout(
      "Reprogram beliefs",
      supabase
        .from("reprogram_beliefs")
        .select(
          "id, faulty_belief, reconstruction_script, intensity_score, is_displaced, displaced_at, created_at, updated_at"
        )
        .order("created_at", {
          ascending: false,
        })
        .limit(100)
    ),
    withBootTimeout(
      "AI reflection history",
      supabase
        .from("ai_reflections")
        .select(
          "id, journal_entry_id, reflection_type, summary, emotional_themes, pattern_noticed, jungian_lens, freudian_lens, neuroscience_lens, compassionate_reframe, questions, action_step, interpretation_note, model, created_at"
        )
        .order("created_at", {
          ascending: false,
        })
        .limit(25)
    ),
  ] as const);

  const bootWarnings: string[] = [];

  const habits =
    habitsResult.data ?? [];
  const logs =
    logsResult.data ?? [];

  const allHabitRows =
    readOptionalBootResult(
      "Protocol manager",
      allHabitsSettled,
      bootWarnings
    ) ?? [];

  const weightLogs =
    readOptionalBootResult(
      "Weight history",
      weightLogsSettled,
      bootWarnings
    ) ?? [];

  const proteinLogs =
    readOptionalBootResult(
      "Protein history",
      proteinLogsSettled,
      bootWarnings
    ) ?? [];

  const resetScores =
    readOptionalBootResult(
      "Reset score history",
      resetScoresSettled,
      bootWarnings
    ) ?? [];

  const resetScoreDates =
    readOptionalBootResult(
      "Reset streak dates",
      resetScoreDatesSettled,
      bootWarnings
    ) ?? [];

  const reminderRows =
    readOptionalBootResult(
      "Reminder settings",
      remindersSettled,
      bootWarnings
    ) ?? [];

  const journalEntries =
    readOptionalBootResult(
      "Journal archive",
      journalEntriesSettled,
      bootWarnings
    ) ?? [];

  const reprogramDesires =
    readOptionalBootResult(
      "Reprogram desires",
      reprogramDesiresSettled,
      bootWarnings
    ) ?? [];

  const reprogramEmotionLogs =
    readOptionalBootResult(
      "Reprogram emotion logs",
      reprogramEmotionLogsSettled,
      bootWarnings
    ) ?? [];

  const reprogramBeliefs =
    readOptionalBootResult(
      "Reprogram beliefs",
      reprogramBeliefsSettled,
      bootWarnings
    ) ?? [];

  const aiReflections =
    readOptionalBootResult(
      "AI reflection history",
      aiReflectionsSettled,
      bootWarnings
    ) ?? [];

  const visibleHabits = habits
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
        normalizeRoutineType(
          habit.routine_type
        ),
      sort_order: Number(
        habit.sort_order ?? 0
      ),
    }));

  const normalizedLogs = logs.map(
    (log) => ({
      habit_id: log.habit_id,
      completed: Boolean(
        log.completed
      ),
      completion_status:
        normalizeCompletionStatus(
          log.completion_status
        ),
    })
  );

  const managedProtocols: ManagedProtocol[] =
    allHabitRows
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
        is_active: Boolean(
          habit.is_active
        ),
      }));

  const streakStats =
    calculateResetStreak(
      resetScoreDates.map(
        (score) => score.date
      )
    );

  const initialReminders: ReminderSetting[] =
    reminderRows.map((reminder) => ({
      id: reminder.id,
      reminder_key:
        reminder.reminder_key as ReminderSetting["reminder_key"],
      label: reminder.label,
      time_local: String(
        reminder.time_local ?? "00:00"
      ).slice(0, 5),
      enabled: Boolean(
        reminder.enabled
      ),
      timezone:
        reminder.timezone ??
        APP_TIME_ZONE,
      sort_order: Number(
        reminder.sort_order ?? 0
      ),
      updated_at:
        reminder.updated_at,
    }));

  const shadowEntries =
    journalEntries.filter(
      (entry) =>
        entry.entry_type ===
        "shadow"
    );

  const dreamEntries =
    journalEntries.filter(
      (entry) =>
        entry.entry_type ===
        "dream"
    );

  const dreamInterpretations =
    aiReflections.filter(
      (reflection) =>
        reflection.reflection_type ===
        "dream"
    );

  const totalProtocols =
    visibleHabits.length;

  const todayReset =
    resetScores.find(
      (score) =>
        score.date === today
    ) ?? null;

  const todayProtein =
    proteinLogs
      .filter(
        (log) => log.date === today
      )
      .reduce(
        (sum, log) =>
          sum +
          Number(log.amount ?? 0),
        0
      );

  const latestWeight =
    weightLogs[0] ?? null;

  const activeGoalCount =
    reprogramDesires.length;

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
          <DayRolloverController
            serverDayKey={today}
            timeZone={initialSettings.timezone}
          />
          <SettingsRuntime
            initialSettings={initialSettings}
          />
          <ReminderRuntime
            initialReminders={initialReminders}
          />

          <div className="space-y-3 sm:space-y-4">
            <BootWarningPanel
              warnings={bootWarnings}
            />

            <ResetDashboard
              key={today}
              userEmail={user.email ?? "ONLINE"}
              habits={visibleHabits}
              logs={normalizedLogs}
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
              currentStreak={
                streakStats.currentStreak
              }
              todayProtein={
                todayProtein
              }
              proteinTarget={
                initialSettings.protein_target
              }
              latestWeight={
                latestWeight
                  ? Number(
                      latestWeight.weight
                    )
                  : null
              }
              weightUnit={
                latestWeight?.unit === "kg"
                  ? "kg"
                  : initialSettings.weight_unit
              }
              activeGoalCount={
                activeGoalCount
              }
            >
              <div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <ModuleAccordion
                  id="body-data"
                  title="Body Data"
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
                  title="Nutrition"
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
                  id="reprogram-journal"
                  title="Reprogram Journal"
                >
                  <ReprogramJournalPanel
                    userId={user.id}
                    initialDesires={(
                      reprogramDesires ?? []
                    ).map(
                      (entry): ReprogramDesire => ({
                        id: entry.id,
                        desire: entry.desire,
                        desire_emotions:
                          entry.desire_emotions,
                        absence_emotions:
                          entry.absence_emotions,
                        current_emotional_satisfaction:
                          Number(
                            entry.current_emotional_satisfaction ??
                              0
                          ),
                        created_at:
                          entry.created_at,
                        updated_at:
                          entry.updated_at,
                      })
                    )}
                    initialEmotionLogs={(
                      reprogramEmotionLogs ?? []
                    ).map(
                      (
                        entry
                      ): ReprogramEmotionLog => ({
                        id: entry.id,
                        trigger: entry.trigger,
                        emotion: entry.emotion,
                        alignment_status:
                          entry.alignment_status ===
                          "allowing"
                            ? "allowing"
                            : "blocking",
                        occurred_at:
                          entry.occurred_at,
                        created_at:
                          entry.created_at,
                        updated_at:
                          entry.updated_at,
                      })
                    )}
                    initialBeliefs={(
                      reprogramBeliefs ?? []
                    ).map(
                      (entry): ReprogramBelief => ({
                        id: entry.id,
                        faulty_belief:
                          entry.faulty_belief,
                        reconstruction_script:
                          entry.reconstruction_script,
                        intensity_score: Number(
                          entry.intensity_score ?? 0
                        ),
                        is_displaced: Boolean(
                          entry.is_displaced
                        ),
                        displaced_at:
                          entry.displaced_at,
                        created_at:
                          entry.created_at,
                        updated_at:
                          entry.updated_at,
                      })
                    )}
                  />
                </ModuleAccordion>

                <ModuleAccordion
                  id="shadow-console"
                  title="Shadow Work"
                >
                  <ShadowConsolePanel
                    initialEntries={shadowEntries.map(
                      (entry) => ({
                        id: entry.id,
                        entry_type: "shadow",
                        title: entry.title,
                        content:
                          entry.content ?? "",
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
                  title="Dream Archive"
                >
                  <DreamArchivePanel
                    initialEntries={dreamEntries.map(
                      (entry) => ({
                        id: entry.id,
                        entry_type: "dream",
                        title: entry.title,
                        content:
                          entry.content ?? "",
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
                          interpretation.journal_entry_id ??
                          "",
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
                  title="AI Reflection"
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
                        content:
                          entry.content ?? "",
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
                        reflection.journal_entry_id ??
                        "",
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
                    title="Reminders"
                  >
                    <ReminderSettingsPanel
                      initialReminders={
                        initialReminders
                      }
                    />
                  </ModuleAccordion>

                  <ModuleAccordion
                    id="protocol-manager"
                    title="Protocol Manager"
                  >
                    <ProtocolManagerPanel
                      initialProtocols={
                        managedProtocols
                      }
                    />
                  </ModuleAccordion>

                  <ModuleAccordion
                    id="settings-account"
                    title="Settings & Account"
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
                    title="Data Safety"
                  >
                    <DataSafetyPanel />
                  </ModuleAccordion>

                  <ModuleAccordion
                    id="release-readiness"
                    title="Release Readiness"
                  >
                    <ReleaseReadinessPanel />
                  </ModuleAccordion>

                  <ModuleAccordion
                    id="deployment-control"
                    title="Deployment"
                  >
                    <ProductionDeploymentPanel />
                  </ModuleAccordion>
                </div>

                <div className="mt-3">
                  <ModuleAccordion
                    id="reset-analytics"
                    title="Reset Analytics"
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
