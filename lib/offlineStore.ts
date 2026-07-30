"use client";

export const OFFLINE_QUEUE_EVENT =
  "daily-reset:offline-queue";

const DATABASE_NAME =
  "daily-reset-offline-v1";
const DATABASE_VERSION = 3;
const QUEUE_STORE = "queue";
const CACHE_STORE = "cache";
const AUDIO_STORE = "audio";

export type OfflineOperationKind =
  | "habit"
  | "protein"
  | "weight"
  | "journal"
  | "journal-delete"
  | "audio-upload";

export type HabitOfflineOperation = {
  id: string;
  kind: "habit";
  createdAt: string;
  payload: {
    habitId: string;
    date: string;
    completed: boolean;
  };
};

export type ProteinOfflineOperation = {
  id: string;
  kind: "protein";
  createdAt: string;
  payload: {
    entityId: string;
    date: string;
    amount: number;
    mealType:
      | "breakfast"
      | "lunch"
      | "dinner"
      | "snack"
      | "custom";
    note: string | null;
    createdAt: string;
  };
};

export type WeightOfflineOperation = {
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
};

export type JournalOfflineOperation = {
  id: string;
  kind: "journal";
  createdAt: string;
  payload: {
    entityId: string;
    entryType:
      | "dream"
      | "shadow"
      | "reflection"
      | "freewrite";
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
    activity:
      | "dream"
      | "shadow"
      | "reflection"
      | null;
    date: string;
  };
};

export type JournalDeleteOfflineOperation = {
  id: string;
  kind: "journal-delete";
  createdAt: string;
  payload: {
    entityId: string;
  };
};

export type AudioUploadOfflineOperation = {
  id: string;
  kind: "audio-upload";
  createdAt: string;
  payload: {
    entityId: string;
    entryType: "dream" | "shadow";
    blobKey: string;
    storagePath: string;
    contentType: string;
  };
};

export type OfflineOperation =
  | HabitOfflineOperation
  | ProteinOfflineOperation
  | WeightOfflineOperation
  | JournalOfflineOperation
  | JournalDeleteOfflineOperation
  | AudioUploadOfflineOperation;

export type OfflineQueueStatus = {
  pending: number;
  syncing: boolean;
  lastError: string | null;
  syncedKinds: OfflineOperationKind[];
};

type OfflineCacheRecord = {
  key: string;
  value: unknown;
  updatedAt: string;
};

type OfflineAudioRecord = {
  key: string;
  blob: Blob;
  contentType: string;
  size: number;
  createdAt: string;
};

type OfflineSyncResponse = {
  succeededIds?: string[];
  failed?: Array<{
    id: string;
    error: string;
    code?: "conflict" | "missing-audio" | "unknown";
  }>;
  syncedKinds?: OfflineOperationKind[];
  error?: string;
};

type OfflineAudioUploadResponse = {
  audioPath?: string;
  error?: string;
};

export type OfflineSyncSummary = {
  synced: number;
  pending: number;
  errors: string[];
  conflicts: string[];
  syncedKinds: OfflineOperationKind[];
};

let databasePromise:
  | Promise<IDBDatabase>
  | null = null;
let activeSync:
  | Promise<OfflineSyncSummary>
  | null = null;

export function createOfflineEntityId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID ===
      "function"
  ) {
    return crypto.randomUUID();
  }

  return [
    Date.now().toString(16),
    Math.random()
      .toString(16)
      .slice(2),
    Math.random()
      .toString(16)
      .slice(2),
  ].join("-");
}

export async function writeOfflineCache<T>(
  key: string,
  value: T
) {
  const database =
    await openDatabase();

  await runTransaction(
    database,
    CACHE_STORE,
    "readwrite",
    (store) => {
      store.put({
        key,
        value,
        updatedAt:
          new Date().toISOString(),
      } satisfies OfflineCacheRecord);
    }
  );
}

export async function readOfflineCache<T>(
  key: string
): Promise<T | null> {
  const database =
    await openDatabase();

  const record =
    await requestResult<
      OfflineCacheRecord | undefined
    >(
      database
        .transaction(
          CACHE_STORE,
          "readonly"
        )
        .objectStore(CACHE_STORE)
        .get(key)
    );

  return record
    ? (record.value as T)
    : null;
}

export async function saveOfflineAudio(
  key: string,
  blob: Blob
) {
  if (!key) {
    throw new Error(
      "Offline audio key is required."
    );
  }

  const database =
    await openDatabase();

  await runTransaction(
    database,
    AUDIO_STORE,
    "readwrite",
    (store) => {
      store.put({
        key,
        blob,
        contentType:
          blob.type ||
          "audio/webm",
        size: blob.size,
        createdAt:
          new Date().toISOString(),
      } satisfies OfflineAudioRecord);
    }
  );
}

export async function readOfflineAudio(
  key: string
): Promise<Blob | null> {
  if (!key) {
    return null;
  }

  const database =
    await openDatabase();

  const record =
    await requestResult<
      OfflineAudioRecord | undefined
    >(
      database
        .transaction(
          AUDIO_STORE,
          "readonly"
        )
        .objectStore(AUDIO_STORE)
        .get(key)
    );

  return record?.blob ?? null;
}

export async function removeOfflineAudio(
  key: string
) {
  if (!key) {
    return;
  }

  const database =
    await openDatabase();

  await runTransaction(
    database,
    AUDIO_STORE,
    "readwrite",
    (store) => {
      store.delete(key);
    }
  );
}

export async function cancelPendingAudioForEntity(
  entityId: string
) {
  if (!entityId) {
    return;
  }

  const operation =
    await getPendingAudioUpload(
      entityId
    );

  if (!operation) {
    return;
  }

  await removeOfflineOperation(
    operation.id
  );
  await removeOfflineAudio(
    operation.payload.blobKey
  );
}

export async function cleanupOrphanedOfflineAudio(
  maxAgeMs =
    24 * 60 * 60 * 1000
) {
  const database =
    await openDatabase();
  const operations =
    await getOfflineOperations();
  const referencedKeys =
    new Set(
      operations
        .filter(
          (
            operation
          ): operation is AudioUploadOfflineOperation =>
            operation.kind ===
            "audio-upload"
        )
        .map(
          (operation) =>
            operation.payload
              .blobKey
        )
    );

  const records =
    await requestResult<
      OfflineAudioRecord[]
    >(
      database
        .transaction(
          AUDIO_STORE,
          "readonly"
        )
        .objectStore(
          AUDIO_STORE
        )
        .getAll()
    );
  const cutoff =
    Date.now() - maxAgeMs;
  const orphanKeys =
    records
      .filter((record) => {
        if (
          referencedKeys.has(
            record.key
          )
        ) {
          return false;
        }

        const createdAt =
          Date.parse(
            record.createdAt
          );

        return (
          !Number.isFinite(
            createdAt
          ) ||
          createdAt < cutoff
        );
      })
      .map(
        (record) =>
          record.key
      );

  if (
    orphanKeys.length === 0
  ) {
    return 0;
  }

  await runTransaction(
    database,
    AUDIO_STORE,
    "readwrite",
    (store) => {
      for (
        const key of
        orphanKeys
      ) {
        store.delete(key);
      }
    }
  );

  return orphanKeys.length;
}

export async function getPendingAudioUpload(
  entityId: string
): Promise<AudioUploadOfflineOperation | null> {
  const operations =
    await getOfflineOperations();

  return (
    operations.find(
      (
        operation
      ): operation is AudioUploadOfflineOperation =>
        operation.kind ===
          "audio-upload" &&
        operation.payload.entityId ===
          entityId
    ) ?? null
  );
}

export async function createOfflineAudioPreviewUrl(
  entityId: string
): Promise<string | null> {
  const operation =
    await getPendingAudioUpload(
      entityId
    );

  if (!operation) {
    return null;
  }

  const blob =
    await readOfflineAudio(
      operation.payload.blobKey
    );

  return blob
    ? URL.createObjectURL(blob)
    : null;
}

export async function enqueueOfflineOperation(
  operation: OfflineOperation
) {
  let replacedBlobKey:
    | string
    | null = null;

  if (
    operation.kind ===
    "audio-upload"
  ) {
    const existing =
      await getOfflineOperationById(
        operation.id
      );

    if (
      existing?.kind ===
        "audio-upload" &&
      existing.payload.blobKey !==
        operation.payload.blobKey
    ) {
      replacedBlobKey =
        existing.payload.blobKey;
    }
  }

  const database =
    await openDatabase();

  await runTransaction(
    database,
    QUEUE_STORE,
    "readwrite",
    (store) => {
      store.put(operation);
    }
  );

  if (replacedBlobKey) {
    await removeOfflineAudio(
      replacedBlobKey
    );
  }

  await emitQueueStatus({
    syncing: false,
    lastError: null,
    syncedKinds: [],
  });
}

export async function getOfflineOperationById(
  id: string
): Promise<OfflineOperation | null> {
  if (!id) {
    return null;
  }

  const database =
    await openDatabase();
  const result =
    await requestResult<
      OfflineOperation | undefined
    >(
      database
        .transaction(
          QUEUE_STORE,
          "readonly"
        )
        .objectStore(
          QUEUE_STORE
        )
        .get(id)
    );

  return result ?? null;
}

export async function removeOfflineOperation(
  id: string
) {
  const database =
    await openDatabase();

  await runTransaction(
    database,
    QUEUE_STORE,
    "readwrite",
    (store) => {
      store.delete(id);
    }
  );

  await emitQueueStatus({
    syncing: false,
    lastError: null,
    syncedKinds: [],
  });
}

export async function getOfflineOperations() {
  const database =
    await openDatabase();

  const operations =
    await requestResult<
      OfflineOperation[]
    >(
      database
        .transaction(
          QUEUE_STORE,
          "readonly"
        )
        .objectStore(QUEUE_STORE)
        .getAll()
    );

  return [...operations].sort(
    (a, b) =>
      a.createdAt.localeCompare(
        b.createdAt
      )
  );
}

export async function getOfflineOperationCount() {
  const database =
    await openDatabase();

  return requestResult<number>(
    database
      .transaction(
        QUEUE_STORE,
        "readonly"
      )
      .objectStore(QUEUE_STORE)
      .count()
  );
}

export async function hasOfflineOperation(
  id: string
) {
  const database =
    await openDatabase();

  const result =
    await requestResult<
      OfflineOperation | undefined
    >(
      database
        .transaction(
          QUEUE_STORE,
          "readonly"
        )
        .objectStore(QUEUE_STORE)
        .get(id)
    );

  return Boolean(result);
}

export async function syncOfflineQueue(): Promise<OfflineSyncSummary> {
  if (activeSync) {
    return activeSync;
  }

  activeSync = performSync().finally(
    () => {
      activeSync = null;
    }
  );

  return activeSync;
}

async function performSync(): Promise<OfflineSyncSummary> {
  const initialOperations =
    await getOfflineOperations();

  if (
    initialOperations.length === 0 ||
    typeof navigator === "undefined" ||
    !navigator.onLine
  ) {
    const summary = {
      synced: 0,
      pending:
        initialOperations.length,
      errors: [],
      conflicts: [],
      syncedKinds: [],
    };

    await emitQueueStatus({
      syncing: false,
      lastError: null,
      syncedKinds: [],
    });

    return summary;
  }

  await emitQueueStatus({
    syncing: true,
    lastError: null,
    syncedKinds: [],
  });

  await cleanupOrphanedOfflineAudio();

  const errors: string[] = [];
  const conflicts: string[] = [];
  const syncedKinds =
    new Set<OfflineOperationKind>();
  let synced = 0;

  try {
    const regularOperations =
      initialOperations.filter(
        (
          operation
        ): operation is Exclude<
          OfflineOperation,
          AudioUploadOfflineOperation
        > =>
          operation.kind !==
          "audio-upload"
      );

    if (
      regularOperations.length >
      0
    ) {
      const response =
        await fetch(
          "/api/offline-sync",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            credentials:
              "same-origin",
            cache: "no-store",
            body: JSON.stringify({
              operations:
                regularOperations,
            }),
          }
        );

      const payload =
        (await response
          .json()
          .catch(() => null)) as
          | OfflineSyncResponse
          | null;

      if (!response.ok) {
        throw new Error(
          payload?.error ??
            "Offline sync failed."
        );
      }

      const succeededIds =
        payload?.succeededIds ??
        [];

      if (
        succeededIds.length >
        0
      ) {
        await deleteQueueIds(
          succeededIds
        );
        synced +=
          succeededIds.length;
      }

      for (
        const failedItem of
        payload?.failed ?? []
      ) {
        errors.push(
          failedItem.error
        );

        if (
          failedItem.code ===
            "conflict" ||
          failedItem.error.startsWith(
            "[CONFLICT]"
          )
        ) {
          conflicts.push(
            failedItem.error
          );
        }
      }

      for (
        const kind of
        payload?.syncedKinds ??
        []
      ) {
        syncedKinds.add(kind);
      }
    }

    const afterRegularSync =
      await getOfflineOperations();
    const pendingJournalIds =
      new Set(
        afterRegularSync
          .filter(
            (operation) =>
              operation.kind ===
              "journal"
          )
          .map(
            (operation) =>
              operation.kind ===
              "journal"
                ? operation.payload
                    .entityId
                : ""
          )
      );

    const audioOperations =
      afterRegularSync.filter(
        (
          operation
        ): operation is AudioUploadOfflineOperation =>
          operation.kind ===
          "audio-upload"
      );

    for (
      const operation of
      audioOperations
    ) {
      if (
        pendingJournalIds.has(
          operation.payload.entityId
        )
      ) {
        continue;
      }

      try {
        await syncAudioUpload(
          operation
        );
        synced += 1;
        syncedKinds.add(
          "audio-upload"
        );
      } catch (error) {
        errors.push(
          error instanceof Error
            ? error.message
            : "Offline audio upload failed."
        );
      }
    }

    const pending =
      await getOfflineOperationCount();
    const summary = {
      synced,
      pending,
      errors,
      conflicts,
      syncedKinds:
        Array.from(syncedKinds),
    };

    await emitQueueStatus({
      syncing: false,
      lastError:
        errors[0] ?? null,
      syncedKinds:
        summary.syncedKinds,
    });

    return summary;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Offline sync failed.";
    const pending =
      await getOfflineOperationCount();

    await emitQueueStatus({
      syncing: false,
      lastError: message,
      syncedKinds:
        Array.from(syncedKinds),
    });

    return {
      synced,
      pending,
      errors: [
        ...errors,
        message,
      ],
      conflicts,
      syncedKinds:
        Array.from(syncedKinds),
    };
  }
}

async function syncAudioUpload(
  operation: AudioUploadOfflineOperation
) {
  const blob =
    await readOfflineAudio(
      operation.payload.blobKey
    );

  if (!blob) {
    const alreadyUploaded =
      await confirmAudioAlreadyUploaded(
        operation
      );

    await deleteQueueIds([
      operation.id,
    ]);

    if (alreadyUploaded) {
      return;
    }

    throw new Error(
      "[MISSING AUDIO] A queued recording was removed by browser storage. Record it again; the rest of the queue can continue."
    );
  }

  const formData =
    new FormData();
  formData.set(
    "entityId",
    operation.payload.entityId
  );
  formData.set(
    "entryType",
    operation.payload.entryType
  );
  formData.set(
    "storagePath",
    operation.payload.storagePath
  );
  formData.set(
    "audio",
    blob,
    getOfflineAudioFileName(
      operation.payload.storagePath,
      operation.payload.contentType
    )
  );

  const response =
    await fetch(
      "/api/offline-audio-upload",
      {
        method: "POST",
        credentials:
          "same-origin",
        cache: "no-store",
        body: formData,
      }
    );

  const payload =
    (await response
      .json()
      .catch(() => null)) as
      | OfflineAudioUploadResponse
      | null;

  if (
    !response.ok ||
    !payload?.audioPath
  ) {
    throw new Error(
      payload?.error ??
        "Pending recording could not be uploaded."
    );
  }

  await deleteQueueIds([
    operation.id,
  ]);
  await removeOfflineAudio(
    operation.payload.blobKey
  );
}

async function confirmAudioAlreadyUploaded(
  operation: AudioUploadOfflineOperation
) {
  const url = new URL(
    "/api/offline-audio-upload",
    window.location.origin
  );
  url.searchParams.set(
    "entityId",
    operation.payload.entityId
  );
  url.searchParams.set(
    "storagePath",
    operation.payload.storagePath
  );

  try {
    const response =
      await fetch(url, {
        method: "GET",
        credentials:
          "same-origin",
        cache: "no-store",
      });
    const payload =
      (await response
        .json()
        .catch(() => null)) as
        | {
            uploaded?: boolean;
          }
        | null;

    return Boolean(
      response.ok &&
        payload?.uploaded
    );
  } catch {
    return false;
  }
}

async function deleteQueueIds(
  ids: string[]
) {
  if (ids.length === 0) {
    return;
  }

  const database =
    await openDatabase();

  await runTransaction(
    database,
    QUEUE_STORE,
    "readwrite",
    (store) => {
      for (const id of ids) {
        store.delete(id);
      }
    }
  );
}

function getOfflineAudioFileName(
  storagePath: string,
  contentType: string
) {
  const fromPath =
    storagePath
      .split("/")
      .pop()
      ?.trim();

  if (fromPath) {
    return fromPath;
  }

  const extension =
    contentType.includes("mp4")
      ? "m4a"
      : contentType.includes(
            "ogg"
          )
        ? "ogg"
        : "webm";

  return `daily-reset-audio.${extension}`;
}

async function emitQueueStatus({
  syncing,
  lastError,
  syncedKinds,
}: {
  syncing: boolean;
  lastError: string | null;
  syncedKinds: OfflineOperationKind[];
}) {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  let pending = 0;

  try {
    pending =
      await getOfflineOperationCount();
  } catch {
    pending = 0;
  }

  window.dispatchEvent(
    new CustomEvent<OfflineQueueStatus>(
      OFFLINE_QUEUE_EVENT,
      {
        detail: {
          pending,
          syncing,
          lastError,
          syncedKinds,
        },
      }
    )
  );
}

function openDatabase() {
  if (
    typeof indexedDB ===
    "undefined"
  ) {
    return Promise.reject(
      new Error(
        "Offline storage is not supported in this browser."
      )
    );
  }

  if (databasePromise) {
    return databasePromise;
  }

  databasePromise =
    new Promise<IDBDatabase>(
      (resolve, reject) => {
        const request =
          indexedDB.open(
            DATABASE_NAME,
            DATABASE_VERSION
          );

        request.onupgradeneeded =
          () => {
            const database =
              request.result;

            if (
              !database.objectStoreNames.contains(
                QUEUE_STORE
              )
            ) {
              database.createObjectStore(
                QUEUE_STORE,
                {
                  keyPath: "id",
                }
              );
            }

            if (
              !database.objectStoreNames.contains(
                CACHE_STORE
              )
            ) {
              database.createObjectStore(
                CACHE_STORE,
                {
                  keyPath: "key",
                }
              );
            }

            if (
              !database.objectStoreNames.contains(
                AUDIO_STORE
              )
            ) {
              database.createObjectStore(
                AUDIO_STORE,
                {
                  keyPath: "key",
                }
              );
            }
          };

        request.onsuccess =
          () => {
            const database =
              request.result;

            database.onversionchange =
              () => {
                database.close();
                databasePromise =
                  null;
              };

            resolve(database);
          };

        request.onerror =
          () => {
            databasePromise =
              null;
            reject(
              request.error ??
                new Error(
                  "Offline storage could not be opened."
                )
            );
          };

        request.onblocked =
          () => {
            reject(
              new Error(
                "Offline storage upgrade is blocked by another open app window."
              )
            );
          };
      }
    );

  return databasePromise;
}

function requestResult<T>(
  request: IDBRequest<T>
) {
  return new Promise<T>(
    (resolve, reject) => {
      request.onsuccess =
        () =>
          resolve(
            request.result
          );
      request.onerror =
        () =>
          reject(
            request.error ??
              new Error(
                "Offline storage request failed."
              )
          );
    }
  );
}

function runTransaction(
  database: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  mutate: (
    store: IDBObjectStore
  ) => void
) {
  return new Promise<void>(
    (resolve, reject) => {
      const transaction =
        database.transaction(
          storeName,
          mode
        );
      const store =
        transaction.objectStore(
          storeName
        );

      try {
        mutate(store);
      } catch (error) {
        transaction.abort();
        reject(error);
        return;
      }

      transaction.oncomplete =
        () => resolve();
      transaction.onerror =
        () =>
          reject(
            transaction.error ??
              new Error(
                "Offline storage transaction failed."
              )
          );
      transaction.onabort =
        () =>
          reject(
            transaction.error ??
              new Error(
                "Offline storage transaction was cancelled."
              )
          );
    }
  );
}
