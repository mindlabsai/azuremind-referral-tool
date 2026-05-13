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

function sanitiseStringForPdf(value: string): string {
  let s = value;
  if (/(?:^|\s)(?:NaN|Infinity|-Infinity)(?:\s|$)/.test(s)) {
    s = s
      .replace(/\bNaN\b/g, "")
      .replace(/\b-?Infinity\b/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
  // Strip corrupted scientific-notation tokens that can confuse downstream parsers
  s = s.replace(/-?\d+(?:\.\d+)?[eE][+-]?\d{2,}/g, (m) => {
    const x = Number(m);
    if (!Number.isFinite(x) || Math.abs(x) > 1e6) return "";
    return m;
  });
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

function walkValue(value: unknown, path: string): unknown {
  if (value === null || value === undefined) {
    logPdfSanitise(path, value, value);
    return value;
  }

  if (typeof value === "bigint") {
    console.warn("Sanitised bigint from PDF render:", { path, originalValue: String(value) });
    logPdfSanitise(path, value, null);
    return null;
  }

  if (typeof value === "number") {
    if (!isLayoutSafeNumber(value)) {
      console.warn("Sanitised garbage number from PDF render:", { path, originalValue: value });
      logPdfSanitise(path, value, "");
      return "";
    }
    logPdfSanitise(path, value, value);
    return value;
  }

  if (typeof value === "string") {
    const next = sanitiseStringForPdf(value);
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
      logPdfSanitise(path, value, null);
      return null;
    }
    const iso = value.toISOString();
    logPdfSanitise(path, value, iso);
    return iso;
  }

  if (Array.isArray(value)) {
    const next = value.map((item, index) => walkValue(item, `${path}[${index}]`));
    logPdfSanitise(path, `[Array len=${value.length}]`, `[Array len=${(next as unknown[]).length}]`);
    return next;
  }

  if (typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const childPath = path ? `${path}.${key}` : key;
      next[key] = walkValue(nested, childPath);
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
  const clone = deepCloneSerializable(draft);
  return walkValue(clone, "") as T;
}
