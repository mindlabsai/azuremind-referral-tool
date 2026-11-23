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
      { id: "patient-details", label: "Client details" },
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
      { id: "background-emotional-behavioural-sensory", label: "Emotional & sensory" },
    ],
  },
  {
    heading: "Clinical",
    items: [
      { id: "collateral", label: "Collateral" },
      { id: "criteria", label: "Young DIVA-5" },
      { id: "clinical-formulation", label: "Formulation" },
      { id: "recommendations", label: "Recommendations" },
      { id: "finalize-review", label: "Review" },
      { id: "texlex-send", label: "Send report" },
    ],
  },
];

const ALL_IDS: readonly string[] = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id));

function NavHeading({ children }: { children: string }) {
  return (
    <p
      className="px-0 pb-1 pt-3 text-[13px] font-medium uppercase tracking-[0.08em] text-[#6f859b]"
      aria-hidden
    >
      {children}
    </p>
  );
}

function NavLink({
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
        "block px-0 py-1.5 text-[17px] text-[#9eb2c6] transition-colors hover:text-[#f4f8fc]",
        isActive && "font-medium text-[#9fc3f2]"
      )}
    >
      {label}
    </a>
  );
}

export function AdhdReportSidebarNav() {
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
    <nav className="hidden w-52 shrink-0 xl:block" aria-label="Report sections">
      <div className="sticky top-16 max-h-[calc(100vh-5rem)] overflow-y-auto pr-2">
        {NAV_GROUPS.map((group, groupIndex) => (
          <div key={group.heading ?? "top-" + groupIndex}>
            {group.heading ? <NavHeading>{group.heading}</NavHeading> : null}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
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
