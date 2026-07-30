import { createClient } from "@/utils/supabase/server";

export const dynamic =
  "force-dynamic";

type MealType =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "snack"
  | "custom";

type JournalType =
  | "dream"
  | "shadow"
  | "reflection"
  | "freewrite";

type ActivityType =
  | "dream"
  | "shadow"
  | "reflection";

type OfflineOperation =
  | {
      id: string;
      kind: "habit";
      createdAt: string;
      payload: {
        habitId: string;
        date: string;
        completed: boolean;
      };
    }
  | {
      id: string;
      kind: "protein";
      createdAt: string;
      payload: {
        entityId: string;
        date: string;
        amount: number;
        mealType: MealType;
        note: string | null;
        createdAt: string;
      };
    }
  | {
      id: string;
      kind: "weight";
      createdAt: string;
      payload: {
        entityId: string;
        date: string;
        weight: number;
        unit: "lbs" | "kg";
        note: string | null;
      };
    }
  | {
      id: string;
      kind: "journal";
      createdAt: string;
      payload: {
        entityId: string;
        entryType: JournalType;
        title: string | null;
        content: string;
        mood: string | null;
        energy: number | null;
        tags: string[];
        symbols: string[] | null;
        createdAt: string;
        audioPath?: string | null;
        rawTranscript?: string | null;
        cleanedTranscript?: string | null;
        conflictGuard?: boolean;
        activity: ActivityType | null;
        date: string;
      };
    }
  | {
      id: string;
      kind: "journal-delete";
      createdAt: string;
      payload: {
        entityId: string;
      };
    };

type SyncFailure = {
  id: string;
  error: string;
  code:
    | "conflict"
    | "missing-audio"
    | "unknown";
};

const CONFLICT_GRACE_MS = 2_000;

export async function POST(
  request: Request
) {
  const supabase =
    await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return Response.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Offline sync body must be valid JSON." },
      { status: 400 }
    );
  }

  const operations =
    readOperations(body);

  if (!operations) {
    return Response.json(
      { error: "Offline operations are required." },
      { status: 400 }
    );
  }

  const succeededIds: string[] = [];
  const failed: SyncFailure[] = [];
  const syncedKinds = new Set<
    OfflineOperation["kind"]
  >();

  for (const operation of operations.slice(0, 100)) {
    try {
      await syncOperation(
        supabase,
        user.id,
        operation
      );
      succeededIds.push(operation.id);
      syncedKinds.add(operation.kind);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Operation failed.";

      failed.push({
        id: operation.id,
        error: message,
        code: message.startsWith(
          "[CONFLICT]"
        )
          ? "conflict"
          : message.startsWith(
                "[MISSING AUDIO]"
              )
            ? "missing-audio"
            : "unknown",
      });
    }
  }

  return Response.json(
    {
      succeededIds,
      failed,
      syncedKinds:
        Array.from(syncedKinds),
    },
    {
      status: 200,
      headers: {
        "Cache-Control":
          "private, no-store",
      },
    }
  );
}

async function syncOperation(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  userId: string,
  operation: OfflineOperation
) {
  if (operation.kind === "habit") {
    assertDate(operation.payload.date);
    const { error } = await supabase.rpc(
      "toggle_habit_and_save_reset_v2",
      {
        target_habit_id:
          operation.payload.habitId,
        target_date:
          operation.payload.date,
        target_completed:
          Boolean(
            operation.payload.completed
          ),
      }
    );

    if (error) throw new Error(error.message);
    return;
  }

  if (operation.kind === "protein") {
    const payload = operation.payload;
    assertDate(payload.date);

    if (
      !Number.isFinite(payload.amount) ||
      payload.amount <= 0
    ) {
      throw new Error("Protein amount is invalid.");
    }

    const { error } = await supabase
      .from("protein_logs")
      .upsert(
        {
          id: payload.entityId,
          user_id: userId,
          date: payload.date,
          amount: payload.amount,
          meal_type: payload.mealType,
          note: payload.note,
          created_at: payload.createdAt,
        },
        { onConflict: "id" }
      );

    if (error) throw new Error(error.message);
    return;
  }

  if (operation.kind === "journal") {
    await syncJournal(
      supabase,
      userId,
      operation
    );
    return;
  }

  if (operation.kind === "journal-delete") {
    await deleteJournal(
      supabase,
      userId,
      operation.payload.entityId
    );
    return;
  }

  const payload = operation.payload;
  assertDate(payload.date);

  if (
    !Number.isFinite(payload.weight) ||
    payload.weight <= 0
  ) {
    throw new Error("Weight value is invalid.");
  }

  const {
    data: existing,
    error: existingError,
  } = await supabase
    .from("weight_logs")
    .select("id")
    .eq("user_id", userId)
    .eq("date", payload.date)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  const values = {
    user_id: userId,
    date: payload.date,
    weight: payload.weight,
    unit: payload.unit,
    note: payload.note,
  };

  const mutation = existing
    ? supabase
        .from("weight_logs")
        .update(values)
        .eq("id", existing.id)
        .eq("user_id", userId)
    : supabase
        .from("weight_logs")
        .insert({
          ...values,
          id: payload.entityId,
        });

  const { error } = await mutation;
  if (error) throw new Error(error.message);
}

async function syncJournal(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  userId: string,
  operation: Extract<
    OfflineOperation,
    { kind: "journal" }
  >
) {
  const payload = operation.payload;
  assertDate(payload.date);

  if (
    ![
      "dream",
      "shadow",
      "reflection",
      "freewrite",
    ].includes(payload.entryType)
  ) {
    throw new Error("Journal entry type is invalid.");
  }

  if (
    !payload.entityId ||
    payload.content.trim().length < 2
  ) {
    throw new Error("Journal content is required.");
  }

  const {
    data: existing,
    error: existingError,
  } = await supabase
    .from("journal_entries")
    .select("id, updated_at, audio_path")
    .eq("id", payload.entityId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (
    payload.conflictGuard &&
    existing?.updated_at &&
    isServerNewer(
      existing.updated_at,
      operation.createdAt
    )
  ) {
    throw new Error(
      "[CONFLICT] This journal entry changed on another device after your offline edit. Open it and save again to intentionally use this device's version."
    );
  }

  const updatedAt =
    new Date().toISOString();
  const values = {
    id: payload.entityId,
    user_id: userId,
    entry_type: payload.entryType,
    title: payload.title,
    content: payload.content,
    mood: payload.mood,
    energy: payload.energy,
    tags: payload.tags,
    symbols: payload.symbols,
    audio_path:
      payload.audioPath ?? null,
    raw_transcript:
      payload.rawTranscript ?? null,
    cleaned_transcript:
      payload.cleanedTranscript ?? null,
    created_at: payload.createdAt,
    updated_at: updatedAt,
  };

  const { error } = await supabase
    .from("journal_entries")
    .upsert(values, {
      onConflict: "id",
    });

  if (error) throw new Error(error.message);

  const previousAudioPath =
    existing?.audio_path ?? null;

  if (
    previousAudioPath &&
    previousAudioPath !==
      (payload.audioPath ?? null)
  ) {
    const { error: audioDeleteError } =
      await supabase.storage
        .from("dream-audio")
        .remove([previousAudioPath]);

    if (audioDeleteError) {
      console.error(
        "Replaced journal audio cleanup failed:",
        audioDeleteError.message
      );
    }
  }

  const { error: reflectionDeleteError } =
    await supabase
      .from("ai_reflections")
      .delete()
      .eq("journal_entry_id", payload.entityId)
      .eq("user_id", userId);

  if (reflectionDeleteError) {
    throw new Error(reflectionDeleteError.message);
  }

  if (payload.activity) {
    await completeActivityHabit(
      supabase,
      userId,
      payload.activity,
      payload.date
    );
  }
}

async function deleteJournal(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  userId: string,
  entityId: string
) {
  if (!entityId) {
    throw new Error("Journal entry ID is required.");
  }

  const {
    data: existing,
    error: existingError,
  } = await supabase
    .from("journal_entries")
    .select("id, audio_path")
    .eq("id", entityId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing?.audio_path) {
    const { error: audioDeleteError } =
      await supabase.storage
        .from("dream-audio")
        .remove([existing.audio_path]);

    if (audioDeleteError) {
      throw new Error(audioDeleteError.message);
    }
  }

  const { error: reflectionDeleteError } =
    await supabase
      .from("ai_reflections")
      .delete()
      .eq("journal_entry_id", entityId)
      .eq("user_id", userId);

  if (reflectionDeleteError) {
    throw new Error(reflectionDeleteError.message);
  }

  const { error: entryDeleteError } =
    await supabase
      .from("journal_entries")
      .delete()
      .eq("id", entityId)
      .eq("user_id", userId);

  if (entryDeleteError) {
    throw new Error(entryDeleteError.message);
  }
}

function isServerNewer(
  serverUpdatedAt: string,
  clientMutationAt: string
) {
  const serverTime = Date.parse(serverUpdatedAt);
  const clientTime = Date.parse(clientMutationAt);

  if (
    !Number.isFinite(serverTime) ||
    !Number.isFinite(clientTime)
  ) {
    return false;
  }

  return (
    serverTime >
    clientTime + CONFLICT_GRACE_MS
  );
}

function readOperations(
  body: unknown
): OfflineOperation[] | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as {
    operations?: unknown;
  };

  if (!Array.isArray(candidate.operations)) {
    return null;
  }

  return candidate.operations.filter(
    (operation): operation is OfflineOperation =>
      Boolean(
        operation &&
          typeof operation === "object" &&
          typeof (operation as { id?: unknown }).id === "string" &&
          [
            "habit",
            "protein",
            "weight",
            "journal",
            "journal-delete",
          ].includes(
            String((operation as { kind?: unknown }).kind)
          )
      )
  );
}

async function completeActivityHabit(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  userId: string,
  activity: ActivityType,
  date: string
) {
  const aliases =
    activity === "dream"
      ? ["Dream Journal", "Dream Log", "Record Dream", "Dream Entry"]
      : activity === "shadow"
        ? ["Shadow Work", "Shadow Prompt", "Shadow Console", "Answer Shadow Prompt"]
        : ["Daily Reflection", "Reflection", "Reflection Log", "Daily Review", "Freewrite"];

  const { data: habits, error } = await supabase
    .from("habits")
    .select("id, name")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) throw new Error(error.message);

  const normalizedAliases = aliases.map(normalizeName);
  const matchingHabit = (habits ?? []).find(
    (habit: {
      id: string;
      name: string;
    }) =>
      normalizedAliases.includes(
        normalizeName(habit.name)
      )
  );

  if (!matchingHabit) return;

  const { error: completionError } = await supabase.rpc(
    "toggle_habit_and_save_reset_v2",
    {
      target_habit_id: matchingHabit.id,
      target_date: date,
      target_completed: true,
    }
  );

  if (completionError) {
    throw new Error(completionError.message);
  }
}

function normalizeName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function assertDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Operation date is invalid.");
  }
}
