import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const RAW_NOTES_FIELD_CLASS =
  "mb-[14px] rounded-[7px] border-l-2 border-l-[#D8D5CC] bg-[var(--bg-input)] px-3 py-2.5";

const RAW_NOTES_LABEL_CLASS =
  "mb-[3px] block text-[10px] font-medium uppercase tracking-[0.04em] text-[var(--text-4)]";

export function TexlexSectionRawNotesField({
  children,
  label = "Raw notes for this section (optional)",
  className,
}: {
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn(RAW_NOTES_FIELD_CLASS, className)}>
      <label className="block">
        <span className={RAW_NOTES_LABEL_CLASS}>{label}</span>
        {children}
      </label>
    </div>
  );
}
