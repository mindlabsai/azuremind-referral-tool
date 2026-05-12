export const INSUFFICIENT_EVIDENCE_FALLBACK =
  "Insufficient evidence in current notes to characterise this domain — further clinical interview or collateral information required.";

export const BACKGROUND_EMOTIONAL_EMPTY_FALLBACK =
  "No specific concerns were identified in this domain at the time of assessment. Further enquiry recommended during paediatric review.";

export const FUNCTIONAL_IMPACT_RENDER_FALLBACK =
  "Functional impact across home, educational, and community settings is consolidated in the Clinical Formulation section below.";

export function isTexlexSubsectionEmpty(text: string): boolean {
  if (!text) return true;
  const trimmed = text.trim();
  return trimmed === "" || trimmed === "—" || trimmed === "-";
}

export function resolveFunctionalImpactDisplay(content: string): string {
  return isTexlexSubsectionEmpty(content) ? FUNCTIONAL_IMPACT_RENDER_FALLBACK : content.trim();
}

export function resolveCriterionDisplayRating(
  code: string,
  criterion: { rating: 0 | 1 | 2 | 3 | null; suggestedRating: 0 | 1 | 2 | 3 | null; indicators: string }
): 0 | 1 | 2 | 3 | null {
  const rating = criterion.rating;
  const suggested = criterion.suggestedRating;
  const safeRating =
    rating !== null && Number.isFinite(rating) && rating >= 0 && rating <= 3 ? rating : null;
  const safeSuggested =
    suggested !== null && Number.isFinite(suggested) && suggested >= 0 && suggested <= 3
      ? suggested
      : null;
  if (code === "A2" && isInsufficientEvidenceNarrative(criterion.indicators)) return null;
  if (safeRating !== null) return safeRating;
  if (isInsufficientEvidenceNarrative(criterion.indicators)) return null;
  return safeSuggested;
}

export function clientFirstName(clientName: string): string {
  const trimmed = clientName.trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] ?? "";
}

export type DetailPlaceholderKind = "notProvided" | "na" | "dash";

export function formatIsoDate(iso: string, emptyKind: DetailPlaceholderKind = "dash"): string {
  if (!iso.trim()) return placeholderForKind(emptyKind);
  const t = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(t.getTime())) return iso;
  return t.toLocaleDateString("en-AU", { dateStyle: "medium" });
}

export function formatAssessmentDates(dates: string[], emptyKind: DetailPlaceholderKind = "dash"): string {
  const filled = dates.map((d) => d.trim()).filter(Boolean);
  if (!filled.length) return placeholderForKind(emptyKind);
  return filled.map((date) => formatIsoDate(date, emptyKind)).join(", ");
}

export function placeholderForKind(kind: DetailPlaceholderKind): string {
  if (kind === "na") return "N/A";
  if (kind === "notProvided") return "Not provided";
  return "—";
}

export function formatDetailValue(value: string, emptyKind: DetailPlaceholderKind): string {
  return value.trim() ? value.trim() : placeholderForKind(emptyKind);
}

export function sanitizeAddressField(address: string, phone: string): string {
  let cleaned = address.trim();
  if (!cleaned) return placeholderForKind("notProvided");

  const phoneDigits = phone.replace(/\D/g, "");
  if (phoneDigits.length >= 8) {
    const phonePattern = new RegExp(`\\b${phoneDigits.slice(-8)}\\b`);
    cleaned = cleaned.replace(phonePattern, "").trim();
  }

  cleaned = cleaned
    .replace(/\s*Phone\s*:\s*[\d\s()+-]+$/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[,\s]+$/, "")
    .trim();

  return cleaned || placeholderForKind("notProvided");
}

export function isSchoolAgeNotApplicable(dobString: string): boolean {
  if (!dobString.trim()) return false;
  const dob = new Date(dobString);
  if (Number.isNaN(dob.getTime())) return false;
  const today = new Date();
  let years = today.getFullYear() - dob.getFullYear();
  const monthDelta = today.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dob.getDate())) years--;
  return years < 5;
}

export function computeChronologicalAge(dobString: string): string {
  if (!dobString) return placeholderForKind("notProvided");
  const dob = new Date(dobString);
  if (Number.isNaN(dob.getTime())) return placeholderForKind("notProvided");
  const today = new Date();
  let years = today.getFullYear() - dob.getFullYear();
  let months = today.getMonth() - dob.getMonth();
  if (today.getDate() < dob.getDate()) months--;
  if (months < 0) {
    years--;
    months += 12;
  }
  return `${years}y ${months}m`;
}

export function splitParagraphs(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  return trimmed.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

export function safeFilenamePart(value: string): string {
  const cleaned = value.trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
  return cleaned || "Texlex-Report";
}

export function isInsufficientEvidenceNarrative(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  const normalized = trimmed.toLowerCase();
  return (
    normalized.includes("insufficient evidence in current notes") ||
    normalized === INSUFFICIENT_EVIDENCE_FALLBACK.toLowerCase()
  );
}

const RATING_LABELS: Record<0 | 1 | 2 | 3, string> = {
  0: "Not Supported",
  1: "Partially Supported / Emerging Features",
  2: "Supported",
  3: "Strongly Supported",
};

export function formatCriterionRating(rating: 0 | 1 | 2 | 3 | null): string {
  if (rating === null) return "Rating: —";
  return `Rating: ${rating} — ${RATING_LABELS[rating]}`;
}

export function formatRatingPillText(rating: 0 | 1 | 2 | 3): string {
  return `RATING · ${rating} — ${RATING_LABELS[rating].toUpperCase()}`;
}

export function formatDobWithAge(dob: string): string {
  const date = formatIsoDate(dob, "notProvided");
  if (date === placeholderForKind("notProvided")) return date;
  const age = computeChronologicalAge(dob);
  if (age === placeholderForKind("notProvided")) return date;
  return `${date}  ·  ${age}`;
}

export function formatParentsBlock(parent1: string, parent2: string): string | null {
  const first = parent1.trim();
  const second = parent2.trim();
  if (!first && !second) return null;
  if (first && second) return `${first}\n${second}`;
  return first || second;
}

export function formatAustralianPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  if (digits.length === 10) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return phone.trim() || null;
}

export function resolveMetadataField(
  value: string,
  emptyKind: DetailPlaceholderKind
): string | null {
  const resolved = formatDetailValue(value, emptyKind);
  if (resolved === "N/A" || resolved === "Not provided") return null;
  return resolved;
}

export function resolveAssessorDisplayName(assessor: string, fallbackName: string): string {
  const trimmed = assessor.trim();
  if (!trimmed) return fallbackName;

  const commaIndex = trimmed.indexOf(",");
  if (commaIndex > 0) {
    const suffix = trimmed.slice(commaIndex + 1);
    if (/registered psychologist|psy\d+/i.test(suffix)) {
      return trimmed.slice(0, commaIndex).trim();
    }
  }

  if (trimmed.toLowerCase().startsWith(fallbackName.toLowerCase())) {
    return fallbackName;
  }

  return trimmed;
}
