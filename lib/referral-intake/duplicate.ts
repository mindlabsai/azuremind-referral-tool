import type { ReferralReaderExtract } from "@/lib/referral-reader/types";
import { sha256Buffer } from "./document-store";

/** Stable Gmail / provider dedupe key. */
export function providerDedupeKey(provider: string, messageId: string): string {
  return `${provider}:${messageId.trim()}`;
}

/**
 * Soft duplicate fingerprint: same clinic + child identity (+ DOB when present).
 * Used after extract to flag likely re-sends of the same patient.
 */
export function patientDuplicateFingerprint(
  clinicId: string,
  extract: Pick<ReferralReaderExtract, "childFirst" | "childLast" | "childDob">
): string {
  const first = extract.childFirst.trim().toLowerCase();
  const last = extract.childLast.trim().toLowerCase();
  const dob = extract.childDob.trim();
  return `${clinicId}|${first}|${last}|${dob}`;
}

export function documentContentKey(clinicId: string, bytes: Buffer): string {
  return `${clinicId}|sha256:${sha256Buffer(bytes)}`;
}

/**
 * Same child only when first+last+DOB all match.
 * Name alone is insufficient (common surnames). Parent mobile is never used —
 * siblings share it and it must not link documents or soft-duplicates.
 */
export function isLikelySamePatient(
  a: Pick<ReferralReaderExtract, "childFirst" | "childLast" | "childDob">,
  b: Pick<ReferralReaderExtract, "childFirst" | "childLast" | "childDob">
): boolean {
  const norm = (s: string) => s.trim().toLowerCase();
  if (!norm(a.childFirst) || !norm(a.childLast) || !norm(b.childFirst) || !norm(b.childLast)) {
    return false;
  }
  if (norm(a.childFirst) !== norm(b.childFirst) || norm(a.childLast) !== norm(b.childLast)) {
    return false;
  }
  const aDob = a.childDob.trim();
  const bDob = b.childDob.trim();
  if (!aDob || !bDob) return false;
  return aDob === bDob;
}
