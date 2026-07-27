"use client";

import { createClient } from "@/utils/supabase/client";
import { dispatchDailyResetDataChanged } from "@/lib/dailyResetEvents";

type ActivityHabit =
  | "weight"
  | "breakfast_protein"
  | "dream"
  | "shadow";

type HabitRow = {
  id: string;
  name: string;
  sort_order: number | null;
};

const aliases: Record<ActivityHabit, string[]> = {
  weight: [
    "Weigh In",
    "Weigh-In",
    "Weight Log",
    "Log Weight",
  ],
  breakfast_protein: [
    "Protein Breakfast",
    "Protein Oatmeal",
    "Breakfast Protein",
    "Eat Protein Breakfast",
  ],
  dream: [
    "Dream Journal",
    "Dream Log",
    "Record Dream",
    "Dream Entry",
  ],
  shadow: [
    "Shadow Work",
    "Shadow Prompt",
    "Shadow Console",
    "Answer Shadow Prompt",
  ],
};

const keywords: Record<ActivityHabit, string[]> = {
  weight: ["weigh", "weight"],
  breakfast_protein: ["protein", "breakfast", "oatmeal"],
  dream: ["dream"],
  shadow: ["shadow"],
};

export async function completeActivityHabit({
  activity,
  date,
}: {
  activity: ActivityHabit;
  date: string;
}) {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error(
      userError?.message ??
        "Authentication required for habit sync."
    );
  }

  const { data, error } = await supabase
    .from("habits")
    .select("id, name, sort_order")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("sort_order", {
      ascending: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  const habits = (data ?? []) as HabitRow[];
  const matchedHabit = findHabit(
    habits,
    aliases[activity],
    keywords[activity]
  );

  if (!matchedHabit) {
    const activeHabitNames =
      habits.length > 0
        ? habits
            .map((habit) => habit.name)
            .join(", ")
        : "none";

    throw new Error(
      `No active habit matched ${aliases[
        activity
      ].join(
        ", "
      )}. Active habits: ${activeHabitNames}.`
    );
  }

  const { error: completionError } =
    await supabase.rpc(
      "toggle_habit_and_save_reset_v2",
      {
        target_habit_id:
          matchedHabit.id,
        target_date: date,
        target_completed: true,
      }
    );

  if (completionError) {
    throw new Error(
      completionError.message
    );
  }

  dispatchDailyResetDataChanged({
    scopes: [
      "habits",
      "analytics",
      activity === "weight"
        ? "body"
        : activity === "breakfast_protein"
          ? "nutrition"
          : activity === "dream"
            ? "journal"
            : "shadow",
    ],
    source:
      activity === "breakfast_protein"
        ? "breakfast-protein"
        : activity,
    habitId: matchedHabit.id,
    habitName: matchedHabit.name,
    completed: true,
    date,
  });

  return matchedHabit;
}

function findHabit(
  habits: HabitRow[],
  possibleNames: string[],
  activityKeywords: string[]
) {
  const normalizedAliases =
    possibleNames.map(normalizeName);

  const exact = habits.find((habit) =>
    normalizedAliases.includes(
      normalizeName(habit.name)
    )
  );

  if (exact) return exact;

  const partialAliasMatch = habits.find(
    (habit) => {
      const normalizedHabit =
        normalizeName(habit.name);

      return normalizedAliases.some(
        (alias) =>
          normalizedHabit.includes(
            alias
          ) ||
          alias.includes(
            normalizedHabit
          )
      );
    }
  );

  if (partialAliasMatch) {
    return partialAliasMatch;
  }

  return habits.find((habit) => {
    const normalizedHabit =
      normalizeName(habit.name);

    return activityKeywords.some(
      (keyword) =>
        normalizedHabit.includes(
          normalizeName(keyword)
        )
    );
  });
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
