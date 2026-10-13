"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

function severityBadge(sev: ReviewFinding["severity"]) {
  if (sev === "blocking") return <Badge variant="destructive">Blocking</Badge>;
  if (sev === "major") return <Badge variant="secondary">Major</Badge>;
  return <Badge variant="outline">Minor</Badge>;
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
    <section id="finalize-review">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Finalize review</h2>
        <span className="text-xs text-muted-foreground sm:text-right">
          Claude Opus · flags only · no new clinical content
        </span>
      </div>
      <Card className={TEXLEX_SECTION_CONTAINER_CLASS}>
        <CardContent className={cn(TEXLEX_SECTION_CONTENT_CLASS, "space-y-4")}>
          <p className="text-sm text-muted-foreground">
            Checks names, pronouns, severity opening, modality, dates, observation vs parent-report
            labelling, broader differentials, cognitive overclaim hedges, collateral gaps,
            limitations honesty, and major inconsistencies. Suggested edits align existing text
            only — nothing new is invented. Run again after you apply fixes.
          </p>

          {auditChecklist && auditChecklist.length > 0 ? (
            <div className="space-y-2 rounded-lg border border-border/70 bg-muted/10 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Pre-audit checklist
              </p>
              <ul className="space-y-1.5">
                {auditChecklist.map((item) => (
                  <li key={item.id} className="flex gap-2 text-sm">
                    <span
                      className={cn(
                        "mt-0.5 shrink-0 font-mono text-xs",
                        item.ok ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"
                      )}
                      aria-hidden
                    >
                      {item.ok ? "✓" : "○"}
                    </span>
                    <span>
                      <span className="text-foreground">{item.label}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{item.hint}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Checklist updates after each review pass. Clear blocking findings before Final PDF.
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={onRunReview} disabled={reviewing}>
              {reviewing ? "Reviewing…" : latest ? "Run review again" : "Run review"}
            </Button>
            {finalPdfUnlocked ? (
              <Badge variant="secondary">Blocking cleared — Final PDF unlocked</Badge>
            ) : (
              <Badge variant="outline">Clear blocking findings before Final PDF</Badge>
            )}
            {latest ? (
              <span className="text-xs text-muted-foreground">
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
                  <div className="flex flex-wrap items-center gap-2">
                    {severityBadge(f.severity)}
                    <Badge variant="outline">{f.source}</Badge>
                    <Badge variant="outline">{f.kind}</Badge>
                    <span className="text-sm font-medium text-foreground">{f.title}</span>
                    <span className="text-xs text-muted-foreground">{f.sectionId}</span>
                  </div>
                  <p className="text-sm text-foreground/90">{f.detail}</p>
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
