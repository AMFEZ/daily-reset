"use client";

import { useState } from "react";

type ModuleAccordionProps = {
  id: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
};

export function ModuleAccordion({
  id,
  title,
  children,
  defaultOpen = false,
}: ModuleAccordionProps) {
  const [open, setOpen] =
    useState(defaultOpen);

  return (
    <section
      id={id}
      className={
        open
          ? "overflow-hidden border border-[#365341] bg-[#000000] shadow-[0_0_0_1px_rgba(57,255,136,0.04)] md:col-span-2 xl:col-span-3"
          : "overflow-hidden border border-[#2f4738] bg-[#000000]"
      }
    >
      <button
        type="button"
        onClick={() =>
          setOpen(
            (current) => !current
          )
        }
        aria-expanded={open}
        className="flex min-h-[58px] w-full items-center justify-between gap-4 border-b border-[#365341] bg-[linear-gradient(90deg,#07130b_0%,#050805_55%,#050505_100%)] px-4 py-3 text-left transition hover:bg-[#0a160e]"
      >
        <div className="min-w-0">
          <p className="terminal-green break-words text-base font-semibold tracking-[0.06em] sm:text-lg">
            &gt; {title}
          </p>
        </div>

        <span className="shrink-0 border border-[#365341] bg-black/40 px-2 py-1 text-[10px] text-[#9fd8b5]">
          {open ? "close" : "open"}
        </span>
      </button>

      {open ? (
        <div className="overflow-hidden bg-[#020302]">
          {children}
        </div>
      ) : null}
    </section>
  );
}
