import { writeReferralAudit } from "./audit";
import {
  documentsEligibleForPatientComms,
  isUnresolvedIdentityConflict,
} from "./document-eligibility";
import { identityFromExtract } from "./patient-identity";
import { referralIntakeSupabase } from "./supabase-admin";
import type { ReferralDashboardStatus } from "./types";

const ALLOWED: ReferralDashboardStatus[] = [
  "new",
  "awaiting_review",
  "ready_for_contact",
  "contacted",
  "booked",
  "closed",
  "processing_error",
];

export type ConflictResolution = "excluded" | "accepted_same_patient";

export type ReferralFieldPatch = {
  childFirst?: string;
  childLast?: string;
  childDob?: string;
  parentFirst?: string;
  parentLast?: string;
  parentEmail?: string;
  parentMobile?: string;
  assessmentType?: string;
  referrerName?: string;
  referrerType?: string;
  referrerEmail?: string;
  notes?: string;
};

function trimOrNull(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const t = value.trim();
  return t ? t : null;
}

function norm(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Human review / status transitions. Never sends parent email or SMS.
 * Approval is enforced server-side: unresolved conflicts and excluded-patient
 * field contamination both block ready_for_contact.
 */
export async function updateReferralDashboardStatus(args: {
  referralId: string;
  dashboardStatus: ReferralDashboardStatus;
  actor?: string;
  notes?: string;
  markFirstContact?: boolean;
  fields?: ReferralFieldPatch;
  documentResolutions?: Array<{ documentId: string; resolution: ConflictResolution }>;
}): Promise<{ ok: boolean; error?: string }> {
  if (!ALLOWED.includes(args.dashboardStatus)) {
    return { ok: false, error: "Invalid dashboard status." };
  }
  const supabase = referralIntakeSupabase();
  const actor = args.actor ?? "clinician";

  const { data: existing, error: loadError } = await supabase
    .from("referrals")
    .select(
      "id, clinic_id, patient_identity_conflict, child_first_name, child_last_name, child_dob, parent_first_name, parent_last_name, parent_email, parent_mobile, assessment_type, referring_practitioner, referring_practitioner_type, referring_practitioner_email, notes, original_document_id"
    )
    .eq("id", args.referralId)
    .maybeSingle();

  if (loadError || !existing) {
    return { ok: false, error: loadError?.message || "Referral not found." };
  }

  if (args.documentResolutions?.length) {
    for (const item of args.documentResolutions) {
      const { error: resError } = await supabase
        .from("referral_documents")
        .update({
          conflict_resolution: item.resolution,
          // Excluded: retain original bytes, drop from clinical referral set.
          extraction_role: item.resolution === "excluded" ? "none" : "supporting",
          identity_conflict:
            item.resolution === "accepted_same_patient" ? false : true,
        })
        .eq("id", item.documentId)
        .eq("referral_id", args.referralId);
      if (resError) {
        return { ok: false, error: resError.message };
      }
    }
    await writeReferralAudit({
      referralId: args.referralId,
      clinicId: existing.clinic_id,
      actor,
      action: "referral.document_conflict_resolved",
      detail: { resolutions: args.documentResolutions, liveCommsBlocked: true },
    });
  }

  const { data: docs } = await supabase
    .from("referral_documents")
    .select(
      "id, filename, extraction_role, identity_conflict, conflict_resolution, extracted_child_first, extracted_child_last, extracted_child_dob"
    )
    .eq("referral_id", args.referralId);

  const docRows = docs ?? [];
  const unresolvedConflicts = docRows.filter((doc) => isUnresolvedIdentityConflict(doc));

  const approving = args.dashboardStatus === "ready_for_contact";
  if (approving && unresolvedConflicts.length) {
    return {
      ok: false,
      error:
        "Approval unavailable until document patient conflicts are resolved (exclude or confirm same patient).",
    };
  }

  const fields = args.fields ?? {};
  const patch: Record<string, unknown> = {
    dashboard_status: args.dashboardStatus,
    needs_human_review: args.dashboardStatus === "awaiting_review",
  };

  const fieldMap: Array<[keyof ReferralFieldPatch, string]> = [
    ["childFirst", "child_first_name"],
    ["childLast", "child_last_name"],
    ["childDob", "child_dob"],
    ["parentFirst", "parent_first_name"],
    ["parentLast", "parent_last_name"],
    ["parentEmail", "parent_email"],
    ["parentMobile", "parent_mobile"],
    ["assessmentType", "assessment_type"],
    ["referrerName", "referring_practitioner"],
    ["referrerType", "referring_practitioner_type"],
    ["referrerEmail", "referring_practitioner_email"],
    ["notes", "notes"],
  ];
  const changed: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, column] of fieldMap) {
    const next = trimOrNull(fields[key]);
    if (next === undefined) continue;
    const prev = (existing as Record<string, unknown>)[column];
    if (String(prev ?? "") !== String(next ?? "")) {
      changed[column] = { from: prev ?? null, to: next };
    }
    patch[column] = next;
  }
  if (typeof args.notes === "string" && fields.notes === undefined) {
    patch.notes = args.notes;
  }

  const approvedIdentity = identityFromExtract({
    childFirst: String(patch.child_first_name ?? existing.child_first_name ?? ""),
    childLast: String(patch.child_last_name ?? existing.child_last_name ?? ""),
    childDob: String(patch.child_dob ?? existing.child_dob ?? ""),
  });

  if (approving) {
    if (!approvedIdentity.childFirst.trim() || !approvedIdentity.childLast.trim()) {
      return { ok: false, error: "Child first and last name are required before approval." };
    }

    // Excluded documents must not contribute identity to the approved record.
    const excluded = docRows.filter((d) => d.conflict_resolution === "excluded");
    for (const doc of excluded) {
      const excludedIdentity = identityFromExtract({
        childFirst: String(doc.extracted_child_first ?? ""),
        childLast: String(doc.extracted_child_last ?? ""),
        childDob: String(doc.extracted_child_dob ?? ""),
      });
      if (
        excludedIdentity.childFirst &&
        excludedIdentity.childLast &&
        norm(approvedIdentity.childFirst) === norm(excludedIdentity.childFirst) &&
        norm(approvedIdentity.childLast) === norm(excludedIdentity.childLast)
      ) {
        return {
          ok: false,
          error: `Approved child identity matches excluded document "${doc.filename}". Correct the child name fields so they do not use the excluded patient's details.`,
        };
      }
    }

    // Ensure original_document_id points at an eligible primary/supporting doc, never excluded.
    const eligible = documentsEligibleForPatientComms(docRows);
    if (!eligible.length) {
      return {
        ok: false,
        error: "No eligible referral documents remain after exclusions.",
      };
    }
    const preferred =
      eligible.find((d) => d.extraction_role === "primary")?.id ||
      eligible[0]?.id ||
      null;
    if (preferred) patch.original_document_id = preferred;

    patch.extraction_status = "extracted";
    patch.needs_human_review = false;
    patch.patient_identity_conflict = false;
  }

  if (args.dashboardStatus === "contacted" || args.markFirstContact) {
    patch.contact_status = "contacted";
    patch.first_contact_at = new Date().toISOString();
  }
  if (args.dashboardStatus === "booked") {
    patch.booking_status = "booked";
  }
  if (args.dashboardStatus === "closed") {
    patch.closed_at = new Date().toISOString();
    patch.status = "closed";
  }

  if (!unresolvedConflicts.length) {
    patch.patient_identity_conflict = false;
  } else if (!approving) {
    patch.patient_identity_conflict = true;
    patch.needs_human_review = true;
  }

  const { data, error } = await supabase
    .from("referrals")
    .update(patch)
    .eq("id", args.referralId)
    .select("id, clinic_id")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: error?.message || "Referral update failed." };
  }

  await writeReferralAudit({
    referralId: data.id,
    clinicId: data.clinic_id,
    actor,
    action: approving ? "referral.approved" : "referral.status_updated",
    detail: {
      dashboardStatus: args.dashboardStatus,
      fieldChanges: changed,
      documentResolutions: args.documentResolutions ?? [],
      unresolvedConflictsRemaining: unresolvedConflicts.length,
      eligibleDocumentIds: approving
        ? documentsEligibleForPatientComms(docRows).map((d) => d.id)
        : undefined,
      liveCommsBlocked: true,
      parentEmailSmsSent: false,
    },
  });

  return { ok: true };
}

/**
 * Staff audit of an auto-ready decision against the original letter.
 * Wrong-child / wrong-parent findings should be marked incorrect immediately.
 */
export async function recordAutoReadyQa(args: {
  referralId: string;
  status: "confirmed" | "incorrect";
  notes?: string;
  actor?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = referralIntakeSupabase();
  const actor = args.actor?.trim() || "clinician";
  const { data: existing, error: loadError } = await supabase
    .from("referrals")
    .select("id, clinic_id, auto_ready_at, auto_ready_qa_status, dashboard_status")
    .eq("id", args.referralId)
    .maybeSingle();
  if (loadError || !existing) {
    return { ok: false, error: loadError?.message || "Referral not found." };
  }
  if (!existing.auto_ready_at) {
    return { ok: false, error: "Referral was not auto-ready — QA sample only applies to auto-verified rows." };
  }

  const patch: Record<string, unknown> = {
    auto_ready_qa_status: args.status,
    auto_ready_qa_notes: args.notes?.trim() || null,
    auto_ready_qa_at: new Date().toISOString(),
    auto_ready_qa_by: actor,
  };
  if (args.status === "incorrect") {
    patch.dashboard_status = "awaiting_review";
    patch.needs_human_review = true;
  }

  const { error } = await supabase.from("referrals").update(patch).eq("id", args.referralId);
  if (error) return { ok: false, error: error.message };

  await writeReferralAudit({
    referralId: args.referralId,
    clinicId: existing.clinic_id,
    actor,
    action: args.status === "confirmed" ? "qa.auto_ready_confirmed" : "qa.auto_ready_incorrect",
    detail: {
      notes: args.notes ?? null,
      priorDashboardStatus: existing.dashboard_status,
      pulledBackToReview: args.status === "incorrect",
      liveCommsBlocked: true,
    },
  });

  return { ok: true };
}
