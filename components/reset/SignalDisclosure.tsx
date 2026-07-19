"use client";

import {
  useId,
  useState,
  type ReactNode,
} from "react";

type SignalDisclosureProps = {
  title: string;
  children: ReactNode;
  count?: number;
  summary?: string;
  defaultOpen?: boolean;
};

export function SignalDisclosure({
  title,
  children,
  count,
  summary,
  defaultOpen = false,
}: SignalDisclosureProps) {
  const [isOpen, setIsOpen] =
    useState(defaultOpen);
  const generatedId = useId();
  const contentId =
    `signal-disclosure-${generatedId.replace(/:/g, "")}`;

  return (
    <section className="border border-[#242424] bg-[#050505]">
      <button
        type="button"
        onClick={() =>
          setIsOpen((current) => !current)
        }
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="flex min-h-[52px] w-full items-center justify-between gap-4 bg-[#0d0d0d] px-3 py-3 text-left transition hover:bg-[#111111]"
      >
        <span className="min-w-0">
          <span className="terminal-green block break-words text-xs uppercase tracking-[0.18em]">
            &gt; {title}
          </span>

          {summary ? (
            <span className="terminal-muted mt-1 block text-[10px] leading-5">
              {summary}
            </span>
          ) : null}
        </span>

        <span className="flex shrink-0 items-center gap-3">
          {typeof count === "number" ? (
            <span className="border border-[#242424] px-2 py-1 text-[9px] text-[#8a8a8a]">
              {count}
            </span>
          ) : null}

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
          className="border-t border-[#242424] p-3"
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}
