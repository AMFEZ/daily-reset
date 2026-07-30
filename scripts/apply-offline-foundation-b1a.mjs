import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import {
  dirname,
  join,
} from "node:path";

const root = process.cwd();
const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");
const backupRoot = join(
  root,
  `.offline-b1a-backup-${stamp}`
);

patchPage();
patchDashboard();

console.log(
  "Offline Foundation B1A patches applied."
);
console.log(
  `Backup: ${backupRoot}`
);

function backup(relativePath) {
  const sourcePath = join(
    root,
    relativePath
  );

  if (!existsSync(sourcePath)) {
    throw new Error(
      `Missing ${relativePath}`
    );
  }

  const backupPath = join(
    backupRoot,
    relativePath
  );

  mkdirSync(
    dirname(backupPath),
    {
      recursive: true,
    }
  );

  copyFileSync(
    sourcePath,
    backupPath
  );

  return sourcePath;
}

function patchPage() {
  const path =
    backup("app/page.tsx");
  let source =
    readFileSync(path, "utf8");

  if (
    !source.includes(
      "@/components/offline/OfflineSyncRuntime"
    )
  ) {
    const anchor =
      'import { PWAController } from "@/components/pwa/PWAController";';

    if (!source.includes(anchor)) {
      throw new Error(
        "PWAController import anchor not found."
      );
    }

    source = source.replace(
      anchor,
      `${anchor}
import { OfflineSyncRuntime } from "@/components/offline/OfflineSyncRuntime";`
    );
  }

  if (
    !source.includes(
      "<OfflineSyncRuntime />"
    )
  ) {
    const anchor =
      "          <PWAController />";

    if (!source.includes(anchor)) {
      throw new Error(
        "PWAController render anchor not found."
      );
    }

    source = source.replace(
      anchor,
      `${anchor}
          <OfflineSyncRuntime />`
    );
  }

  writeFileSync(
    path,
    source,
    "utf8"
  );
}

function patchDashboard() {
  const path = backup(
    "components/reset/ResetDashboard.tsx"
  );
  let source =
    readFileSync(path, "utf8");

  if (
    !source.includes(
      "@/lib/offlineStore"
    )
  ) {
    const anchor =
      '} from "@/lib/useDailyResetRealtime";';

    if (!source.includes(anchor)) {
      throw new Error(
        "Realtime import anchor not found."
      );
    }

    source = source.replace(
      anchor,
      `${anchor}
import {
  enqueueOfflineOperation,
  readOfflineCache,
  syncOfflineQueue,
  writeOfflineCache,
} from "@/lib/offlineStore";`
    );
  }

  if (
    !source.includes(
      "daily-reset:habit-state:v1"
    )
  ) {
    const anchor =
      "  const showSaveSuccess = useCallback(";

    const index =
      source.indexOf(anchor);

    if (index < 0) {
      throw new Error(
        "showSaveSuccess anchor not found."
      );
    }

    const effects = `  const offlineHabitCacheKey =
    \`daily-reset:habit-state:v1:\${todayKey}\`;

  useEffect(() => {
    let cancelled = false;

    if (navigator.onLine) {
      return;
    }

    void readOfflineCache<{
      date: string;
      completedMap: Record<string, boolean>;
    }>(offlineHabitCacheKey).then((cached) => {
      if (
        !cancelled &&
        cached?.date === todayKey
      ) {
        setCompletedMap(
          cached.completedMap
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [offlineHabitCacheKey, todayKey]);

  useEffect(() => {
    void writeOfflineCache(
      offlineHabitCacheKey,
      {
        date: todayKey,
        completedMap,
      }
    );
  }, [
    completedMap,
    offlineHabitCacheKey,
    todayKey,
  ]);

`;

    source =
      source.slice(0, index) +
      effects +
      source.slice(index);
  }

  const toggleStart =
    source.indexOf(
      "  async function toggleHabit(habit: Habit) {"
    );
  const lockStart =
    source.indexOf(
      "  async function toggleDayLock() {",
      toggleStart
    );

  if (
    toggleStart < 0 ||
    lockStart < 0
  ) {
    throw new Error(
      "Habit toggle function anchors not found."
    );
  }

  const replacement = `  async function toggleHabit(habit: Habit) {
    if (isLocked) {
      setSaveError(
        "Today is locked. Unlock the reset before editing protocols."
      );
      return;
    }

    if (
      pendingHabitIdsRef.current.has(
        habit.id
      )
    ) {
      return;
    }

    const previousCompleted =
      Boolean(completedMap[habit.id]);
    const nextCompleted =
      !previousCompleted;
    const operationId =
      \`habit:\${todayKey}:\${habit.id}\`;

    pendingHabitIdsRef.current.add(
      habit.id
    );

    setSaveError(null);
    setSaveSuccess(null);
    setFailedHabit(null);
    setLockError(null);
    setPendingHabitIds((current) => {
      const next = new Set(current);
      next.add(habit.id);
      return next;
    });

    setCompletedMap((current) => ({
      ...current,
      [habit.id]: nextCompleted,
    }));

    try {
      await enqueueOfflineOperation({
        id: operationId,
        kind: "habit",
        createdAt:
          new Date().toISOString(),
        payload: {
          habitId: habit.id,
          date: todayKey,
          completed: nextCompleted,
        },
      });

      setHasResetRecord(true);
      setFailedHabit(null);

      dispatchDailyResetDataChanged({
        scopes: ["habits", "analytics"],
        source: "manual-habit",
        habitId: habit.id,
        habitName: habit.name,
        completed: nextCompleted,
        date: todayKey,
      });

      const summary =
        await syncOfflineQueue();

      if (
        !navigator.onLine ||
        summary.pending > 0
      ) {
        showSaveSuccess(
          "Saved offline. Sync will resume automatically."
        );
      } else {
        showSaveSuccess(
          \`\${habit.name} saved.\`
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Habit could not be saved locally.";

      console.error(
        "Offline habit save failed:",
        message
      );

      setCompletedMap((current) => ({
        ...current,
        [habit.id]:
          previousCompleted,
      }));
      setSaveError(message);
      setFailedHabit(habit);
    } finally {
      pendingHabitIdsRef.current.delete(
        habit.id
      );
      setPendingHabitIds((current) => {
        const next =
          new Set(current);
        next.delete(habit.id);
        return next;
      });
    }
  }

`;

  source =
    source.slice(0, toggleStart) +
    replacement +
    source.slice(lockStart);

  source = source.replace(
    "Browser reports offline. Changes will be attempted, but syncing may fail.",
    "Offline mode active. Changes are saved on this device and will sync automatically."
  );

  writeFileSync(
    path,
    source,
    "utf8"
  );
}
