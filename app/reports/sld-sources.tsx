"use client";

import { ADHD_CRITERIA, deriveAdhdPresentation } from "@/app/asd-engine/adhd-engine-core";
import { readFileAsBase64 } from "@/lib/collateral/collateral-docs-client";
import type { SldAreaMark, SldCriterionMark, SldDivaState } from "@/lib/prompts/sld-section";

export type SldPdf = {
  id: string;
  filename: string;
  size: number;
  role: "wiat" | "vanderbilt";
  data: string;
};

const AREAS: Array<{ key: "reading" | "writtenExpression" | "mathematics"; label: string }> = [
  { key: "reading", label: "Reading" },
  { key: "writtenExpression", label: "Written expression" },
  { key: "mathematics", label: "Mathematics" },
];

const AREA_OPTIONS: Array<{ id: SldAreaMark; label: string }> = [
  { id: "indicated", label: "Indicated" },
  { id: "not-indicated", label: "Not indicated" },
  { id: "unset", label: "Unset" },
];

function ageYears(dob: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const born = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const month = now.getMonth() - born.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < born.getDate())) age -= 1;
  return age > 0 ? age : null;
}

function Choice({
  pressed,
  label,
  onClick,
}: {
  pressed: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" aria-pressed={pressed} className="report-choice" onClick={onClick}>
      {label}
    </button>
  );
}

export function SldSources({
  dob,
  rawNotes,
  adhdInScope,
  divaState,
  criteria,
  areas,
  severity,
  pdfs,
  onNotes,
  onAdhdInScope,
  onDiva,
  onCriterion,
  onArea,
  onSeverity,
  onPdfs,
}: {
  dob: string;
  rawNotes: string;
  adhdInScope: boolean;
  divaState: SldDivaState;
  criteria: Record<string, SldCriterionMark>;
  areas: { reading: SldAreaMark; writtenExpression: SldAreaMark; mathematics: SldAreaMark };
  severity: string;
  pdfs: SldPdf[];
  onNotes: (value: string) => void;
  onAdhdInScope: (value: boolean) => void;
  onDiva: (value: SldDivaState) => void;
  onCriterion: (code: string, value: SldCriterionMark) => void;
  onArea: (key: "reading" | "writtenExpression" | "mathematics", value: SldAreaMark) => void;
  onSeverity: (value: string) => void;
  onPdfs: (next: SldPdf[]) => void;
}) {
  const years = ageYears(dob);
  const inattention = ADHD_CRITERIA.filter((item) => item.criterionGroup === "IA");
  const hyperactivity = ADHD_CRITERIA.filter((item) => item.criterionGroup === "HI");
  const iaMet = inattention.filter((item) => criteria[item.code] === "met").length;
  const hiMet = hyperactivity.filter((item) => criteria[item.code] === "met").length;
  const derived =
    years == null ? null : deriveAdhdPresentation(iaMet, hiMet, years);

  const addFiles = async (role: "wiat" | "vanderbilt", list: FileList | null) => {
    if (!list?.length) return;
    const accepted = Array.from(list).filter(
      (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    );
    if (accepted.length === 0) return;
    const encoded: SldPdf[] = [];
    for (const file of accepted) {
      const data = await readFileAsBase64(file);
      encoded.push({
        id: `${role}-${file.name}-${file.size}-${file.lastModified}`,
        filename: file.name,
        size: file.size,
        role,
        data,
      });
    }
    if (role === "wiat") {
      onPdfs([...pdfs.filter((file) => file.role !== "wiat"), encoded[encoded.length - 1]!]);
      return;
    }
    const seen = new Set(pdfs.map((file) => file.id));
    onPdfs([...pdfs, ...encoded.filter((file) => !seen.has(file.id))]);
  };

  return (
    <section className="report-sources" aria-label="SLD sources">
      <p className="report-kicker">Raw notes</p>
      <textarea
        className="report-editor report-notes"
        value={rawNotes}
        onChange={(event) => onNotes(event.target.value)}
        placeholder="Paste the session notes. The scribe adds to this box."
        aria-label="Raw clinical notes"
      />

      <p className="report-kicker">Documents</p>
      <div className="report-uploads">
        <label className="report-upload">
          WIAT score report
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => {
              void addFiles("wiat", event.target.files);
              event.target.value = "";
            }}
          />
          <span>Pearson Q-global PDF. Scores in the reading, writing, and mathematics sections come from this file.</span>
        </label>
        <label className="report-upload">
          Vanderbilt
          <input
            type="file"
            accept="application/pdf,.pdf"
            multiple
            onChange={(event) => {
              void addFiles("vanderbilt", event.target.files);
              event.target.value = "";
            }}
          />
          <span>Parent and teacher forms. A teacher form completed by a parent is a repeat parent rating.</span>
        </label>
      </div>
      {pdfs.length > 0 ? (
        <ul className="report-files">
          {pdfs.map((file) => (
            <li key={file.id}>
              <span>
                {file.role === "wiat" ? "WIAT" : "Vanderbilt"} · {file.filename} ·{" "}
                {Math.max(1, Math.round(file.size / 1024))} KB
              </span>
              <button type="button" onClick={() => onPdfs(pdfs.filter((item) => item.id !== file.id))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="report-file-note">Attached files stay for this session. They are not saved in the browser.</p>

      <p className="report-kicker">Skill areas</p>
      <p className="report-file-note">These marks are the diagnosis. The WIAT report does not set them.</p>
      {AREAS.map((area) => (
        <div key={area.key} className="report-row">
          <span>{area.label}</span>
          <div>
            {AREA_OPTIONS.map((option) => (
              <Choice
                key={option.id}
                pressed={areas[area.key] === option.id}
                label={option.label}
                onClick={() => onArea(area.key, option.id)}
              />
            ))}
          </div>
        </div>
      ))}
      <label className="report-client report-severity">
        Severity stated
        <input
          value={severity}
          placeholder="Only if you are stating it"
          onChange={(event) => onSeverity(event.target.value)}
        />
      </label>

      <p className="report-kicker">Young DIVA-5</p>
      <label className="report-check">
        <input
          type="checkbox"
          checked={adhdInScope}
          onChange={(event) => onAdhdInScope(event.target.checked)}
        />
        ADHD is part of this assessment
      </label>
      {adhdInScope ? (
        <div className="report-diva">
          <div className="report-row">
            <span>
              {derived
                ? `${derived.presentation ?? "Below threshold"} · IA ${iaMet}/9 · HI ${hiMet}/9 · threshold ${derived.threshold}`
                : "Enter the date of birth to derive the presentation."}
            </span>
          </div>
          <div className="report-row">
            <span>Young DIVA-5 gate</span>
            <div>
              {(
                [
                  ["positive", "Positive"],
                  ["negative", "Negative"],
                  ["not-administered", "Not administered"],
                ] as const
              ).map(([id, label]) => (
                <Choice
                  key={id}
                  pressed={divaState === id}
                  label={label}
                  onClick={() => onDiva(id)}
                />
              ))}
            </div>
          </div>
          <h3>Inattention</h3>
          {inattention.map((item) => (
            <div key={item.code} className="report-row">
              <span>
                <strong>{item.code}</strong> {item.criterion}
              </span>
              <div>
                {(
                  [
                    ["met", "Met"],
                    ["not-met", "Not met"],
                    ["unset", "Unset"],
                  ] as const
                ).map(([id, label]) => (
                  <Choice
                    key={id}
                    pressed={(criteria[item.code] ?? "unset") === id}
                    label={label}
                    onClick={() => onCriterion(item.code, id)}
                  />
                ))}
              </div>
            </div>
          ))}
          <h3>Hyperactivity / impulsivity</h3>
          {hyperactivity.map((item) => (
            <div key={item.code} className="report-row">
              <span>
                <strong>{item.code}</strong> {item.criterion}
              </span>
              <div>
                {(
                  [
                    ["met", "Met"],
                    ["not-met", "Not met"],
                    ["unset", "Unset"],
                  ] as const
                ).map(([id, label]) => (
                  <Choice
                    key={id}
                    pressed={(criteria[item.code] ?? "unset") === id}
                    label={label}
                    onClick={() => onCriterion(item.code, id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="report-file-note">
          A Specific Learning Disorder assessment leaves this closed. Open it for a combined ADHD assessment.
        </p>
      )}
    </section>
  );
}

export function sldPresentation(
  dob: string,
  criteria: Record<string, SldCriterionMark>
): { threshold: number | null; presentation: string | null; inattentionMet: number; hyperactivityMet: number } {
  const years = ageYears(dob);
  const inattentionMet = ADHD_CRITERIA.filter(
    (item) => item.criterionGroup === "IA" && criteria[item.code] === "met"
  ).length;
  const hyperactivityMet = ADHD_CRITERIA.filter(
    (item) => item.criterionGroup === "HI" && criteria[item.code] === "met"
  ).length;
  if (years == null) {
    return { threshold: null, presentation: null, inattentionMet, hyperactivityMet };
  }
  const derived = deriveAdhdPresentation(inattentionMet, hyperactivityMet, years);
  return {
    threshold: derived.threshold,
    presentation: derived.presentation,
    inattentionMet,
    hyperactivityMet,
  };
}
