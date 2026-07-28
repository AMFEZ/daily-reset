"use client";

import {
  useId,
  useState,
  type ReactNode,
} from "react";

type SignalEntryDisclosureProps = {
  title: string;
  children: ReactNode;
  meta?: string;
  defaultOpen?: boolean;
};

export function SignalEntryDisclosure({
  title,
  children,
  meta,
  defaultOpen = false,
}: SignalEntryDisclosureProps) {
  const [isOpen, setIsOpen] =
    useState(defaultOpen);
  const contentId = useId();

  return (
    <article className="min-w-0 max-w-full overflow-hidden border-b border-[#242424] bg-[#050505] last:border-b-0">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => {
          setIsOpen((current) => !current);
        }}
        className="flex min-h-[54px] min-w-0 max-w-full cursor-pointer items-center justify-between gap-3 overflow-hidden px-3 py-3 text-left transition hover:bg-[#0d0d0d]"
      >
        <span className="min-w-0 flex-1">
          <span className="terminal-green block truncate text-xs">
            &gt; {title}
          </span>
        </span>

        <span className="flex min-w-0 shrink-0 items-center gap-2">
          {meta ? (
            <span className="terminal-muted max-w-[92px] truncate text-right text-[9px] sm:max-w-none sm:text-[10px]">
              {meta}
            </span>
          ) : null}

          <span className="terminal-muted text-[9px] uppercase tracking-[0.14em]">
            {isOpen ? "close" : "open"}
          </span>

          <span
            className={[
              "terminal-green text-lg transition-transform",
              isOpen ? "rotate-180" : "",
            ].join(" ")}
            aria-hidden="true"
          >
            ⌄
          </span>
        </span>
      </button>

      {isOpen ? (
        <div
          id={contentId}
          className="min-w-0 max-w-full overflow-hidden border-t border-[#242424] p-3 text-xs [&_*]:max-w-full"
        >

          {children}
        </div>
      ) : null}
    </article>
  );
}
