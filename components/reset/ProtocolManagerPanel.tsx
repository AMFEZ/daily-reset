"use client";

import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

export type RoutineType =
  | "morning"
  | "daily"
  | "night"
  | "trust_based";

export type ManagedProtocol = {
  id: string;
  name: string;
  category: string;
  section: string;
  routine_type: RoutineType;
  sort_order: number;
  is_active: boolean;
};

type ProtocolManagerPanelProps = {
  initialProtocols: ManagedProtocol[];
};

type ProtocolRpcRow = {
  protocol_id: string;
  protocol_name: string;
  protocol_category: string;
  protocol_section: string;
  protocol_routine_type: RoutineType;
  protocol_sort_order: number;
  protocol_is_active: boolean;
};

type ViewFilter =
  | "active"
  | "archived"
  | "all";

type EditDraft = {
  name: string;
  category: string;
  routineType: RoutineType;
};

const ROUTINE_OPTIONS: Array<{
  value: RoutineType;
  label: string;
}> = [
  {
    value: "morning",
    label: "Morning Reset",
  },
  {
    value: "daily",
    label: "Daily Protocols",
  },
  {
    value: "night",
    label: "Shutdown Protocol",
  },
  {
    value: "trust_based",
    label: "Sleep Boundary",
  },
];

const ROUTINE_LABELS: Record<
  RoutineType,
  string
> = {
  morning: "MORNING RESET",
  daily: "DAILY PROTOCOLS",
  night: "SHUTDOWN PROTOCOL",
  trust_based: "SLEEP BOUNDARY",
};

const ROUTINE_ORDER: Record<
  RoutineType,
  number
> = {
  morning: 0,
  daily: 1,
  night: 2,
  trust_based: 3,
};

export function ProtocolManagerPanel({
  initialProtocols,
}: ProtocolManagerPanelProps) {
  const supabase = createClient();
  const router = useRouter();

  const [protocols, setProtocols] =
    useState<ManagedProtocol[]>(
      sortProtocols(initialProtocols)
    );
  const [viewFilter, setViewFilter] =
    useState<ViewFilter>("active");
  const [search, setSearch] = useState("");
  const [newName, setNewName] =
    useState("");
  const [newCategory, setNewCategory] =
    useState("Custom");
  const [newRoutineType, setNewRoutineType] =
    useState<RoutineType>("daily");
  const [editingId, setEditingId] =
    useState<string | null>(null);
  const [editDraft, setEditDraft] =
    useState<EditDraft | null>(null);
  const [message, setMessage] =
    useState<string | null>(null);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);
  const [isPending, startTransition] =
    useTransition();

  useEffect(() => {
    setProtocols(
      sortProtocols(initialProtocols)
    );
  }, [initialProtocols]);

  const activeCount = protocols.filter(
    (protocol) => protocol.is_active
  ).length;

  const archivedCount = protocols.filter(
    (protocol) => !protocol.is_active
  ).length;

  const visibleProtocols = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    return sortProtocols(protocols).filter(
      (protocol) => {
        const matchesView =
          viewFilter === "all" ||
          (viewFilter === "active" &&
            protocol.is_active) ||
          (viewFilter === "archived" &&
            !protocol.is_active);

        const matchesSearch =
          normalizedSearch.length === 0 ||
          protocol.name
            .toLowerCase()
            .includes(normalizedSearch) ||
          protocol.category
            .toLowerCase()
            .includes(normalizedSearch) ||
          ROUTINE_LABELS[
            protocol.routine_type
          ]
            .toLowerCase()
            .includes(normalizedSearch);

        return matchesView && matchesSearch;
      }
    );
  }, [protocols, search, viewFilter]);

  const groupedProtocols = useMemo(
    () =>
      ROUTINE_OPTIONS.map((routine) => ({
        ...routine,
        protocols: visibleProtocols.filter(
          (protocol) =>
            protocol.routine_type ===
            routine.value
        ),
      })),
    [visibleProtocols]
  );

  function clearStatus() {
    setMessage(null);
    setErrorMessage(null);
  }

  function createProtocol() {
    const cleanedName = newName.trim();

    if (!cleanedName) {
      setErrorMessage(
        "Enter a protocol name before saving."
      );
      return;
    }

    clearStatus();

    startTransition(async () => {
      const { data: rawData, error } =
        await supabase
          .rpc("create_daily_reset_protocol", {
            target_name: cleanedName,
            target_category:
              newCategory.trim() || "Custom",
            target_routine_type:
              newRoutineType,
          })
          .single();

      if (error) {
        console.error(
          "Protocol creation failed:",
          error.message
        );
        setErrorMessage(error.message);
        return;
      }

      if (!rawData) {
        setErrorMessage(
          "The protocol was not returned after saving."
        );
        return;
      }

      const created = mapRpcRow(
        rawData as unknown as ProtocolRpcRow
      );

      setProtocols((current) =>
        sortProtocols([...current, created])
      );
      setNewName("");
      setNewCategory("Custom");
      setMessage(
        `${created.name} added to ${ROUTINE_LABELS[
          created.routine_type
        ]}.`
      );
      router.refresh();
    });
  }

  function beginEdit(
    protocol: ManagedProtocol
  ) {
    clearStatus();
    setEditingId(protocol.id);
    setEditDraft({
      name: protocol.name,
      category: protocol.category,
      routineType: protocol.routine_type,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  function saveEdit(
    protocol: ManagedProtocol
  ) {
    if (!editDraft) {
      return;
    }

    const cleanedName =
      editDraft.name.trim();

    if (!cleanedName) {
      setErrorMessage(
        "Protocol name cannot be empty."
      );
      return;
    }

    updateProtocol(
      protocol,
      {
        name: cleanedName,
        category:
          editDraft.category.trim() ||
          "Custom",
        routineType:
          editDraft.routineType,
        isActive: protocol.is_active,
      },
      "Protocol updated."
    );
  }

  function toggleProtocolState(
    protocol: ManagedProtocol
  ) {
    const nextActive =
      !protocol.is_active;

    updateProtocol(
      protocol,
      {
        name: protocol.name,
        category: protocol.category,
        routineType:
          protocol.routine_type,
        isActive: nextActive,
      },
      nextActive
        ? "Protocol restored."
        : "Protocol disabled. Historical logs were preserved."
    );
  }

  function updateProtocol(
    protocol: ManagedProtocol,
    input: {
      name: string;
      category: string;
      routineType: RoutineType;
      isActive: boolean;
    },
    successMessage: string
  ) {
    clearStatus();

    startTransition(async () => {
      const { data: rawData, error } =
        await supabase
          .rpc("update_daily_reset_protocol", {
            target_habit_id: protocol.id,
            target_name: input.name,
            target_category:
              input.category,
            target_routine_type:
              input.routineType,
            target_is_active:
              input.isActive,
          })
          .single();

      if (error) {
        console.error(
          "Protocol update failed:",
          error.message
        );
        setErrorMessage(error.message);
        return;
      }

      if (!rawData) {
        setErrorMessage(
          "The updated protocol was not returned."
        );
        return;
      }

      const updated = mapRpcRow(
        rawData as unknown as ProtocolRpcRow
      );

      setProtocols((current) =>
        sortProtocols(
          current.map((item) =>
            item.id === updated.id
              ? updated
              : item
          )
        )
      );
      setEditingId(null);
      setEditDraft(null);
      setMessage(successMessage);
      router.refresh();
    });
  }

  function moveProtocol(
    protocol: ManagedProtocol,
    direction: "up" | "down"
  ) {
    clearStatus();

    startTransition(async () => {
      const { error } = await supabase
        .rpc("move_daily_reset_protocol", {
          target_habit_id: protocol.id,
          target_direction: direction,
        })
        .single();

      if (error) {
        console.error(
          "Protocol reorder failed:",
          error.message
        );
        setErrorMessage(error.message);
        return;
      }

      setMessage(
        `${protocol.name} moved ${direction}.`
      );
      router.refresh();
    });
  }

  return (
    <section className="border border-[#242424] bg-[#050505]">
      <div className="border-b border-[#242424] bg-[#0d0d0d] px-3 py-2">
        <p className="terminal-green text-xs uppercase tracking-[0.2em]">
          &gt; protocol.manager
        </p>
      </div>

      <div className="p-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric
            label="ACTIVE"
            value={String(activeCount)}
            green={activeCount > 0}
          />

          <Metric
            label="DISABLED"
            value={String(archivedCount)}
            warning={archivedCount > 0}
          />

          <Metric
            label="TOTAL"
            value={String(protocols.length)}
          />
        </div>

        <div className="mt-4 border border-[#242424] bg-[#080808] p-3">
          <p className="terminal-green text-xs uppercase tracking-[0.18em]">
            &gt; add.protocol
          </p>

          <div className="mt-3 grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_auto]">
            <Field label="Protocol name">
              <input
                type="text"
                value={newName}
                maxLength={120}
                onChange={(event) =>
                  setNewName(
                    event.target.value
                  )
                }
                placeholder="Example: Night stretches"
                className={inputClassName}
              />
            </Field>

            <Field label="Category">
              <input
                type="text"
                value={newCategory}
                maxLength={60}
                onChange={(event) =>
                  setNewCategory(
                    event.target.value
                  )
                }
                placeholder="Custom"
                className={inputClassName}
              />
            </Field>

            <Field label="Routine">
              <select
                value={newRoutineType}
                onChange={(event) =>
                  setNewRoutineType(
                    event.target
                      .value as RoutineType
                  )
                }
                className={inputClassName}
              >
                {ROUTINE_OPTIONS.map(
                  (routine) => (
                    <option
                      key={routine.value}
                      value={routine.value}
                    >
                      {routine.label}
                    </option>
                  )
                )}
              </select>
            </Field>

            <button
              type="button"
              onClick={createProtocol}
              disabled={isPending}
              className="min-h-[48px] self-end border border-[#39ff88] bg-[#050505] px-4 py-3 text-left text-xs text-[#39ff88] transition hover:bg-[#0d0d0d] disabled:cursor-not-allowed disabled:opacity-50"
            >
              &gt; add
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search protocols or categories..."
            className={inputClassName}
          />

          <div className="grid grid-cols-3 gap-2">
            {(
              [
                "active",
                "archived",
                "all",
              ] as ViewFilter[]
            ).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() =>
                  setViewFilter(filter)
                }
                className={[
                  "min-h-[48px] border px-3 text-xs uppercase tracking-[0.1em]",
                  viewFilter === filter
                    ? "border-[#39ff88] text-[#39ff88]"
                    : "border-[#242424] text-[#8a8a8a]",
                ].join(" ")}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {groupedProtocols.map(
            (group) => (
              <section
                key={group.value}
                className="border border-[#242424] bg-[#080808]"
              >
                <div className="flex items-center justify-between gap-3 border-b border-[#242424] bg-[#0d0d0d] px-3 py-2">
                  <p className="terminal-green text-[10px] uppercase tracking-[0.18em]">
                    &gt; {group.label}
                  </p>

                  <span className="terminal-muted text-[10px]">
                    {group.protocols.length}
                  </span>
                </div>

                <div className="divide-y divide-[#1a1a1a]">
                  {group.protocols.length >
                  0 ? (
                    group.protocols.map(
                      (protocol) => (
                        <ProtocolRow
                          key={protocol.id}
                          protocol={protocol}
                          editing={
                            editingId ===
                            protocol.id
                          }
                          editDraft={
                            editingId ===
                            protocol.id
                              ? editDraft
                              : null
                          }
                          setEditDraft={
                            setEditDraft
                          }
                          disabled={isPending}
                          onEdit={() =>
                            beginEdit(protocol)
                          }
                          onCancel={cancelEdit}
                          onSave={() =>
                            saveEdit(protocol)
                          }
                          onToggle={() =>
                            toggleProtocolState(
                              protocol
                            )
                          }
                          onMoveUp={() =>
                            moveProtocol(
                              protocol,
                              "up"
                            )
                          }
                          onMoveDown={() =>
                            moveProtocol(
                              protocol,
                              "down"
                            )
                          }
                        />
                      )
                    )
                  ) : (
                    <p className="terminal-muted p-3 text-xs">
                      &gt; No matching protocols.
                    </p>
                  )}
                </div>
              </section>
            )
          )}
        </div>

        {message ? (
          <p className="terminal-green mt-4 text-xs leading-6">
            &gt; {message}
          </p>
        ) : null}

        {errorMessage ? (
          <p className="mt-4 text-xs leading-6 text-[#ff6b6b]">
            &gt; {errorMessage}
          </p>
        ) : null}

        <div className="terminal-muted mt-4 border-t border-[#242424] pt-3 text-xs leading-6">
          <p>
            &gt; Disabled protocols disappear from
            daily checklists but keep their historical
            logs.
          </p>

          <p>
            &gt; Moving a protocol changes its order
            within its current routine.
          </p>
        </div>
      </div>
    </section>
  );
}

function ProtocolRow({
  protocol,
  editing,
  editDraft,
  setEditDraft,
  disabled,
  onEdit,
  onCancel,
  onSave,
  onToggle,
  onMoveUp,
  onMoveDown,
}: {
  protocol: ManagedProtocol;
  editing: boolean;
  editDraft: EditDraft | null;
  setEditDraft: (
    draft: EditDraft | null
  ) => void;
  disabled: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  if (editing && editDraft) {
    return (
      <div className="p-3">
        <div className="grid gap-3 lg:grid-cols-3">
          <Field label="Protocol name">
            <input
              type="text"
              value={editDraft.name}
              maxLength={120}
              onChange={(event) =>
                setEditDraft({
                  ...editDraft,
                  name: event.target.value,
                })
              }
              className={inputClassName}
            />
          </Field>

          <Field label="Category">
            <input
              type="text"
              value={editDraft.category}
              maxLength={60}
              onChange={(event) =>
                setEditDraft({
                  ...editDraft,
                  category:
                    event.target.value,
                })
              }
              className={inputClassName}
            />
          </Field>

          <Field label="Routine">
            <select
              value={editDraft.routineType}
              onChange={(event) =>
                setEditDraft({
                  ...editDraft,
                  routineType:
                    event.target
                      .value as RoutineType,
                })
              }
              className={inputClassName}
            >
              {ROUTINE_OPTIONS.map(
                (routine) => (
                  <option
                    key={routine.value}
                    value={routine.value}
                  >
                    {routine.label}
                  </option>
                )
              )}
            </select>
          </Field>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={disabled}
            className="min-h-[44px] border border-[#39ff88] px-3 text-left text-xs text-[#39ff88] disabled:opacity-50"
          >
            &gt; save_changes
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={disabled}
            className="min-h-[44px] border border-[#242424] px-3 text-left text-xs text-[#8a8a8a] disabled:opacity-50"
          >
            &gt; cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        "grid gap-3 p-3 lg:grid-cols-[1fr_auto] lg:items-center",
        protocol.is_active
          ? ""
          : "opacity-60",
      ].join(" ")}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-[#e5e5e5]">
            {protocol.name}
          </p>

          <span
            className={
              protocol.is_active
                ? "terminal-green text-[9px] uppercase tracking-[0.12em]"
                : "text-[9px] uppercase tracking-[0.12em] text-[#ffb020]"
            }
          >
            {protocol.is_active
              ? "ACTIVE"
              : "DISABLED"}
          </span>
        </div>

        <p className="terminal-muted mt-1 text-xs">
          {protocol.category}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <ActionButton
          label="↑"
          title="Move up"
          onClick={onMoveUp}
          disabled={
            disabled ||
            !protocol.is_active
          }
        />

        <ActionButton
          label="↓"
          title="Move down"
          onClick={onMoveDown}
          disabled={
            disabled ||
            !protocol.is_active
          }
        />

        <ActionButton
          label="edit"
          title="Edit protocol"
          onClick={onEdit}
          disabled={disabled}
        />

        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          className={[
            "min-h-[44px] border px-3 text-xs transition disabled:cursor-not-allowed disabled:opacity-50",
            protocol.is_active
              ? "border-[#ffb020] text-[#ffb020]"
              : "border-[#39ff88] text-[#39ff88]",
          ].join(" ")}
        >
          {protocol.is_active
            ? "disable"
            : "restore"}
        </button>

        <span className="hidden min-h-[44px] items-center justify-center border border-[#242424] px-3 text-[10px] text-[#5a5a5a] sm:flex">
          {ROUTINE_LABELS[
            protocol.routine_type
          ]}
        </span>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  title,
  onClick,
  disabled,
}: {
  label: string;
  title: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="min-h-[44px] border border-[#242424] px-3 text-xs text-[#e5e5e5] transition hover:border-[#39ff88] hover:text-[#39ff88] disabled:cursor-not-allowed disabled:opacity-35"
    >
      {label}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="terminal-muted text-[10px] uppercase tracking-[0.14em]">
        {label}
      </span>

      <span className="mt-2 block">
        {children}
      </span>
    </label>
  );
}

function Metric({
  label,
  value,
  green = false,
  warning = false,
}: {
  label: string;
  value: string;
  green?: boolean;
  warning?: boolean;
}) {
  const valueClassName = green
    ? "terminal-green"
    : warning
      ? "text-[#ffb020]"
      : "text-[#e5e5e5]";

  return (
    <div className="border border-[#242424] bg-[#080808] p-3">
      <p className="terminal-muted text-[10px] uppercase tracking-[0.18em]">
        {label}
      </p>

      <p className={`mt-2 text-lg ${valueClassName}`}>
        {value}
      </p>
    </div>
  );
}

const inputClassName =
  "min-h-[48px] w-full border border-[#242424] bg-[#050505] px-3 text-sm text-[#e5e5e5] outline-none transition placeholder:text-[#555555] focus:border-[#39ff88]";

function mapRpcRow(
  row: ProtocolRpcRow
): ManagedProtocol {
  return {
    id: row.protocol_id,
    name: row.protocol_name,
    category: row.protocol_category,
    section: row.protocol_section,
    routine_type:
      row.protocol_routine_type,
    sort_order: Number(
      row.protocol_sort_order ?? 0
    ),
    is_active: Boolean(
      row.protocol_is_active
    ),
  };
}

function sortProtocols(
  protocols: ManagedProtocol[]
) {
  return [...protocols].sort((a, b) => {
    const routineDifference =
      ROUTINE_ORDER[a.routine_type] -
      ROUTINE_ORDER[b.routine_type];

    if (routineDifference !== 0) {
      return routineDifference;
    }

    if (a.sort_order !== b.sort_order) {
      return a.sort_order - b.sort_order;
    }

    return a.name.localeCompare(b.name);
  });
}