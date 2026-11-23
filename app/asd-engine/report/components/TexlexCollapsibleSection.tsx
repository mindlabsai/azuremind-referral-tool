"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { TexlexSectionHeading } from "./TexlexSectionHeading";

const STORAGE_PREFIX = "texlex.section-open.v2:";

export function clearTexlexSectionOpenState() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key && (key.startsWith("texlex.section-open.") || key.startsWith("texlex.assist-open."))) {
        keys.push(key);
      }
    }
    for (const key of keys) sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function TexlexCollapsibleSection({
  id,
  title,
  defaultOpen = false,
  children,
  className,
  headingClassName = "mb-0",
  actions,
}: {
  id: string;
  title: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
  headingClassName?: string;
  actions?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_PREFIX + id);
      if (raw === "0") setOpen(false);
      else if (raw === "1") setOpen(true);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [id]);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem(STORAGE_PREFIX + id, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <section
      id={id}
      className={cn(
        "overflow-hidden rounded-2xl border transition-[border-color,background-color,box-shadow]",
        open
          ? "border-[#4a6a8a] bg-[#152a40] shadow-[0_0_0_1px_rgba(159,195,242,0.12)]"
          : "border-[#2c455f]/55 bg-[#12263a]/35 hover:border-[#3d5874]",
        className
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2",
          open ? "border-b border-[#3d5874]/90 px-3.5 py-2.5 sm:px-4" : "px-3 py-2 sm:px-3.5"
        )}
      >
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={`${id}-body`}
          className="group flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <span
            className={cn(
              "inline-flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
              open
                ? "border-[#9fc3f2]/55 bg-[#1a3550] text-[#9fc3f2]"
                : "border-[#2c455f] bg-[#0f1f30] text-[#9fc3f2] group-hover:border-[#9fc3f2]/40"
            )}
            aria-hidden
          >
            {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </span>
          <TexlexSectionHeading
            className={cn(headingClassName, "[&_h2]:text-[24px] sm:[&_h2]:text-[26px]")}
          >
            {title}
          </TexlexSectionHeading>
          {hydrated ? (
            <span
              className={cn(
                "hidden rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] sm:inline",
                open ? "bg-[#1a3550] text-[#9fc3f2]" : "bg-[#0f1f30] text-[#6f859b]"
              )}
            >
              {open ? "Open" : "Closed"}
            </span>
          ) : null}
        </button>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div
        id={`${id}-body`}
        hidden={!open}
        className={cn(!open && "hidden", open && "space-y-3 px-3.5 py-3 sm:px-4")}
      >
        {children}
      </div>
    </section>
  );
}
