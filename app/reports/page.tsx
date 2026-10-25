"use client";

import { useEffect, useMemo, useState } from "react";
import { TexlexScribe } from "@/app/asd-engine/report/components/TexlexScribe";

type ReportKind = "sld" | "general" | "forensic" | "paediatric" | "psychiatry";

const REPORTS: Array<{
  id: ReportKind;
  label: string;
  purpose: string;
  sections: string[];
}> = [
  {
    id: "sld",
    label: "SLD",
    purpose: "Specific learning disorder. You interpret the measures. Texlex drafts from the session.",
    sections: [
      "Reason for assessment",
      "Developmental and educational history",
      "Assessment measures",
      "Reading",
      "Written expression",
      "Mathematics",
      "Formulation",
      "Recommendations",
    ],
  },
  {
    id: "general",
    label: "General psychology",
    purpose: "A general psychology report. Opinion stays yours.",
    sections: [
      "Presenting concerns",
      "History",
      "Observations",
      "Formulation",
      "Opinion",
      "Recommendations",
    ],
  },
  {
    id: "forensic",
    label: "Forensic",
    purpose: "Answer only the questions in the instructions. State the limits of the opinion.",
    sections: [
      "Instructions",
      "Sources of information",
      "Background",
      "Interview",
      "Opinion",
      "Limitations",
    ],
  },
  {
    id: "paediatric",
    label: "Paediatric",
    purpose: "Paediatric review note for the shared pathway.",
    sections: ["Reason for review", "History", "Observations", "Impression", "Plan"],
  },
  {
    id: "psychiatry",
    label: "Psychiatry",
    purpose: "Psychiatry report. Risk and plan are clinician-written.",
    sections: [
      "Presenting concerns",
      "Psychiatric history",
      "Mental state",
      "Risk",
      "Formulation",
      "Plan",
    ],
  },
];

const SUBTITLE: Record<ReportKind, string> = {
  sld: "Specific Learning Disorder · SLD",
  general: "General psychology",
  forensic: "Forensic",
  paediatric: "Paediatric",
  psychiatry: "Psychiatry",
};

const STORAGE = "texlex-other-reports-v1";

type Draft = {
  clientName: string;
  sections: Record<string, string>;
};

function emptyDraft(kind: ReportKind): Draft {
  const spec = REPORTS.find((r) => r.id === kind)!;
  return {
    clientName: "",
    sections: Object.fromEntries(spec.sections.map((s) => [s, ""])),
  };
}

export default function OtherReportsPage() {
  const [kind, setKind] = useState<ReportKind>("sld");
  const [active, setActive] = useState(REPORTS[0]!.sections[0]!);
  const [drafts, setDrafts] = useState<Record<ReportKind, Draft>>(() => ({
    sld: emptyDraft("sld"),
    general: emptyDraft("general"),
    forensic: emptyDraft("forensic"),
    paediatric: emptyDraft("paediatric"),
    psychiatry: emptyDraft("psychiatry"),
  }));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Record<ReportKind, Draft>>;
        setDrafts((prev) => {
          const next = { ...prev };
          for (const report of REPORTS) {
            const saved = parsed[report.id];
            if (!saved || typeof saved !== "object") continue;
            next[report.id] = {
              clientName: typeof saved.clientName === "string" ? saved.clientName : "",
              sections: {
                ...emptyDraft(report.id).sections,
                ...(saved.sections ?? {}),
              },
            };
          }
          return next;
        });
      }
    } catch {
      /* keep empty drafts */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE, JSON.stringify(drafts));
  }, [drafts, ready]);

  const spec = useMemo(() => REPORTS.find((r) => r.id === kind)!, [kind]);
  const draft = drafts[kind];
  const body = draft.sections[active] ?? "";

  const setBody = (value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [kind]: {
        ...prev[kind],
        sections: { ...prev[kind].sections, [active]: value },
      },
    }));
  };

  return (
    <div className="report-desk texlex-surface min-h-screen bg-[#102033] px-8 pb-16 pt-8 text-[#f4f8fc]">
      <div className="mx-auto w-full max-w-[760px] text-left">
        <h1 className="report-title">New report</h1>
        <p className="report-subtitle">{SUBTITLE[kind]}</p>

        <div className="report-toolbar">
          <label className="report-client">
            Client
            <input
              value={draft.clientName}
              placeholder="Select client"
              onChange={(e) =>
                setDrafts((prev) => ({
                  ...prev,
                  [kind]: { ...prev[kind], clientName: e.target.value },
                }))
              }
            />
          </label>
          <div>
            <p className="report-kicker">Live scribe</p>
            <TexlexScribe
              onAppendToNotes={(text) => {
                const current = (drafts[kind].sections[active] ?? "").trim();
                setBody(current ? `${current}\n\n${text.trim()}` : text.trim());
              }}
            />
          </div>
        </div>

        <p className="report-kicker">Report</p>
        <div className="report-rail" role="radiogroup" aria-label="Report type">
          {REPORTS.map((report) => (
            <button
              key={report.id}
              type="button"
              role="radio"
              aria-checked={report.id === kind}
              onClick={() => {
                setKind(report.id);
                setActive(report.sections[0]!);
              }}
            >
              {report.label}
            </button>
          ))}
        </div>
        <p className="report-purpose">{spec.purpose}</p>

        <p className="report-kicker">Sections</p>
        <div className="report-rail report-rail-sections" role="radiogroup" aria-label="Sections">
          {spec.sections.map((section) => (
            <button
              key={section}
              type="button"
              role="radio"
              aria-checked={section === active}
              onClick={() => setActive(section)}
            >
              {section}
            </button>
          ))}
        </div>

        <main className="report-section">
          <h2>{active}</h2>
          <p>Write this section, or generate it from the live scribe.</p>
          <textarea
            className="report-editor"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            aria-label={active}
          />
        </main>
      </div>
    </div>
  );
}
