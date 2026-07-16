"use client";

import { useState } from "react";

type ModuleAccordionProps = {
  id: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
};

export function ModuleAccordion({
  id,
  title,
  subtitle,
  children,
  defaultOpen = false,
}: ModuleAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      id={id}
      className={
        open
          ? "border border-[#242424] bg-[#000000] md:col-span-2 xl:col-span-3"
          : "border border-[#242424] bg-[#000000]"
      }
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-4 border-b border-[#242424] bg-[#050505] px-4 py-3 text-left transition hover:bg-[#080808]"
      >
        <div className="min-w-0">
          <p className="terminal-green break-words text-xs uppercase tracking-[0.22em]">
            &gt; {title}
          </p>
          <p className="terminal-muted mt-1 break-words text-xs">{subtitle}</p>
        </div>

        <span className="terminal-green shrink-0 text-xs">
          {open ? "[ collapse ]" : "[ expand ]"}
        </span>
      </button>

      {open ? <div className="overflow-hidden">{children}</div> : null}
    </section>
  );
}