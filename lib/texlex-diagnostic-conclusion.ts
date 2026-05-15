export type TexlexDiagnosticConclusion = "meets" | "does_not_meet" | "inconclusive";

export function resolveTexlexDiagnosticConclusion(raw: unknown): TexlexDiagnosticConclusion {
  if (raw === "meets" || raw === "does_not_meet" || raw === "inconclusive") return raw;
  return "inconclusive";
}

/**
 * Caps auto-derived suggested ratings from the matrix + narrative merge.
 * Manual `rating` on each criterion is not modified here (clinician override).
 */
export function capSuggestedRatingForDiagnosticConclusion(
  rating: 0 | 1 | 2 | 3 | null,
  conclusion: TexlexDiagnosticConclusion,
  criterionCode: string
): 0 | 1 | 2 | 3 | null {
  if (rating === null) return null;
  const max: 1 | 2 | 3 =
    conclusion === "does_not_meet" ? 1 : conclusion === "inconclusive" ? 2 : 3;
  if (rating <= max) return rating;
  if (conclusion === "does_not_meet") {
    console.warn(`[Texlex] Rating clamped on ${criterionCode} due to does_not_meet conclusion`);
  }
  return max;
}
