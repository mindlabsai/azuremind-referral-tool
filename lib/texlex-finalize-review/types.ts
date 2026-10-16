/** Finalize Review — flag a passage, then offer a drop-in clinical alternative. */

export type ReviewSectionId =
  | "presenting-concerns"
  | "background-pregnancy-birth"
  | "background-early-development"
  | "background-educational-history"
  | "background-emotional-behavioural-sensory"
  | "collateral"
  | "criterion-A1"
  | "criterion-A2"
  | "criterion-A3"
  | "criterion-B1"
  | "criterion-B2"
  | "criterion-B3"
  | "criterion-B4"
  | "criterion-C"
  | "criterion-D"
  | "criterion-E"
  | "functional-impact"
  | "clinical-formulation"
  | "recommendations"
  | "limitations"
  | "patient-details";

export type ReviewSeverity = "blocking" | "major" | "minor";

export type ReviewCheckKind =
  | "name_mismatch"
  | "pronoun_mismatch"
  | "level_ab_vs_opening"
  | "modality_mismatch"
  | "date_mismatch"
  | "major_inconsistency"
  | "differential_consistency"
  /** AHPRA-oriented audit scans */
  | "observation_source"
  | "differential_coverage"
  | "cognitive_overclaim"
  | "collateral_gap"
  | "modality_limits"
  | "limitations_honesty"
  | "severity_support";

export type ReviewFindingStatus = "open" | "accepted" | "rejected" | "resolved";

export type ReviewFindingSource = "deterministic" | "llm";

export type ReviewApplyHint = {
  mode: "replace_all_in_section" | "replace_opening_sentence" | "insert_paragraph";
  find: string;
  replace: string;
};

export type ReviewFinding = {
  id: string;
  runId: string;
  source: ReviewFindingSource;
  kind: ReviewCheckKind;
  severity: ReviewSeverity;
  sectionId: ReviewSectionId;
  title: string;
  detail: string;
  evidenceExcerpt: string | null;
  suggestedEdit: string | null;
  applyHint: ReviewApplyHint | null;
  status: ReviewFindingStatus;
  decidedAt: string | null;
  /** Optional V2 extensions. Older clients ignore them. */
  markerPack?: "ASD" | "ADHD" | "SLD" | null;
  supportStatus?: string;
  sourceReferences?: Array<{
    sourceType: string;
    sourceId?: string;
    date?: string;
    location?: string;
  }>;
  suggestionStatus?: "proposal" | "withheld";
};

export type ReviewRunStatus = "running" | "complete" | "failed" | "cancelled";

export type ReviewRunSnapshot = {
  diagnosticConclusion: string;
  confirmedLevelA: number | null;
  confirmedLevelB: number | null;
  assessmentModality: "" | "in-clinic" | "virtual";
  clientName: string;
  pronouns: string;
};

export type ReviewRun = {
  id: string;
  createdAt: string;
  completedAt: string | null;
  status: ReviewRunStatus;
  modelUsed: string | null;
  llmSkipped: boolean;
  error: string | null;
  snapshot: ReviewRunSnapshot;
  findings: ReviewFinding[];
  summary: {
    blockingCount: number;
    majorCount: number;
    minorCount: number;
    openBlockingCount: number;
  };
  /** Present when Universal Evidence-First Review V2 produced this pass. */
  universalReviewV2?: boolean;
  markerPack?: "ASD" | "ADHD" | null;
  sourceCoverage?: string;
  display?: string;
};

export type ReviewSectionInput = {
  sectionId: ReviewSectionId;
  text: string;
};

export function emptyReviewSummary(): ReviewRun["summary"] {
  return { blockingCount: 0, majorCount: 0, minorCount: 0, openBlockingCount: 0 };
}

export function computeReviewSummary(findings: ReviewFinding[]): ReviewRun["summary"] {
  const summary = emptyReviewSummary();
  for (const f of findings) {
    if (f.severity === "blocking") summary.blockingCount++;
    else if (f.severity === "major") summary.majorCount++;
    else summary.minorCount++;
    if (f.severity === "blocking" && (f.status === "open" || f.status === "accepted")) {
      // Accepted means the clinician will edit by hand. It still blocks until a new review pass.
      summary.openBlockingCount++;
    }
  }
  return summary;
}

export function newReviewId(prefix = "rev"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
