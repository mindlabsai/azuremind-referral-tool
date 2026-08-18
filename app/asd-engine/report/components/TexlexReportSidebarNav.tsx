"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type NavItem = { id: string; label: string };
type NavGroup = { heading?: string; items: readonly NavItem[] };

const NAV_GROUPS: readonly NavGroup[] = [
  {
    items: [
      { id: "cliniko-calendar", label: "Cliniko calendar" },
      { id: "scribe", label: "Scribe" },
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
      { id: "background-emotional-behavioural-sensory", label: "Emotional, behavioural & sensory" },
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

const ALL_IDS: readonly string[] = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id));

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
  onJump,
}: {
  id: string;
  label: string;
  activeId: string;
  onJump: (id: string) => void;
}) {
  const isActive = activeId === id;
  return (
    <a
      href={"#" + id}
      onClick={(e) => {
        e.preventDefault();
        onJump(id);
      }}
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
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible.set(entry.target.id, entry.intersectionRatio);
          } else {
            visible.delete(entry.target.id);
          }
        }
        let best = "";
        let bestTop = Infinity;
        for (const id of visible.keys()) {
          const el = document.getElementById(id);
          if (!el) continue;
          const top = Math.abs(el.getBoundingClientRect().top - 120);
          if (top < bestTop) {
            bestTop = top;
            best = id;
          }
        }
        if (best) setActiveId(best);
      },
      { rootMargin: "-100px 0px -60% 0px", threshold: [0, 0.25, 0.5, 1] }
    );

    for (const id of ALL_IDS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const handleJump = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveId(id);
      history.replaceState(null, "", "#" + id);
    }
  };

  return (
    <nav className="hidden w-44 shrink-0 lg:block" aria-label="Report sections">
      <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
        {NAV_GROUPS.map((group, groupIndex) => (
          <div key={group.heading ?? "top-" + groupIndex}>
            {group.heading ? <TexlexNavHeading>{group.heading}</TexlexNavHeading> : null}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <TexlexNavLink
                  key={item.id}
                  id={item.id}
                  label={item.label}
                  activeId={activeId}
                  onJump={handleJump}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
