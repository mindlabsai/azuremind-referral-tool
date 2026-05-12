export function sanitiseExtractedNumber(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (Math.abs(n) > 1000) return null;
  return n;
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
  if (!/(?:^|\s)(?:NaN|Infinity|-Infinity)(?:\s|$)/.test(value)) return value;
  return value
    .replace(/\bNaN\b/g, "")
    .replace(/\b-?Infinity\b/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function walkValue(value: unknown, path: string): unknown {
  if (typeof value === "number") {
    const safe = sanitiseExtractedNumber(value);
    if (safe === null) {
      console.warn("Sanitised garbage number from PDF render:", { path, originalValue: value });
      return "";
    }
    return safe;
  }

  if (typeof value === "string") {
    return sanitiseStringForPdf(value);
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => walkValue(item, `${path}[${index}]`));
  }

  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      next[key] = walkValue(nested, path ? `${path}.${key}` : key);
    }
    return next;
  }

  return value;
}

export function sanitiseForPdf<T>(draft: T): T {
  return walkValue(draft, "") as T;
}
