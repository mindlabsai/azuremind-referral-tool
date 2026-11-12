import { readReferralFromDocument } from "@/lib/referral-reader/extract";
import { writeReferralAudit } from "./audit";
import { readStoredReferralDocument } from "./document-store";
import {
  formatPatientIdentity,
  identityFromExtract,
  patientIdentitiesConflict,
} from "./patient-identity";
import { referralIntakeSupabase } from "./supabase-admin";

type DocRow = {
  id: string;
  referral_id: string;
  filename: string;
  content_type: string | null;
  storage_path: string;
  storage_driver: string | null;
  extraction_role: string | null;
  conflict_resolution: string | null;
};

/**
 * Re-read stored attachments for multi-document referrals and label identity conflicts.
 * Does not delete documents. Safe to re-run.
 */
export async function backfillIdentityConflicts(args?: {
  clinicId?: string;
  referralId?: string;
  actor?: string;
}): Promise<{
  scannedReferrals: number;
  updatedReferrals: number;
  updatedDocuments: number;
  details: Array<{
    referralId: string;
    primary?: string;
    conflicts: string[];
  }>;
}> {
  const supabase = referralIntakeSupabase();
  const actor = args?.actor ?? "system-backfill";

  let referralQuery = supabase
    .from("referrals")
    .select("id, clinic_id, intake_event_id")
    .not("intake_event_id", "is", null);
  if (args?.clinicId) referralQuery = referralQuery.eq("clinic_id", args.clinicId);
  if (args?.referralId) referralQuery = referralQuery.eq("id", args.referralId);

  const { data: referrals, error: refError } = await referralQuery.limit(500);
  if (refError) throw new Error(refError.message);

  const details: Array<{ referralId: string; primary?: string; conflicts: string[] }> = [];
  let updatedReferrals = 0;
  let updatedDocuments = 0;
  let scannedReferrals = 0;

  for (const referral of referrals ?? []) {
    const { data: docs, error: docsError } = await supabase
      .from("referral_documents")
      .select(
        "id, referral_id, filename, content_type, storage_path, storage_driver, extraction_role, conflict_resolution"
      )
      .eq("referral_id", referral.id)
      .order("created_at", { ascending: true });
    if (docsError) throw new Error(docsError.message);
    if (!docs || docs.length < 2) continue;

    scannedReferrals += 1;

    const scored: Array<{
      doc: DocRow;
      full: {
        childFirst: string;
        childLast: string;
        childDob: string;
      };
      score: number;
    }> = [];

    for (const doc of docs as DocRow[]) {
      if (doc.storage_driver && doc.storage_driver !== "supabase") continue;
      try {
        const bytes = await readStoredReferralDocument(doc.storage_path);
        const result = await readReferralFromDocument({
          bytes,
          filename: doc.filename,
          contentType: doc.content_type || undefined,
        });
        const extract = result.extract;
        if (!extract) continue;
        let score = 0;
        if (extract.childFirst.trim() && extract.childLast.trim()) score += 4;
        if (extract.childDob.trim()) score += 2;
        if (extract.parentMobile.trim()) score += 2;
        if (extract.assessmentType) score += 2;
        if (extract.referrerName.trim()) score += 2;
        scored.push({
          doc,
          score,
          full: {
            childFirst: extract.childFirst,
            childLast: extract.childLast,
            childDob: extract.childDob,
          },
        });
      } catch (error) {
        console.warn(
          "[referral-intake] backfill skip doc",
          doc.id,
          error instanceof Error ? error.message : error
        );
      }
    }

    if (scored.length < 2) continue;

    scored.sort((a, b) => b.score - a.score);
    const primary = scored[0]!;
    const primaryIdentity = identityFromExtract(primary.full);
    const conflictNames: string[] = [];

    for (const item of scored) {
      const identity = identityFromExtract(item.full);
      const isPrimary = item.doc.id === primary.doc.id;
      const conflicts = !isPrimary && patientIdentitiesConflict(primaryIdentity, identity);
      const alreadyResolved =
        item.doc.conflict_resolution === "excluded" ||
        item.doc.conflict_resolution === "accepted_same_patient";

      let role = item.doc.extraction_role;
      if (isPrimary) role = "primary";
      else if (conflicts && !alreadyResolved) role = "conflict";
      else if (conflicts && item.doc.conflict_resolution === "excluded") role = "none";
      else if (conflicts && item.doc.conflict_resolution === "accepted_same_patient") {
        role = "supporting";
      } else if (!conflicts) {
        role = role === "primary" ? "supporting" : role || "supporting";
        if (role === "conflict") role = "supporting";
      }

      if (conflicts && !alreadyResolved) {
        conflictNames.push(`${item.doc.filename} → ${formatPatientIdentity(identity)}`);
      }

      const { error: upError } = await supabase
        .from("referral_documents")
        .update({
          extracted_child_first: item.full.childFirst || null,
          extracted_child_last: item.full.childLast || null,
          extracted_child_dob: item.full.childDob || null,
          contains_referral_info: true,
          identity_conflict: conflicts,
          extraction_role: role,
        })
        .eq("id", item.doc.id);
      if (upError) throw new Error(upError.message);
      updatedDocuments += 1;
    }

    const hasConflict = conflictNames.length > 0;
    const refPatch: Record<string, unknown> = {
      patient_identity_conflict: hasConflict,
      original_document_id: primary.doc.id,
    };
    if (hasConflict) {
      refPatch.needs_human_review = true;
      refPatch.dashboard_status = "awaiting_review";
      refPatch.extraction_status = "needs_review";
      refPatch.extraction_confidence = "low";
      refPatch.extraction_warnings = [
        "Possible different patient (historical backfill): attachments contain conflicting child identities.",
        `Primary patient: ${formatPatientIdentity(primaryIdentity)}.`,
        `Conflicting attachment(s): ${conflictNames.join("; ")}.`,
        "Staff must resolve the conflict before approving this referral.",
      ];
      updatedReferrals += 1;
    }

    const { error: refPatchError } = await supabase
      .from("referrals")
      .update(refPatch)
      .eq("id", referral.id);
    if (refPatchError) throw new Error(refPatchError.message);

    details.push({
      referralId: referral.id,
      primary: formatPatientIdentity(primaryIdentity),
      conflicts: conflictNames,
    });

    await writeReferralAudit({
      referralId: referral.id,
      clinicId: referral.clinic_id,
      actor,
      action: "intake.identity_conflict_backfill",
      detail: {
        primary: formatPatientIdentity(primaryIdentity),
        conflicts: conflictNames,
        hasConflict,
        liveCommsBlocked: true,
      },
    });
  }

  return { scannedReferrals, updatedReferrals, updatedDocuments, details };
}
