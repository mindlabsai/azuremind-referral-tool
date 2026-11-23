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
  onLocate: (finding: ReviewFinding) => boolean;
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
  "border-0 bg-transparent p-0 text-[16px] font-semibold text-[#f4f8fc] underline decoration-[#2c455f] underline-offset-4 hover:decoration-[#f4f8fc] disabled:cursor-not-allowed disabled:opacity-40";
const QUIET =
  "border-0 bg-transparent p-0 text-[16px] text-[#c5d4e4] hover:text-[#f4f8fc] disabled:cursor-not-allowed disabled:opacity-40";

function sectionLabel(sectionId: ReviewSectionId) {
  return SECTION_LABEL[sectionId] ?? sectionId;
}

export function TexlexFinalizeReviewPanel({
  runs,
  reviewing,
  error,
  onRunReview,
  onReject,
  onApply,
  onLocate,
  finalPdfUnlocked,
  auditChecklist,
}: Props) {
  const latest = runs.length ? runs[runs.length - 1]! : null;
  const universal = latest ? Boolean(latest.universalReviewV2) : true;
  const stillOpen =
    latest?.findings.filter((f) => f.status === "open" || f.status === "accepted") ?? [];
  const requiredOpen = stillOpen.filter((f) => f.severity === "blocking");
  const suggestions = stillOpen.filter((f) => f.severity !== "blocking");
  const fixed = latest?.findings.filter((f) => f.status === "resolved") ?? [];
  const leftAsIs = latest?.findings.filter((f) => f.status === "rejected") ?? [];
  const [fixNote, setFixNote] = useState<Record<string, "fixed" | "missed" | "unfound">>({});
  const [fixingId, setFixingId] = useState<string | null>(null);

  const headline = reviewing
    ? "Checking the requirements"
    : !latest
      ? "Review"
      : requiredOpen.length
        ? "Requirements not met"
        : "Requirements met";

  const sendLine = finalPdfUnlocked
    ? "Send is open."
    : latest && requiredOpen.length
      ? "Send stays closed until the required items are fixed."
      : "";

  return (
    <section id="finalize-review" className="scroll-mt-28 border-t border-[#2c455f] pt-8">
      <TexlexSectionHeading>Review</TexlexSectionHeading>
      {latest || reviewing ? (
        <p className="mt-3 max-w-[68ch] text-[26px] font-medium leading-snug tracking-tight text-[#f4f8fc]">
          {headline}
        </p>
      ) : (
        <p className="mt-3 max-w-[68ch] text-[17px] leading-relaxed text-[#c5d4e4]">
          Checks this draft against the report requirements, then suggests a fix where one is needed.
        </p>
      )}
      {latest && suggestions.length && !requiredOpen.length ? (
        <p className="mt-2 text-[16px] text-[#c5d4e4]">
          {suggestions.length === 1 ? "1 suggested fix." : `${suggestions.length} suggested fixes.`}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
        <button type="button" className={ACTION} onClick={onRunReview} disabled={reviewing}>
          {reviewing ? "Reviewing…" : latest ? "Review again" : "Review"}
        </button>
        {sendLine ? (
          <p className={cn("text-[14px]", finalPdfUnlocked ? "text-[#9bd6be]" : "text-[#c5d4e4]")}>{sendLine}</p>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 text-[14px] text-[#f0b4b4]" role="alert">
          {error}
        </p>
      ) : null}
      {latest?.error ? (
        <p className="mt-3 max-w-[68ch] text-[13px] text-[#c5d4e4]" role="status">
          {latest.error}
        </p>
      ) : null}

      {auditChecklist && auditChecklist.length > 0 && !universal ? (
        <ul className="mt-6 space-y-2 border-t border-[#2c455f] pt-4">
          {auditChecklist.map((item) => (
            <li key={item.id} className="text-[14px] text-[#c5d4e4]">
              <span className="text-[#f4f8fc]">{item.ok ? "Clear" : "Open"} · </span>
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}

      {stillOpen.length ? (
        <div className="mt-8 space-y-8">
          {stillOpen.map((finding) => {
            const prepared = engineApplyHint(finding);
            const suggestion = prepared?.replace?.trim() || finding.suggestedEdit?.trim() || "";
            return (
              <article key={finding.id} className="border-t border-[#2c455f] pt-5">
                <p className="text-[15px] text-[#c5d4e4]">
                  {finding.severity === "blocking" ? (
                    <span className="text-[#f0b4b4]">Required · </span>
                  ) : (
                    <span>Suggested fix · </span>
                  )}
                  {sectionLabel(finding.sectionId)}
                </p>
                <h3 className="mt-2 text-[18px] font-semibold text-[#f4f8fc]">{finding.title}</h3>
                <p className="mt-2 max-w-[68ch] text-[17px] leading-relaxed text-[#f4f8fc]">{finding.detail}</p>
                {suggestion ? (
                  <p className="mt-4 max-w-[68ch] text-[17px] leading-relaxed text-[#f4f8fc]">
                    <span className="block text-[13px] text-[#9eb2c6]">Suggested fix</span>
                    <span className="mt-1 block">{suggestion}</span>
                  </p>
                ) : null}
                {fixNote[finding.id] === "missed" ? (
                  <p className="mt-3 text-[14px] text-[#f0c593]">The draft was not changed.</p>
                ) : null}
                {fixNote[finding.id] === "unfound" ? (
                  <p className="mt-3 text-[14px] text-[#f0c593]">That wording is not in the draft.</p>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
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
                      {fixingId === finding.id ? "Updating…" : "Use this fix"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={QUIET}
                    onClick={() => {
                      const found = onLocate(finding);
                      setFixNote((prev) => {
                        const next = { ...prev };
                        if (found) delete next[finding.id];
                        else next[finding.id] = "unfound";
                        return next;
                      });
                    }}
                  >
                    Go to the line
                  </button>
                  <button type="button" className={QUIET} onClick={() => onReject(finding.id)}>
                    This is fine
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {fixed.length ? (
        <p className="mt-8 text-[15px] text-[#9bd6be]">
          {fixed.length === 1 ? "1 fix applied." : `${fixed.length} fixes applied.`}
        </p>
      ) : null}

      {leftAsIs.length ? (
        <p className="mt-3 text-[14px] text-[#9eb2c6]">
          {leftAsIs.length === 1 ? "1 item marked fine." : `${leftAsIs.length} items marked fine.`}
        </p>
      ) : null}
    </section>
  );
}
