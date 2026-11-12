export const INSUFFICIENT_EVIDENCE_FALLBACK =
  "Insufficient evidence in current notes to characterise this domain — further clinical interview or collateral information required.";

export const BACKGROUND_EMOTIONAL_EMPTY_FALLBACK =
  "No specific concerns were identified in this domain at the time of assessment. Further enquiry recommended during paediatric review.";

export const FUNCTIONAL_IMPACT_RENDER_FALLBACK =
  "Functional impact across home, educational, and community settings is consolidated in the Clinical Formulation section below.";

function pdfCalcDebugEnabled(): boolean {
  try {
    return (
      typeof globalThis !== "undefined" &&
      (globalThis as { __TEXLEX_PDF_CALC_DEBUG__?: boolean }).__TEXLEX_PDF_CALC_DEBUG__ === true
    );
  } catch {
    return false;
  }
}

function logPdfCalc(label: string, input: unknown, output: unknown, extra?: Record<string, unknown>): void {
  if (!pdfCalcDebugEnabled()) return;
  console.log(`[TexlexPdfCalc] ${label}`, { input, output, ...extra });
}

function warnPdfCalc(label: string, input: unknown, output: unknown, extra?: Record<string, unknown>): void {
  console.warn(`[TexlexPdfCalc] ${label}`, { input, output, ...extra });
}

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
  const toRating = (n: unknown): 0 | 1 | 2 | 3 | null => {
    if (n === null || n === undefined) return null;
    const v = typeof n === "number" ? n : Number(n);
    if (!Number.isFinite(v)) return null;
    const r = Math.round(v);
    if (r < 0 || r > 3) return null;
    return r as 0 | 1 | 2 | 3;
  };
  const safeRating = toRating(criterion.rating);
  // PDF / clinical display: clinician rating only. Never fall back to auto-suggested
  // (suggested can read "severe" language and inflate A1/A2 after import).
  if (code === "A2" && isInsufficientEvidenceNarrative(criterion.indicators)) return null;
  return safeRating;
}

/** UI helper: suggested rating for the editor chrome only. */
export function resolveCriterionSuggestedRating(
  code: string,
  criterion: { rating: 0 | 1 | 2 | 3 | null; suggestedRating: 0 | 1 | 2 | 3 | null; indicators: string }
): 0 | 1 | 2 | 3 | null {
  const toRating = (n: unknown): 0 | 1 | 2 | 3 | null => {
    if (n === null || n === undefined) return null;
    const v = typeof n === "number" ? n : Number(n);
    if (!Number.isFinite(v)) return null;
    const r = Math.round(v);
    if (r < 0 || r > 3) return null;
    return r as 0 | 1 | 2 | 3;
  };
  if (code === "A2" && isInsufficientEvidenceNarrative(criterion.indicators)) return null;
  if (isInsufficientEvidenceNarrative(criterion.indicators)) return null;
  return toRating(criterion.suggestedRating);
}

export function clientFirstName(clientName: string): string {
  const trimmed = clientName.trim();
  if (!trimmed) return "";
  const HONORIFICS = new Set(["miss","master","mstr","mr","mrs","ms","mx","dr","miss.","master.","mstr.","mr.","mrs.","ms.","mx.","dr."]);
  const tokens = trimmed.split(/\s+/);
  let i = 0;
  while (i < tokens.length && HONORIFICS.has(tokens[i]!.toLowerCase())) i++;
  return (tokens[i] ?? tokens[0]) ?? "";
}

export type DetailPlaceholderKind = "notProvided" | "na" | "dash";

export function formatIsoDate(iso: string, emptyKind: DetailPlaceholderKind = "dash"): string {
  const raw = typeof iso === "string" ? iso : iso == null ? "" : String(iso);
  const trimmed = raw.trim();
  if (!trimmed) return placeholderForKind(emptyKind);
  const t = new Date(`${trimmed}T12:00:00`);
  const ms = t.getTime();
  if (!Number.isFinite(ms) || Number.isNaN(ms)) {
    warnPdfCalc("formatIsoDate: invalid date", raw, trimmed, { emptyKind });
    return trimmed;
  }
  const out = t.toLocaleDateString("en-AU", { dateStyle: "medium" });
  logPdfCalc("formatIsoDate", raw, out);
  return out;
}

export function formatAssessmentDates(dates: string[], emptyKind: DetailPlaceholderKind = "dash"): string {
  const filled = (dates ?? [])
    .map((d) => (typeof d === "string" ? d : d == null ? "" : String(d)).trim())
    .filter(Boolean);
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
  const s = typeof dobString === "string" ? dobString : dobString == null ? "" : String(dobString);
  if (!s.trim()) return false;
  const dob = new Date(s);
  const dobMs = dob.getTime();
  if (!Number.isFinite(dobMs) || Number.isNaN(dobMs)) {
    warnPdfCalc("isSchoolAgeNotApplicable: invalid DOB", dobString, false, { dobMs });
    return false;
  }
  const today = new Date();
  let years = today.getFullYear() - dob.getFullYear();
  const monthDelta = today.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dob.getDate())) years--;
  if (!Number.isFinite(years)) {
    warnPdfCalc("isSchoolAgeNotApplicable: non-finite years", dobString, false, { years });
    return false;
  }
  const out = years < 5;
  logPdfCalc("isSchoolAgeNotApplicable", dobString, out, { years });
  return out;
}

export function computeChronologicalAge(dobString: string): string {
  const s = typeof dobString === "string" ? dobString : dobString == null ? "" : String(dobString);
  if (!s.trim()) return placeholderForKind("notProvided");
  const dob = new Date(s);
  const dobMs = dob.getTime();
  if (!Number.isFinite(dobMs) || Number.isNaN(dobMs)) {
    warnPdfCalc("computeChronologicalAge: invalid DOB", dobString, placeholderForKind("notProvided"), { dobMs });
    return placeholderForKind("notProvided");
  }
  const today = new Date();
  let years = today.getFullYear() - dob.getFullYear();
  let months = today.getMonth() - dob.getMonth();
  if (today.getDate() < dob.getDate()) months--;
  if (months < 0) {
    years--;
    months += 12;
  }
  if (!Number.isFinite(years) || !Number.isFinite(months)) {
    warnPdfCalc("computeChronologicalAge: non-finite y/m", dobString, placeholderForKind("notProvided"), {
      years,
      months,
    });
    return placeholderForKind("notProvided");
  }
  years = Math.min(150, Math.max(0, years));
  months = Math.min(11, Math.max(0, months));
  const out = `${years}y ${months}m`;
  logPdfCalc("computeChronologicalAge", dobString, out, { years, months });
  return out;
}

/**
 * Split prose into PDF layout paragraphs. Prefers explicit blank lines (\n\n);
 * falls back to single newlines after sentence-ending punctuation when the model
 * omits blank lines (common LLM output).
 */
export function splitParagraphs(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const byBlankLine = normalized.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (byBlankLine.length > 1) return byBlankLine;

  const single = byBlankLine[0] ?? normalized;
  const byHardBreak = single
    .split(/(?<=[.!?][")\]]?)\n(?=[A-Z"(])/g)
    .map((p) => p.trim())
    .filter(Boolean);
  return byHardBreak.length > 1 ? byHardBreak : [single];
}

/**
 * Split stored recommendations prose into discrete items for PDF layout.
 * Handles (1) newline-started numbering, (2) inline "1. … 2. …" on one line, (3) plain fallback.
 */
export function parseRecommendationsListItems(raw: string): string[] {
  const t = raw.trim().replace(/\r\n/g, "\n");
  if (!t) return [];

  // Wall-of-text case: "1. … 2. …" on one line (no newlines between items)
  if (!t.includes("\n")) {
    const inlineParts = t
      .split(/\s+(?=\d+\.\s+)/)
      .map((p) => p.replace(/^\d+\.\s+/, "").trim())
      .filter(Boolean);
    if (inlineParts.length > 1) return inlineParts;
  }

  const lines = t.split("\n");
  const items: string[] = [];
  let buf = "";
  const flush = () => {
    const x = buf.trim();
    if (x) items.push(x);
    buf = "";
  };

  for (const line of lines) {
    const m = line.match(/^\s*(\d+)\.\s+(.*)$/);
    if (m) {
      flush();
      buf = m[2] ?? "";
    } else {
      buf = buf ? `${buf}\n${line}` : line;
    }
  }
  flush();

  if (items.length > 0) return items;

  const inlineParts = t
    .split(/\s+(?=\d+\.\s+)/)
    .map((p) => p.replace(/^\d+\.\s+/, "").trim())
    .filter(Boolean);
  if (inlineParts.length > 0) return inlineParts;

  return [t];
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
  if (digits.length < 8 || digits.length > 24) return null;
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
