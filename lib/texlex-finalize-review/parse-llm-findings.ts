import type { ReviewFinding, ReviewSectionId } from "./types";
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
    if (kind !== "major_inconsistency" && kind !== "differential_consistency") continue;
    const sectionId = typeof row.sectionId === "string" ? row.sectionId : "";
    if (!ALLOWED_SECTIONS.has(sectionId)) continue;
    const evidence =
      typeof row.evidenceExcerpt === "string" && row.evidenceExcerpt.trim()
        ? row.evidenceExcerpt.trim().slice(0, 500)
        : null;
    if (!evidence) continue; // require grounded excerpt
    const title = typeof row.title === "string" && row.title.trim() ? row.title.trim().slice(0, 160) : "Major inconsistency";
    const detail =
      typeof row.detail === "string" && row.detail.trim()
        ? row.detail.trim().slice(0, 800)
        : "Conflict detected among existing report sections.";
    const suggestedEdit =
      typeof row.suggestedEdit === "string" && row.suggestedEdit.trim()
        ? row.suggestedEdit.trim().slice(0, 600)
        : null;
    const severity = row.severity === "blocking" ? "blocking" : "major";

    out.push({
      id: newReviewId("find"),
      runId,
      source: "llm",
      kind,
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
