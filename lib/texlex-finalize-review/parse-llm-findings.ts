import type { ReviewCheckKind, ReviewFinding, ReviewSectionId } from "./types";
import { newReviewId } from "./types";

const ALLOWED_SECTIONS = new Set<string>([
  "presenting-concerns",
  "background-pregnancy-birth",
  "background-early-development",
  "background-educational-history",
  "background-emotional-behavioural-sensory",
  "collateral",
  "criterion-A1",
  "criterion-A2",
  "criterion-A3",
  "criterion-B1",
  "criterion-B2",
  "criterion-B3",
  "criterion-B4",
  "criterion-C",
  "criterion-D",
  "criterion-E",
  "functional-impact",
  "clinical-formulation",
  "recommendations",
  "limitations",
  "patient-details",
]);

const ALLOWED_KINDS = new Set<ReviewCheckKind>([
  "major_inconsistency",
  "differential_consistency",
  "observation_source",
  "differential_coverage",
  "cognitive_overclaim",
  "collateral_gap",
  "modality_limits",
  "limitations_honesty",
  "severity_support",
]);

/** Empty-section findings may omit excerpt; all others require a grounded quote. */
const EMPTY_OK_KINDS = new Set<ReviewCheckKind>([
  "collateral_gap",
  "modality_limits",
  "limitations_honesty",
  "severity_support",
  "differential_coverage",
]);

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Finalize review LLM returned non-JSON");
  }
}

export function parseLlmFinalizeFindings(raw: string, runId: string): ReviewFinding[] {
  const parsed = extractJsonObject(raw) as { findings?: unknown };
  if (!parsed || !Array.isArray(parsed.findings)) return [];

  const out: ReviewFinding[] = [];
  for (const item of parsed.findings) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const kind = row.kind;
    if (typeof kind !== "string" || !ALLOWED_KINDS.has(kind as ReviewCheckKind)) continue;
    const checkKind = kind as ReviewCheckKind;
    const sectionId = typeof row.sectionId === "string" ? row.sectionId : "";
    if (!ALLOWED_SECTIONS.has(sectionId)) continue;
    const evidence =
      typeof row.evidenceExcerpt === "string" && row.evidenceExcerpt.trim()
        ? row.evidenceExcerpt.trim().slice(0, 500)
        : null;
    if (!evidence && !EMPTY_OK_KINDS.has(checkKind)) continue;
    const title =
      typeof row.title === "string" && row.title.trim()
        ? row.title.trim().slice(0, 160)
        : checkKind === "major_inconsistency"
          ? "Major inconsistency"
          : "Audit documentation gap";
    const detail =
      typeof row.detail === "string" && row.detail.trim()
        ? row.detail.trim().slice(0, 800)
        : "Conflict or documentation gap among existing report sections.";
    const suggestedEdit =
      typeof row.suggestedEdit === "string" && row.suggestedEdit.trim()
        ? row.suggestedEdit.trim().slice(0, 600)
        : null;
    const severity =
      row.severity === "blocking" || checkKind === "cognitive_overclaim" ? "blocking" : "major";

    out.push({
      id: newReviewId("find"),
      runId,
      source: "llm",
      kind: checkKind,
      severity,
      sectionId: sectionId as ReviewSectionId,
      title,
      detail,
      evidenceExcerpt: evidence,
      suggestedEdit,
      applyHint: null,
      status: "open",
      decidedAt: null,
    });
    if (out.length >= 20) break;
  }
  return out;
}
