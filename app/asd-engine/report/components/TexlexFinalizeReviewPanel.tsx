"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AuditChecklistItem } from "@/lib/texlex-finalize-review/audit-checklist";
import type { ReviewFinding, ReviewRun } from "@/lib/texlex-finalize-review/types";
import { TEXLEX_SECTION_CONTAINER_CLASS, TEXLEX_SECTION_CONTENT_CLASS } from "../constants/texlexSectionSurface";

type Props = {
  runs: ReviewRun[];
  reviewing: boolean;
  error: string | null;
  onRunReview: () => void;
  onAccept: (findingId: string) => void;
  onReject: (findingId: string) => void;
  onApply: (finding: ReviewFinding) => void;
  finalPdfUnlocked: boolean;
  /** ASD AHPRA pre-audit checklist derived from draft + latest findings */
  auditChecklist?: AuditChecklistItem[] | null;
};

function severityLabel(sev: ReviewFinding["severity"]) {
  if (sev === "blocking") return "Blocking";
  if (sev === "major") return "Major";
  return "Minor";
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
  const openFindings = latest?.findings.filter((f) => f.status === "open") ?? [];
  const decided = latest?.findings.filter((f) => f.status !== "open") ?? [];

  return (
    <section id="finalize-review" className="scroll-mt-28">
      <Card
        className={cn(
          TEXLEX_SECTION_CONTAINER_CLASS,
          "border-[#B7E1DE] bg-gradient-to-b from-[#E8F6F5] to-white"
        )}
      >
        <CardContent className={cn(TEXLEX_SECTION_CONTENT_CLASS, "space-y-5")}>
          <div>
            <h2 className="text-[22px] font-extrabold tracking-tight text-[#075E63]">Review</h2>
            <p className="mt-1 text-[15px] text-[#5A6B6C]">
              Gate before Send report — flags only, no new clinical content. Clear blockers, then
              send; the PDF builds with the send.
            </p>
          </div>

          {auditChecklist && auditChecklist.length > 0 ? (
            <div className="space-y-3 rounded-lg border border-[#B7E1DE] bg-white/80 p-4">
              <p className="text-[13px] font-bold text-[#5A6B6C]">Checklist</p>
              <ul className="space-y-2">
                {auditChecklist.map((item) => (
                  <li key={item.id} className="flex gap-3 text-[15px]">
                    <span
                      className={cn(
                        "mt-0.5 shrink-0 font-mono text-sm",
                        item.ok ? "text-[#0F766E]" : "text-amber-700"
                      )}
                      aria-hidden
                    >
                      {item.ok ? "✓" : "○"}
                    </span>
                    <span>
                      <span className="font-semibold text-[#122022]">{item.label}</span>
                      <span className="mt-0.5 block text-[14px] text-[#5A6B6C]">{item.hint}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              className="h-11 rounded-lg bg-[#0E9F98] px-5 text-[15px] font-bold text-white hover:bg-[#075E63]"
              onClick={onRunReview}
              disabled={reviewing}
            >
              {reviewing ? "Reviewing…" : latest ? "Run review again" : "Run review"}
            </Button>
            {finalPdfUnlocked ? (
              <p className="text-[16px] font-semibold text-[#0F766E] underline decoration-[#B7E1DE] underline-offset-4">
                Ready to send
              </p>
            ) : (
              <p className="text-[16px] font-semibold text-[#5A6B6C]">
                Clear blockers before Send report
              </p>
            )}
            {latest ? (
              <span className="w-full text-[14px] text-[#5A6B6C] sm:w-auto">
                Pass {runs.length}: {latest.summary.blockingCount} blocking ·{" "}
                {latest.summary.majorCount} major · open blocking{" "}
                {latest.summary.openBlockingCount}
                {latest.modelUsed ? ` · ${latest.modelUsed}` : latest.llmSkipped ? " · deterministic only" : ""}
              </span>
            ) : null}
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {latest?.error ? (
            <p className="text-xs text-muted-foreground" role="status">
              Note: {latest.error}
            </p>
          ) : null}

          {!latest && !reviewing ? (
            <p className="text-sm text-muted-foreground">No review runs yet.</p>
          ) : null}

          {openFindings.length ? (
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Open findings
              </p>
              {openFindings.map((f) => (
                <div
                  key={f.id}
                  className="space-y-2 rounded-lg border border-border/70 bg-muted/15 p-3"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span
                      className={cn(
                        "text-[13px] font-bold",
                        f.severity === "blocking" ? "text-destructive" : "text-[#5A6B6C]"
                      )}
                    >
                      {severityLabel(f.severity)}
                    </span>
                    <span className="text-[13px] text-[#5A6B6C]">
                      {f.source} · {f.kind}
                    </span>
                    <span className="text-[16px] font-semibold text-foreground">{f.title}</span>
                    <span className="text-[13px] text-muted-foreground">{f.sectionId}</span>
                  </div>
                  <p className="text-[15px] text-foreground/90">{f.detail}</p>
                  {f.evidenceExcerpt ? (
                    <blockquote className="border-l-2 border-border pl-3 text-xs text-muted-foreground">
                      {f.evidenceExcerpt}
                    </blockquote>
                  ) : null}
                  {f.suggestedEdit ? (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Suggested: </span>
                      {f.suggestedEdit}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {f.applyHint ? (
                      <Button type="button" size="sm" onClick={() => onApply(f)}>
                        Apply fix
                      </Button>
                    ) : null}
                    <Button type="button" size="sm" variant="secondary" onClick={() => onAccept(f.id)}>
                      Accept (manual edit)
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => onReject(f.id)}>
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : latest ? (
            <p className="text-sm text-muted-foreground">No open findings on this pass.</p>
          ) : null}

          {decided.length ? (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">
                Decided on this pass ({decided.length})
              </summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                {decided.map((f) => (
                  <li key={f.id}>
                    [{f.status}] {f.title}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {runs.length > 1 ? (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">
                Review history ({runs.length} passes)
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {[...runs].reverse().map((r, i) => (
                  <li key={r.id}>
                    Pass {runs.length - i}: {new Date(r.createdAt).toLocaleString()} — blocking{" "}
                    {r.summary.blockingCount}, major {r.summary.majorCount}
                    {r.modelUsed ? ` · ${r.modelUsed}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
