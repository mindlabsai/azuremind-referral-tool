/** Drop placeholders so they never fill the referral form. */
function cleanField(value: string): string {
  const s = value.trim();
  if (!s) return "";
  if (/^<[^>]+>$/.test(s)) return "";
  if (/^(unknown|n\/?a|none|null|tbd|not\s+provided|not\s+stated|\?+)$/i.test(s)) return "";
  return s;
}

function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** 04 + 8 digits, or 614 + 8 digits stored as +61… */
export function completeAuMobile(raw: string): string {
  const s = cleanField(raw);
  if (!s) return "";
  const digits = digitsOnly(s);
  if (/^04\d{8}$/.test(digits)) return digits;
  if (/^614\d{8}$/.test(digits)) return `+${digits}`;
  return "";
}

/** A leading 04 number that is shorter than a full Australian mobile. */
export function partialAuMobile(raw: string): string {
  const digits = digitsOnly(cleanField(raw));
  if (/^04\d{1,7}$/.test(digits)) return digits;
  return "";
}

/**
 * Keep a mobile only when the characters support a complete Australian mobile.
 * A short 04 number is not padded and is not stored as the contact number.
 */
export function settleParentMobile(raw: string): { mobile: string; warning: string | null } {
  const complete = completeAuMobile(raw);
  if (complete) return { mobile: complete, warning: null };
  const partial = partialAuMobile(raw);
  if (partial) {
    return {
      mobile: "",
      warning: `Parent mobile is incomplete (${partial}). Check the referral before sending.`,
    };
  }
  const s = cleanField(raw);
  return { mobile: s, warning: null };
}

/**
 * Prefer a complete number from the letter text over a shorter model value
 * when that shorter value is a prefix of the complete number.
 */
export function applyMobileEvidence(
  primaryRaw: string,
  fallbackRaw: string | undefined
): { mobile: string; warning: string | null } {
  const primary = settleParentMobile(primaryRaw);
  const fallback = settleParentMobile(fallbackRaw || "");
  if (fallback.mobile) {
    const primaryDigits = digitsOnly(primaryRaw);
    const primaryLocal = primaryDigits.startsWith("614") ? `0${primaryDigits.slice(2)}` : primaryDigits;
    const fallbackDigits = digitsOnly(fallback.mobile);
    const partialPrefix = /^04\d{1,7}$/.test(primaryLocal) && fallbackDigits.startsWith(primaryLocal);
    if (!primary.mobile || partialPrefix) return { mobile: fallback.mobile, warning: null };
  }
  if (primary.mobile) return { mobile: primary.mobile, warning: null };
  return { mobile: "", warning: primary.warning || fallback.warning };
}
