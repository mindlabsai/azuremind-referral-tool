import type { ReferralReaderExtract } from "@/lib/referral-reader/types";
import { blockingExtractionWarnings } from "./status";
import type { DocumentExtractionOutcome } from "./multi-extract";

export type AutoVerifyCheckId =
  | "child_identity"
  | "identity_anchor"
  | "parent_contact"
  | "referring_gp"
  | "same_patient_documents"
  | "no_identity_conflict"
  | "not_soft_duplicate"
  | "extract_quality"
  | "no_blocking_warnings";

export type AutoVerifyCheck = {
  id: AutoVerifyCheckId;
  ok: boolean;
  detail: string;
};

export type AutoVerifyResult = {
  /** True → referral may move straight to ready_for_contact (no parent comms). */
  autoReady: boolean;
  checks: AutoVerifyCheck[];
  reasons: string[];
};

function auMobileOk(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return /^(?:\+?61|0)?4\d{8}$/.test(digits) || /^04\d{8}$/.test(digits);
}

function emailOk(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function dobOk(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return false;
  const d = new Date(value.trim() + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return false;
  const year = d.getUTCFullYear();
  return year >= 1995 && year <= new Date().getUTCFullYear();
}

/**
 * Deterministic second-pass verification after extraction.
 * Patient matching uses child name + DOB only — never parent mobile alone
 * (siblings share a parent's number).
 * Parent email/SMS are never sent from this decision.
 */
export function verifyReferralForAutoReady(args: {
  extract: ReferralReaderExtract;
  hasIdentityConflict: boolean;
  softDuplicateOfReferralId?: string;
  outcomes?: DocumentExtractionOutcome[];
}): AutoVerifyResult {
  const { extract, hasIdentityConflict, softDuplicateOfReferralId, outcomes = [] } = args;
  const checks: AutoVerifyCheck[] = [];

  const hasChild = Boolean(extract.childFirst.trim() && extract.childLast.trim());
  checks.push({
    id: "child_identity",
    ok: hasChild,
    detail: hasChild
      ? `Child identity present: ${extract.childFirst.trim()} ${extract.childLast.trim()}`
      : "Child first and last name missing",
  });

  // Patient-specific identifier only. Parent mobile is contact data, not an identity anchor.
  const hasDob = Boolean(extract.childDob.trim() && dobOk(extract.childDob));
  checks.push({
    id: "identity_anchor",
    ok: hasDob,
    detail: hasDob
      ? `Child DOB verified (patient-specific): ${extract.childDob.trim()}`
      : "Valid child DOB (YYYY-MM-DD) required for auto-ready — parent mobile alone cannot identify the child",
  });

  const hasMobile = Boolean(extract.parentMobile.trim() && auMobileOk(extract.parentMobile));
  const hasParentEmail = Boolean(extract.parentEmail.trim() && emailOk(extract.parentEmail));
  const parentContact = hasMobile || hasParentEmail;
  checks.push({
    id: "parent_contact",
    ok: parentContact,
    detail: parentContact
      ? hasMobile
        ? `Parent mobile (contact only): ${extract.parentMobile.trim()}`
        : `Parent email (contact only): ${extract.parentEmail.trim()}`
      : "Missing parent/guardian mobile or email — staff review required",
  });

  const hasGp = Boolean(extract.referrerName.trim());
  checks.push({
    id: "referring_gp",
    ok: hasGp,
    detail: hasGp
      ? `Referring practitioner: ${extract.referrerName.trim()}`
      : "Referring GP/clinician name missing",
  });

  checks.push({
    id: "no_identity_conflict",
    ok: !hasIdentityConflict,
    detail: hasIdentityConflict
      ? "Cross-document patient identity conflict detected"
      : "No cross-document patient identity conflict",
  });

  const referralDocs = outcomes.filter((o) => o.containsReferralInfo);
  const samePatientDocs =
    !hasIdentityConflict &&
    (referralDocs.length <= 1 ||
      referralDocs.every((o) => o.role === "primary" || o.role === "supporting"));
  checks.push({
    id: "same_patient_documents",
    ok: samePatientDocs,
    detail: hasIdentityConflict
      ? "Supporting documents conflict with primary patient"
      : referralDocs.length > 1
        ? `${referralDocs.length} referral-bearing attachments relate to the same child (name/DOB)`
        : "Single referral-bearing attachment",
  });

  const notSoftDup = !softDuplicateOfReferralId;
  checks.push({
    id: "not_soft_duplicate",
    ok: notSoftDup,
    detail: softDuplicateOfReferralId
      ? `Likely duplicate of existing referral ${softDuplicateOfReferralId}`
      : "No soft patient duplicate in clinic window",
  });

  const qualityOk = extract.confidence !== "low";
  checks.push({
    id: "extract_quality",
    ok: qualityOk,
    detail: qualityOk
      ? `Extract confidence acceptable: ${extract.confidence}`
      : "Extract confidence is low — staff review required",
  });

  const blocking = blockingExtractionWarnings(extract.warnings);
  checks.push({
    id: "no_blocking_warnings",
    ok: blocking.length === 0,
    detail:
      blocking.length === 0
        ? "No blocking extraction warnings"
        : `Blocking warnings: ${blocking.slice(0, 3).join(" | ")}`,
  });

  const failed = checks.filter((c) => !c.ok);
  return {
    autoReady: failed.length === 0,
    checks,
    reasons: failed.map((c) => c.detail),
  };
}

/** @deprecated Prefer async referralAutoReadyEnabled from ops-flags (DB-backed). */
export { referralAutoReadyEnabled } from "./ops-flags";
