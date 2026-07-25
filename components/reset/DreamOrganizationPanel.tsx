"use client";

import { useMemo, useState } from "react";

export type DreamIndexEntry = {
  id: string;
  title: string | null;
  content: string;
  mood: string | null;
  tags: string[] | null;
  raw_transcript: string | null;
  cleaned_transcript: string | null;
  created_at: string;
};

export function DreamOrganizationPanel({
  initialEntries,
}: {
  initialEntries: DreamIndexEntry[];
}) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("all");
  const [sort, setSort] = useState<
    "newest" | "oldest"
  >("newest");

  const tags = useMemo(
    () =>
      Array.from(
        new Set(
          initialEntries.flatMap(
            (entry) => entry.tags ?? []
          )
        )
      ).sort((a, b) => a.localeCompare(b)),
    [initialEntries]
  );

  const filtered = useMemo(() => {
    const normalized = query
      .trim()
      .toLowerCase();

    return [...initialEntries]
      .filter((entry) => {
        const haystack = [
          entry.title,
          entry.content,
          entry.mood,
          entry.raw_transcript,
          entry.cleaned_transcript,
          ...(entry.tags ?? []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchesQuery =
          !normalized ||
          haystack.includes(normalized);
        const matchesTag =
          tag === "all" ||
          (entry.tags ?? []).includes(tag);

        return matchesQuery && matchesTag;
      })
      .sort((a, b) =>
        sort === "newest"
          ? b.created_at.localeCompare(
              a.created_at
            )
          : a.created_at.localeCompare(
              b.created_at
            )
      );
  }, [initialEntries, query, sort, tag]);

  const hasActiveFilters = query.trim().length > 0 || tag !== "all" || sort !== "newest";

  const recurringTags = useMemo(() => {
    const counts = new Map<string, number>();

    initialEntries.forEach((entry) => {
      (entry.tags ?? []).forEach((item) => {
        counts.set(
          item,
          (counts.get(item) ?? 0) + 1
        );
      });
    });

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [initialEntries]);

  return (
    <section className="border border-[#242424] bg-black">
      <div className="border-b border-[#242424] bg-[#050505] px-3 py-2">
        <p className="terminal-green text-xs uppercase tracking-[0.2em]">
          &gt; dream.index
        </p>
      </div>

      <div className="p-3">
        <div className="grid gap-2 md:grid-cols-[1fr_180px_140px_auto]">
          <input
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
            placeholder="Search dreams, people, places, symbols..."
            className="min-h-[48px] border border-[#242424] bg-black px-3 text-sm text-[#e5e5e5] outline-none focus:border-[#39ff88]"
          />

          <select
            value={tag}
            onChange={(event) =>
              setTag(event.target.value)
            }
            className="min-h-[48px] border border-[#242424] bg-black px-3 text-sm text-[#e5e5e5]"
          >
            <option value="all">All tags</option>
            {tags.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(event) =>
              setSort(
                event.target.value as
                  | "newest"
                  | "oldest"
              )
            }
            className="min-h-[48px] border border-[#242424] bg-black px-3 text-sm text-[#e5e5e5]"
          >
            <option value="newest">
              Newest
            </option>
            <option value="oldest">
              Oldest
            </option>
          </select>

          <button
            type="button"
            disabled={!hasActiveFilters}
            onClick={() => {
              setQuery("");
              setTag("all");
              setSort("newest");
            }}
            className="min-h-[48px] border border-[#242424] bg-black px-3 text-xs text-[#39ff88] disabled:cursor-not-allowed disabled:opacity-40"
          >
            reset
          </button>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Signal
            label="TOTAL DREAMS"
            value={String(initialEntries.length)}
          />
          <Signal
            label="MATCHES"
            value={String(filtered.length)}
          />
          <Signal
            label="UNIQUE TAGS"
            value={String(tags.length)}
          />
        </div>

        {recurringTags.length > 0 ? (
          <div className="mt-3 border border-[#242424] bg-[#050505] p-3">
            <p className="terminal-muted text-[11px] uppercase tracking-[0.18em]">
              Recurring signals
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {recurringTags.map(
                ([item, count]) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setTag(item)}
                    className="border border-[#242424] bg-black px-2 py-1 text-xs text-[#39ff88]"
                  >
                    {item} ({count})
                  </button>
                )
              )}
            </div>
          </div>
        ) : null}

        <div className="mt-4 max-h-[520px] overflow-y-auto border border-[#242424]">
          {filtered.length > 0 ? (
            filtered.map((entry) => (
              <details
                key={entry.id}
                className="terminal-line"
              >
                <summary className="cursor-pointer list-none p-3 [&::-webkit-details-marker]:hidden">
                  <div className="flex items-center justify-between gap-3">
                    <span className="terminal-green">
                      {entry.title ||
                        "Untitled Dream"}
                    </span>
                    <span className="terminal-muted text-xs">
                      {new Date(
                        entry.created_at
                      ).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  <p className="terminal-muted mt-2 line-clamp-2 text-xs leading-5">
                    {entry.content ||
                      entry.cleaned_transcript ||
                      entry.raw_transcript ||
                      "Audio-only dream signal."}
                  </p>
                </summary>

                <div className="border-t border-[#242424] p-3">
                  <p className="whitespace-pre-wrap text-xs leading-6 text-[#e5e5e5]">
                    {entry.content ||
                      entry.cleaned_transcript ||
                      entry.raw_transcript ||
                      "Audio-only dream signal."}
                  </p>

                  {(entry.tags ?? []).length >
                  0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(entry.tags ?? []).map(
                        (item) => (
                          <span
                            key={item}
                            className="border border-[#242424] px-2 py-1 text-xs text-[#39ff88]"
                          >
                            {item}
                          </span>
                        )
                      )}
                    </div>
                  ) : null}
                </div>
              </details>
            ))
          ) : (
            <p className="terminal-muted p-3 text-xs">
              &gt; No dream signals match.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function Signal({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border border-[#242424] bg-[#050505] p-3" aria-live="polite">
      <p className="terminal-muted text-[10px] uppercase tracking-[0.16em]">
        {label}
      </p>
      <p className="terminal-green mt-2 text-lg">
        {value}
      </p>
    </div>
  );
}
