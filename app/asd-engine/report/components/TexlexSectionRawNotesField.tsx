import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const RAW_NOTES_FIELD_CLASS =
  "texlex-raw-notes mb-[14px] rounded-[7px] border-l-2 border-l-[#D8D5CC] bg-[#fafcfc] px-3 py-2.5 text-[#1a2433]";

const RAW_NOTES_LABEL_CLASS =
  "mb-[3px] block text-[10px] font-medium uppercase tracking-[0.04em] text-[#5c6770]";

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
