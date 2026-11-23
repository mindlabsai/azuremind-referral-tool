"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_PREFIX = "texlex.assist-open.v1:";

export function AssistCollapse({
  id,
  title,
  defaultOpen = false,
  children,
  className,
}: {
  id: string;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_PREFIX + id);
      if (raw === "0") setOpen(false);
      else if (raw === "1") setOpen(true);
    } catch {
      /* ignore */
    }
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
    <div className={cn("rounded-xl border border-[#2c455f] bg-[#12263a]/70", className)}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left"
      >
        <span className="text-[15px] font-semibold text-[#eaf1f8]">{title}</span>
        <span className="inline-flex size-7 items-center justify-center rounded-md border border-[#2c455f] text-[#9fc3f2]">
          {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </span>
      </button>
      {open ? <div className="border-t border-[#2c455f] px-3.5 pb-3.5 pt-3">{children}</div> : null}
    </div>
  );
}
