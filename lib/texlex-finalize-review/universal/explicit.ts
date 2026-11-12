import type { ReviewFinding, ReviewSectionInput } from "../types";
import { newReviewId } from "../types";

function finding(
  runId: string,
  partial: Omit<ReviewFinding, "id" | "runId" | "source" | "status" | "decidedAt">
): ReviewFinding {
  return {
    id: newReviewId("find"),
    runId,
    source: "deterministic",
    status: "open",
    decidedAt: null,
    suggestedEdit: null,
    ...partial,
  };
}

function iq(text: string): number | null {
  const match = text.match(/full[- ]scale IQ(?:\s+of)?\s+(\d{2,3})/i);
  if (!match) return null;
  const value = Number(match[1]);
  return value >= 40 && value <= 160 ? value : null;
}

/**
 * Contradictions that are explicit in the supplied text.
 * Missing phrases, short paragraphs, and absent telehealth reasons are not findings.
 */
export function explicitSourceFindings(args: {
  runId: string;
  sections: ReviewSectionInput[];
  sourceNotes: string;
  diagnosticConclusion: string;
}): ReviewFinding[] {
  const out: ReviewFinding[] = [];
  const notes = args.sourceNotes ?? "";
  const joined = args.sections.map((section) => section.text).join("\n");

  const reportIq = iq(joined);
  const sourceIq = iq(notes);
  if (reportIq != null && sourceIq != null && reportIq !== sourceIq) {
    const section =
      args.sections.find((item) => iq(item.text) != null)?.sectionId ?? "clinical-formulation";
    out.push(
      finding(args.runId, {
        kind: "major_inconsistency",
        severity: "blocking",
        sectionId: section,
        title: "Supplied score does not match the report",
        detail: `The draft states Full Scale IQ ${reportIq}. The notes supplied to this pass state Full Scale IQ ${sourceIq}.`,
        evidenceExcerpt: notes.match(/full[- ]scale IQ(?:\s+of)?\s+\d{2,3}/i)?.[0] ?? null,
        suggestedEdit: null,
        supportStatus: "source_contradiction",
      })
    );
  }

  const denied = /not observed in clinic|was not observed in clinic|did not observe/i.test(notes);
  const claimsClinic = /observed in[- ]clinic|clinician observed/i.test(joined);
  if (denied && claimsClinic) {
    const section =
      args.sections.find((item) => /observed in[- ]clinic|clinician observed/i.test(item.text))
        ?.sectionId ?? "clinical-formulation";
    out.push(
      finding(args.runId, {
        kind: "major_inconsistency",
        severity: "major",
        sectionId: section,
        title: "Clinic observation is not supported by the supplied notes",
        detail:
          "The draft says this was observed in clinic. The notes supplied to this pass say it was not observed in clinic.",
        evidenceExcerpt: notes.slice(0, 220),
        suggestedEdit: null,
        supportStatus: "source_contradiction",
      })
    );
  }

  if (
    args.diagnosticConclusion === "does_not_meet" &&
    /meets criteria for ADHD/i.test(joined) &&
    !/does not meet/i.test(joined)
  ) {
    out.push(
      finding(args.runId, {
        kind: "major_inconsistency",
        severity: "blocking",
        sectionId: "clinical-formulation",
        title: "Formulation conflicts with the locked does-not-meet conclusion",
        detail: "The locked conclusion is does not meet. The formulation says the criteria for ADHD are met.",
        evidenceExcerpt: joined.match(/meets criteria for ADHD.{0,80}/i)?.[0] ?? null,
        suggestedEdit: null,
        supportStatus: "locked_conclusion",
      })
    );
  }

  return out;
}
