/**
 * PDF draft sanitisation. For verbose before/after logs per field:
 * `localStorage.setItem("texlex-debug-pdf-sanitise", "1")` then reload the report page.
 */
export function sanitiseExtractedNumber(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (Math.abs(n) > 1000) return null;
  return n;
}

/** Numbers safe for JSON-like draft values passed toward @react-pdf (rejects corrupted magnitudes). */
function isLayoutSafeNumber(n: number): boolean {
  if (!Number.isFinite(n)) return false;
  // Allow Unix ms (~1e12) and large counters; reject float garbage like -8.85e21.
  if (Math.abs(n) > 1e16) return false;
  return true;
}

function sanitiseCriterionRating(value: unknown): 0 | 1 | 2 | 3 | null {
  const n = sanitiseExtractedNumber(value);
  if (n === null) return null;
  const rounded = Math.round(n);
  if (rounded < 0 || rounded > 3) return null;
  return rounded as 0 | 1 | 2 | 3;
}

export function normalizeCriterionState<
  T extends {
    rating: 0 | 1 | 2 | 3 | null;
    suggestedRating: 0 | 1 | 2 | 3 | null;
    markerCount: number;
  },
>(criterion: T): T {
  const markerCount = sanitiseExtractedNumber(criterion.markerCount) ?? 0;
  return {
    ...criterion,
    rating: sanitiseCriterionRating(criterion.rating),
    suggestedRating: sanitiseCriterionRating(criterion.suggestedRating),
    markerCount: Math.max(0, Math.round(markerCount)),
  };
}

/**
 * Removes standalone scientific-notation numeric tokens (e.g. corrupted -8.854e+21 pasted into prose).
 * Uses (?<![A-Za-z0-9_]) / (?![0-9.eE]) so substrings inside words like "pathology", "her", "strategies",
 * "Vegemite", "during" are never matched — a letter-adjacent mantissa is not a numeric token here.
 * Only strips when Number(token) is non-finite or |token| > 1e9 (aligns with report PDF field stripper).
 */
export function stripScientificNotationGarbageFromText(input: string, fieldPath?: string): string {
  return input.replace(
    /(?<![A-Za-z0-9_])-?\d+(?:\.\d*)?[eE][+-]?\d+(?![0-9.eE])/g,
    (token) => {
      const x = Number(token);
      if (!Number.isFinite(x) || Math.abs(x) > 1e9) {
        if (typeof globalThis !== "undefined" && typeof console !== "undefined" && console.info) {
          console.info(
            `[Texlex] Sanitiser stripped numeric token "${token}" from field "${fieldPath ?? "(unknown)"}"`
          );
        }
        return "";
      }
      return token;
    }
  );
}

function sanitiseStringForPdf(value: string, path: string): string {
  let s = value;
  if (/(?:^|\s)(?:NaN|Infinity|-Infinity)(?:\s|$)/.test(s)) {
    s = s
      .replace(/\bNaN\b/g, "")
      .replace(/\b-?Infinity\b/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
  s = stripScientificNotationGarbageFromText(s, path);
  return s;
}

function pdfSanitiseDebugEnabled(): boolean {
  try {
    return (
      typeof globalThis !== "undefined" &&
      typeof (globalThis as unknown as { localStorage?: Storage }).localStorage !== "undefined" &&
      (globalThis as unknown as { localStorage: Storage }).localStorage.getItem("texlex-debug-pdf-sanitise") === "1"
    );
  } catch {
    return false;
  }
}

function logPdfSanitise(path: string, before: unknown, after: unknown): void {
  if (!pdfSanitiseDebugEnabled()) return;
  try {
    console.log("[sanitiseForPdf]", path, "BEFORE:", before, "AFTER:", after);
  } catch {
    console.log("[sanitiseForPdf]", path, "(unserialisable values)");
  }
}

export type PdfSanitiseAudit = {
  /** Field paths where a value was altered for PDF safety */
  paths: string[];
};

function walkValue(value: unknown, path: string, audit: PdfSanitiseAudit): unknown {
  if (value === null || value === undefined) {
    logPdfSanitise(path, value, value);
    return value;
  }

  if (typeof value === "bigint") {
    console.warn("Sanitised bigint from PDF render:", { path, originalValue: String(value) });
    audit.paths.push(path);
    logPdfSanitise(path, value, null);
    return null;
  }

  if (typeof value === "number") {
    if (!isLayoutSafeNumber(value)) {
      console.warn("Sanitised garbage number from PDF render:", { path, originalValue: value });
      audit.paths.push(path);
      logPdfSanitise(path, value, "");
      return "";
    }
    logPdfSanitise(path, value, value);
    return value;
  }

  if (typeof value === "string") {
    const next = sanitiseStringForPdf(value, path);
    if (next !== value) audit.paths.push(path);
    logPdfSanitise(path, value, next);
    return next;
  }

  if (typeof value === "boolean") {
    logPdfSanitise(path, value, value);
    return value;
  }

  if (value instanceof Date) {
    const t = value.getTime();
    if (!Number.isFinite(t)) {
      console.warn("Sanitised invalid Date from PDF render:", { path });
      audit.paths.push(path);
      logPdfSanitise(path, value, null);
      return null;
    }
    const iso = value.toISOString();
    logPdfSanitise(path, value, iso);
    return iso;
  }

  if (Array.isArray(value)) {
    const next = value.map((item, index) => walkValue(item, `${path}[${index}]`, audit));
    logPdfSanitise(path, `[Array len=${value.length}]`, `[Array len=${(next as unknown[]).length}]`);
    return next;
  }

  if (typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const childPath = path ? `${path}.${key}` : key;
      next[key] = walkValue(nested, childPath, audit);
    }
    if (pdfSanitiseDebugEnabled()) {
      console.log("[sanitiseForPdf]", path || "(root)", "OBJECT keys:", Object.keys(next).join(", "));
    }
    return next;
  }

  logPdfSanitise(path, value, null);
  return null;
}

function deepCloneSerializable<T>(draft: T): T {
  try {
    return JSON.parse(JSON.stringify(draft)) as T;
  } catch {
    try {
      return structuredClone(draft);
    } catch {
      return draft;
    }
  }
}

export function sanitiseForPdf<T>(draft: T): T {
  const audit: PdfSanitiseAudit = { paths: [] };
  const clone = deepCloneSerializable(draft);
  const out = walkValue(clone, "", audit) as T;
  const n = audit.paths.length;
  if (typeof globalThis !== "undefined" && typeof console !== "undefined" && console.info) {
    console.info(`[Texlex] Sanitised ${n} corrupted field(s)`, { paths: audit.paths });
  }
  return out;
}
