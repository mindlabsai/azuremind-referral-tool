import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function TexlexSectionHeading({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-[10px]", className)}>
      <span
        className="h-[14px] w-[3px] shrink-0 rounded-[2px] bg-[var(--teal-line)]"
        aria-hidden
      />
      <h2 className="m-0 text-[22px] font-extrabold tracking-tight text-[#075E63]">{children}</h2>
    </div>
  );
}
