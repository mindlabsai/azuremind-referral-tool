const INSUFFICIENT_EVIDENCE_MARKER = "insufficient evidence in current notes";

function isInsufficientEvidenceNarrative(text: string): boolean {
  return text.trim().toLowerCase().includes(INSUFFICIENT_EVIDENCE_MARKER);
}

const STRONGLY_SUPPORTED_PATTERN =
  /\b(severe|marked|pervasive|profound|very substantial|significant impairment|across multiple settings|across multiple modalities|multiple modalities|longstanding and pervasive|longstanding|substantial scaffolding|severe dysregulation|highly restricted|extreme)\b/i;

const PARTIALLY_SUPPORTED_PATTERN =
  /\b(emerging|some|occasional|mild|in certain contexts|context-dependent|episodic|less prominent)\b/i;

const SUPPORTED_PATTERN =
  /\b(clear|evident|consistent|moderate|affects functioning|requires support|observed across settings|present from early development)\b/i;

export function suggestedRatingFromNarrative(indicators: string): 0 | 1 | 2 | 3 | null {
  const text = indicators.trim();
  if (!text) return null;
  if (isInsufficientEvidenceNarrative(text)) return 0;
  if (STRONGLY_SUPPORTED_PATTERN.test(text)) return 3;
  if (PARTIALLY_SUPPORTED_PATTERN.test(text) && !SUPPORTED_PATTERN.test(text)) return 1;
  if (SUPPORTED_PATTERN.test(text)) return 2;
  return 2;
}

export function mergeCriterionSuggestedRating(
  code: string,
  indicators: string,
  matrixRating: 0 | 1 | 2 | 3 | null
): 0 | 1 | 2 | 3 | null {
  if (code !== "B2" && code !== "B3" && code !== "B4") return matrixRating;
  const narrativeRating = suggestedRatingFromNarrative(indicators);
  if (narrativeRating === null) return matrixRating;
  if (matrixRating === null) return narrativeRating;
  return Math.max(matrixRating, narrativeRating) as 0 | 1 | 2 | 3;
}
