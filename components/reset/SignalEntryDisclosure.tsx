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
  preview?: string | null;
  defaultOpen?: boolean;
};

export function SignalEntryDisclosure({
  title,
  children,
  meta,
  preview,
  defaultOpen = false,
}: SignalEntryDisclosureProps) {
  const [isOpen, setIsOpen] =
    useState(defaultOpen);
  const contentId = useId();

  return (
    <article className="border-b border-[#242424] bg-[#050505] last:border-b-0">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => {
          setIsOpen((current) => !current);
        }}
        className="flex min-h-[58px] w-full cursor-pointer items-center justify-between gap-4 px-3 py-3 text-left transition hover:bg-[#0d0d0d]"
      >
        <span className="min-w-0 flex-1">
          <span className="terminal-green block truncate text-xs">
            &gt; {title}
          </span>

          {preview ? (
            <span className="terminal-muted mt-1 block truncate text-[10px] leading-5">
              {preview}
            </span>
          ) : null}
        </span>

        <span className="flex shrink-0 items-center gap-3">
          {meta ? (
            <span className="terminal-muted hidden text-right text-[10px] sm:block">
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
          className="border-t border-[#242424] p-3 text-xs"
        >
          {meta ? (
            <p className="terminal-muted mb-3 text-[10px] sm:hidden">
              {meta}
            </p>
          ) : null}

          {children}
        </div>
      ) : null}
    </article>
  );
}