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
    <div className={cn(className)}>
      <h2 className="m-0 text-[30px] font-semibold tracking-tight text-[#f4f8fc]">{children}</h2>
    </div>
  );
}
