/**
 * Which stored attachments may be treated as part of the approved clinical referral
 * (and later parent communications). Excluded / unresolved conflicts are never included.
 */

export type ReferralDocumentEligibilityRow = {
  id: string;
  filename?: string | null;
  extraction_role?: string | null;
  identity_conflict?: boolean | null;
  conflict_resolution?: string | null;
};

export function isDocumentExcludedFromReferral(
  doc: ReferralDocumentEligibilityRow
): boolean {
  return doc.conflict_resolution === "excluded" || doc.extraction_role === "none";
}

export function isUnresolvedIdentityConflict(
  doc: ReferralDocumentEligibilityRow
): boolean {
  const conflict = doc.identity_conflict === true || doc.extraction_role === "conflict";
  if (!conflict) return false;
  return (
    doc.conflict_resolution !== "excluded" &&
    doc.conflict_resolution !== "accepted_same_patient"
  );
}

/** Documents safe to attach to patient-facing communications after approval. */
export function documentsEligibleForPatientComms(
  docs: ReferralDocumentEligibilityRow[]
): ReferralDocumentEligibilityRow[] {
  return docs.filter((doc) => {
    if (isDocumentExcludedFromReferral(doc)) return false;
    if (isUnresolvedIdentityConflict(doc)) return false;
    return (
      doc.extraction_role === "primary" ||
      doc.extraction_role === "supporting" ||
      doc.conflict_resolution === "accepted_same_patient"
    );
  });
}
