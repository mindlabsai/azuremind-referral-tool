"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { AuditChecklistItem } from "@/lib/texlex-finalize-review/audit-checklist";
import type { ReviewFinding, ReviewRun, ReviewSectionId } from "@/lib/texlex-finalize-review/types";
import { engineApplyHint } from "@/lib/texlex-finalize-review/apply-minimal";
import { TexlexSectionHeading } from "./TexlexSectionHeading";

type Props = {
  runs: ReviewRun[];
  reviewing: boolean;
  error: string | null;
  onRunReview: () => void;
  onAccept: (findingId: string) => void;
  onReject: (findingId: string) => void;
  onApply: (finding: ReviewFinding) => boolean | Promise<boolean>;
  finalPdfUnlocked: boolean;
  /** Shown only when a pass was produced by the previous phrase checks. */
  auditChecklist?: AuditChecklistItem[] | null;
};

const SECTION_LABEL: Record<ReviewSectionId, string> = {
  "presenting-concerns": "Presenting concerns",
  "background-pregnancy-birth": "Pregnancy and birth",
  "background-early-development": "Early development",
  "background-educational-history": "Educational history",
  "background-emotional-behavioural-sensory": "Emotional, behavioural and sensory",
  collateral: "Collateral",
  "criterion-A1": "Criterion A1",
  "criterion-A2": "Criterion A2",
  "criterion-A3": "Criterion A3",
  "criterion-B1": "Criterion B1",
  "criterion-B2": "Criterion B2",
  "criterion-B3": "Criterion B3",
  "criterion-B4": "Criterion B4",
  "criterion-C": "Criterion C",
  "criterion-D": "Criterion D",
  "criterion-E": "Criterion E",
  "functional-impact": "Functional impact",
  "clinical-formulation": "Clinical formulation",
  recommendations: "Recommendations",
  limitations: "Limitations",
  "patient-details": "Client details",
};

const ACTION =
  "border-0 bg-transparent p-0 text-[14px] font-semibold text-[#9fc3f2] hover:text-[#eaf1f8] disabled:cursor-not-allowed disabled:opacity-40";
const QUIET =
  "border-0 bg-transparent p-0 text-[14px] text-[#849aaf] hover:text-[#eaf1f8] disabled:cursor-not-allowed disabled:opacity-40";

function severityLabel(sev: ReviewFinding["severity"]) {
  if (sev === "blocking") return "Blocking";
  if (sev === "major") return "Worth checking";
  return "Optional";
}

function sectionLabel(sectionId: ReviewSectionId) {
  return SECTION_LABEL[sectionId] ?? sectionId;
}

function sectionAnchor(sectionId: ReviewSectionId) {
  if (sectionId === "clinical-formulation") return "clinical-formulation";
  return sectionId;
}

export function TexlexFinalizeReviewPanel({
  runs,
  reviewing,
  error,
  onRunReview,
  onAccept,
  onReject,
  onApply,
  finalPdfUnlocked,
  auditChecklist,
}: Props) {
  const latest = runs.length ? runs[runs.length - 1]! : null;
  const universal = latest ? Boolean(latest.universalReviewV2) : true;
  const openFindings =
    latest?.findings.filter((f) => f.status === "open" || f.status === "accepted" || f.status === "resolved") ??
    [];
  const decided = latest?.findings.filter((f) => f.status === "rejected") ?? [];
  const [fixNote, setFixNote] = useState<Record<string, "fixed" | "missed">>({});
  const [fixingId, setFixingId] = useState<string | null>(null);

  const headline = reviewing
    ? "Reading this draft"
    : latest
      ? openFindings.length
        ? latest.display || `${openFindings.length} items worth checking`
        : latest.display || "No material issues found in the material available"
      : "Review this draft before Send";

  const sendLine = finalPdfUnlocked
    ? "Send report is open."
    : latest
      ? "Send report stays closed while a blocking item is open."
      : "Send report stays closed until Review is clear.";

  return (
    <section id="finalize-review" className="scroll-mt-28 border-t border-[#23384d] pt-8">
      <TexlexSectionHeading>Review</TexlexSectionHeading>
      <p className="mt-3 max-w-[68ch] text-[20px] font-medium leading-snug tracking-tight text-[#eaf1f8]">
        {headline}
      </p>
      <p className="mt-2 max-w-[68ch] text-[14px] leading-relaxed text-[#849aaf]">
        {universal
          ? "Apply to draft writes a prepared passage into that section. Edit myself leaves the wording with you. Keep as is leaves the passage."
          : "Fix writes the Texlex alternative into that section. Accept leaves the wording for you to edit. Reject leaves the passage as it is."}
      </p>
      {universal && latest?.sourceCoverage ? (
        <p className="mt-3 max-w-[68ch] text-[13px] leading-relaxed text-[#627b95]">{latest.sourceCoverage}</p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
        <button type="button" className={ACTION} onClick={onRunReview} disabled={reviewing}>
          {reviewing ? "Reviewing…" : latest ? "Run review again" : "Run review"}
        </button>
        <p className={cn("text-[14px]", finalPdfUnlocked ? "text-[#9bd6be]" : "text-[#849aaf]")}>{sendLine}</p>
      </div>

      {error ? (
        <p className="mt-4 text-[14px] text-[#f0b4b4]" role="alert">
          {error}
        </p>
      ) : null}
      {latest?.error ? (
        <p className="mt-3 max-w-[68ch] text-[13px] text-[#849aaf]" role="status">
          {latest.error}
        </p>
      ) : null}

      {auditChecklist && auditChecklist.length > 0 && !universal ? (
        <ul className="mt-6 space-y-2 border-t border-[#23384d] pt-4">
          {auditChecklist.map((item) => (
            <li key={item.id} className="text-[14px] text-[#849aaf]">
              <span className="text-[#eaf1f8]">{item.ok ? "Clear" : "Open"} · </span>
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}

      {openFindings.length ? (
        <div className="mt-8 space-y-8">
          {openFindings.map((finding) => {
            const prepared = engineApplyHint(finding);
            const applied = finding.status === "resolved" || fixNote[finding.id] === "fixed";
            return (
              <article key={finding.id} className="border-t border-[#23384d] pt-5">
                <p className="text-[12px] uppercase tracking-[0.14em] text-[#627b95]">
                  <span className={finding.severity === "blocking" ? "text-[#f0b4b4]" : "text-[#f0c593]"}>
                    {severityLabel(finding.severity)}
                  </span>
                  <span className="text-[#627b95]"> · {sectionLabel(finding.sectionId)}</span>
                </p>
                <h3 className="mt-2 text-[16px] font-semibold text-[#eaf1f8]">{finding.title}</h3>
                <p className="mt-2 max-w-[68ch] text-[15px] leading-relaxed text-[#b6c6d8]">{finding.detail}</p>
                {finding.evidenceExcerpt ? (
                  <p className="mt-4 max-w-[68ch] text-[14px] leading-relaxed text-[#849aaf]">
                    <span className="block text-[12px] uppercase tracking-[0.14em] text-[#627b95]">In the draft</span>
                    <span className="mt-1 block">{finding.evidenceExcerpt}</span>
                  </p>
                ) : null}
                {prepared ? (
                  <p className="mt-4 max-w-[68ch] text-[14px] leading-relaxed text-[#eaf1f8]">
                    <span className="block text-[12px] uppercase tracking-[0.14em] text-[#627b95]">
                      Prepared passage
                    </span>
                    <span className="mt-1 block">{prepared.replace}</span>
                  </p>
                ) : finding.suggestedEdit ? (
                  <p className="mt-4 max-w-[68ch] text-[14px] leading-relaxed text-[#849aaf]">
                    {finding.suggestedEdit}
                  </p>
                ) : (
                  <p className="mt-4 text-[14px] text-[#627b95]">No prepared passage for this item.</p>
                )}

                {applied ? (
                  <p className="mt-4 text-[14px] text-[#9bd6be]">Applied. This section was updated.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {finding.status === "accepted" ? (
                      <p className="text-[14px] text-[#b6c6d8]">
                        Left for you to edit. A blocking item still keeps Send closed.
                      </p>
                    ) : null}
                    {fixNote[finding.id] === "missed" ? (
                      <p className="text-[14px] text-[#f0c593]">
                        Not changed. That wording was not found in this section.
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                      {prepared ? (
                        <button
                          type="button"
                          className={ACTION}
                          disabled={fixingId === finding.id}
                          onClick={() => {
                            setFixingId(finding.id);
                            void Promise.resolve(onApply(finding))
                              .then((wrote) => {
                                setFixNote((prev) => ({ ...prev, [finding.id]: wrote ? "fixed" : "missed" }));
                              })
                              .finally(() => setFixingId(null));
                          }}
                        >
                          {fixingId === finding.id ? "Applying…" : universal ? "Apply to draft" : "Fix"}
                        </button>
                      ) : null}
                      <button type="button" className={QUIET} onClick={() => onAccept(finding.id)}>
                        {universal ? "Edit myself" : "Accept"}
                      </button>
                      <button type="button" className={QUIET} onClick={() => onReject(finding.id)}>
                        {universal ? "Keep as is" : "Reject"}
                      </button>
                      <a href={`#${sectionAnchor(finding.sectionId)}`} className={QUIET}>
                        Go to section
                      </a>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : null}

      {decided.length ? (
        <details className="mt-8 border-t border-[#23384d] pt-4 text-[14px] text-[#849aaf]">
          <summary className="cursor-pointer">Kept as is ({decided.length})</summary>
          <ul className="mt-3 space-y-1">
            {decided.map((finding) => (
              <li key={finding.id}>
                {sectionLabel(finding.sectionId)} — {finding.title}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {runs.length > 1 ? (
        <details className="mt-4 text-[13px] text-[#627b95]">
          <summary className="cursor-pointer">Earlier passes ({runs.length - 1})</summary>
          <ul className="mt-2 space-y-1">
            {[...runs].slice(0, -1).reverse().map((run, index) => (
              <li key={run.id}>
                Pass {runs.length - 1 - index}: {run.display || `${run.summary.openBlockingCount} blocking still open`}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
