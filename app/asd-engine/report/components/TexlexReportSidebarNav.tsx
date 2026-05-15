"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type NavItem = { id: string; label: string };

type NavGroup = {
  heading?: string;
  items: readonly NavItem[];
};

const NAV_GROUPS: readonly NavGroup[] = [
  {
    items: [
      { id: "report-header", label: "Report header" },
      { id: "assessment-context", label: "Assessment context" },
      { id: "consent", label: "Consent" },
      { id: "patient-details", label: "Client details" },
      { id: "diagnostic-conclusion", label: "Diagnostic conclusion" },
      { id: "raw-notes", label: "Raw notes" },
      { id: "presenting-concerns", label: "Presenting concerns" },
    ],
  },
  {
    heading: "Background",
    items: [
      { id: "background-pregnancy-birth", label: "Pregnancy & birth" },
      { id: "background-early-development", label: "Early development" },
      { id: "background-educational-history", label: "Educational history" },
      {
        id: "background-emotional-behavioural-sensory",
        label: "Emotional, behavioural & sensory",
      },
    ],
  },
  {
    heading: "Evidence",
    items: [
      { id: "collateral", label: "Collateral" },
      { id: "dsm-criteria", label: "DSM-5-TR criteria" },
      { id: "functional-impact", label: "Functional impact" },
    ],
  },
  {
    heading: "Clinical",
    items: [
      { id: "formulation", label: "Formulation" },
      { id: "recommendations", label: "Recommendations" },
      { id: "limitations", label: "Limitations" },
      { id: "signature", label: "Signature" },
    ],
  },
];

function readHashSectionId(): string {
  if (typeof window === "undefined") return "";
  return window.location.hash.replace(/^#/, "");
}

function TexlexNavHeading({ children }: { children: string }) {
  return (
    <p
      className="px-3 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-[0.02em] text-[var(--text-4)]"
      aria-hidden
    >
      {children}
    </p>
  );
}

function TexlexNavLink({
  id,
  label,
  activeId,
}: {
  id: string;
  label: string;
  activeId: string;
}) {
  const isActive = activeId === id;
  return (
    <a
      href={`#${id}`}
      className={cn(
        "block rounded-md px-3 py-1.5 text-[13px] text-[var(--text-2)] transition-colors hover:bg-muted/50",
        isActive && "bg-[var(--teal-fill)] font-medium text-[var(--teal-text)]"
      )}
    >
      {label}
    </a>
  );
}

export function TexlexReportSidebarNav() {
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    const sync = () => setActiveId(readHashSectionId());
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  return (
    <nav className="hidden w-44 shrink-0 lg:block" aria-label="Report sections">
      <div className="sticky top-24">
        {NAV_GROUPS.map((group, groupIndex) => (
          <div key={group.heading ?? `top-${groupIndex}`}>
            {group.heading ? <TexlexNavHeading>{group.heading}</TexlexNavHeading> : null}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <TexlexNavLink key={item.id} id={item.id} label={item.label} activeId={activeId} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
