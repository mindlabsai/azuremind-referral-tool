import { readReferralFromDocument } from "@/lib/referral-reader/extract";
import {
  classifyReferralAttachment,
  extractionPriority,
  type ReferralAttachmentKind,
} from "@/lib/referral-reader/attachment-kinds";
import {
  emptyReferralExtract,
  type ReferralReaderExtract,
} from "@/lib/referral-reader/types";
import {
  formatPatientIdentity,
  identityFromExtract,
  patientIdentitiesConflict,
} from "./patient-identity";
import type { IntakeDocumentInput } from "./types";

export type DocumentExtractionRole = "primary" | "supporting" | "none" | "conflict";

export type DocumentExtractionOutcome = {
  index: number;
  filename: string;
  contentType: string;
  kind: ReferralAttachmentKind | null;
  extract: ReferralReaderExtract;
  score: number;
  containsReferralInfo: boolean;
  role: DocumentExtractionRole;
  identityConflict: boolean;
  error?: string;
};

function scoreExtract(extract: ReferralReaderExtract): number {
  let score = 0;
  if (extract.childFirst.trim()) score += 2;
  if (extract.childLast.trim()) score += 2;
  if (extract.childFirst.trim() && extract.childLast.trim()) score += 2;
  if (extract.childDob.trim()) score += 2;
  if (extract.parentMobile.trim()) score += 2;
  if (extract.parentEmail.trim()) score += 1;
  if (extract.parentFirst.trim() || extract.parentLast.trim()) score += 1;
  if (extract.assessmentType) score += 2;
  if (extract.referrerName.trim()) score += 2;
  if (extract.confidence === "high") score += 2;
  else if (extract.confidence === "medium") score += 1;
  return score;
}

/** Enough signal that this attachment is a referral (or clearly part of one). */
export function extractContainsReferralInfo(extract: ReferralReaderExtract): boolean {
  const hasChild = Boolean(extract.childFirst.trim() && extract.childLast.trim());
  const hasDob = Boolean(extract.childDob.trim());
  const hasParentContact = Boolean(extract.parentMobile.trim() || extract.parentEmail.trim());
  const hasReferrer = Boolean(extract.referrerName.trim());
  const hasAssessment = Boolean(extract.assessmentType);
  return (
    hasChild ||
    (hasDob && hasParentContact) ||
    (hasReferrer && (hasAssessment || hasParentContact || hasDob)) ||
    scoreExtract(extract) >= 5
  );
}

function pick(a: string, b: string): string {
  return a.trim() ? a : b;
}

/**
 * Fill blanks on the primary extract from same-patient supporting docs only.
 * Never call this with conflicting patient extracts.
 */
export function mergeReferralExtracts(
  primary: ReferralReaderExtract,
  supporting: ReferralReaderExtract[]
): ReferralReaderExtract {
  let merged = { ...primary, warnings: [...primary.warnings] };
  for (const next of supporting) {
    merged = {
      childFirst: pick(merged.childFirst, next.childFirst),
      childLast: pick(merged.childLast, next.childLast),
      childDob: pick(merged.childDob, next.childDob),
      parentFirst: pick(merged.parentFirst, next.parentFirst),
      parentLast: pick(merged.parentLast, next.parentLast),
      parentEmail: pick(merged.parentEmail, next.parentEmail),
      parentMobile: pick(merged.parentMobile, next.parentMobile),
      assessmentType: (pick(merged.assessmentType, next.assessmentType) ||
        "") as ReferralReaderExtract["assessmentType"],
      referrerName: pick(merged.referrerName, next.referrerName),
      referrerType: pick(merged.referrerType, next.referrerType),
      referrerEmail: pick(merged.referrerEmail, next.referrerEmail),
      internalNotes: pick(merged.internalNotes, next.internalNotes),
      confidence: merged.confidence === "low" ? next.confidence : merged.confidence,
      warnings: merged.warnings,
    };
  }
  return merged;
}

/**
 * Run extraction on every attachment. Preserve all outcomes so non-referral
 * files stay stored and labelled rather than discarded.
 * Conflicting child identities are never merged into the primary extract.
 */
export async function extractAcrossDocuments(
  documents: IntakeDocumentInput[],
  forced?: ReferralReaderExtract
): Promise<{
  extract: ReferralReaderExtract;
  error?: string;
  outcomes: DocumentExtractionOutcome[];
  primaryIndex: number | null;
  hasIdentityConflict: boolean;
}> {
  if (forced) {
    return {
      extract: forced,
      outcomes: documents.map((doc, index) => ({
        index,
        filename: doc.filename,
        contentType: doc.contentType,
        kind: classifyReferralAttachment(doc),
        extract: forced,
        score: scoreExtract(forced),
        containsReferralInfo: true,
        role: index === 0 ? "primary" : "supporting",
        identityConflict: false,
      })),
      primaryIndex: documents.length ? 0 : null,
      hasIdentityConflict: false,
    };
  }

  if (!documents.length) {
    const extract = emptyReferralExtract();
    extract.warnings = ["No supported attachment (PDF, JPEG, PNG, or DOCX) on the inbound email."];
    return {
      extract,
      error: "No supported attachment found.",
      outcomes: [],
      primaryIndex: null,
      hasIdentityConflict: false,
    };
  }

  const order = documents
    .map((doc, index) => ({
      index,
      doc,
      kind: classifyReferralAttachment(doc),
    }))
    .sort((a, b) => {
      const pa = a.kind ? extractionPriority(a.kind) : 99;
      const pb = b.kind ? extractionPriority(b.kind) : 99;
      return pa - pb || a.index - b.index;
    });

  const byIndex = new Map<number, DocumentExtractionOutcome>();

  for (const item of order) {
    const kind = item.kind;
    if (!kind) {
      byIndex.set(item.index, {
        index: item.index,
        filename: item.doc.filename,
        contentType: item.doc.contentType,
        kind: null,
        extract: emptyReferralExtract(),
        score: 0,
        containsReferralInfo: false,
        role: "none",
        identityConflict: false,
        error: "Unsupported attachment type",
      });
      continue;
    }

    try {
      const result = await readReferralFromDocument({
        bytes: item.doc.bytes,
        filename: item.doc.filename,
        contentType: item.doc.contentType,
        kind,
      });
      const extract = result.extract ?? emptyReferralExtract();
      if (!result.success && result.error) {
        extract.warnings = [...extract.warnings, result.error];
      }
      const score = scoreExtract(extract);
      const containsReferralInfo = extractContainsReferralInfo(extract);
      byIndex.set(item.index, {
        index: item.index,
        filename: item.doc.filename,
        contentType: item.doc.contentType,
        kind,
        extract,
        score,
        containsReferralInfo,
        role: "none",
        identityConflict: false,
        error: result.success ? undefined : result.error,
      });
    } catch (error) {
      byIndex.set(item.index, {
        index: item.index,
        filename: item.doc.filename,
        contentType: item.doc.contentType,
        kind,
        extract: emptyReferralExtract(),
        score: 0,
        containsReferralInfo: false,
        role: "none",
        identityConflict: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const outcomes = documents.map((_, index) => byIndex.get(index)!);
  const referralBearing = outcomes
    .filter((o) => o.containsReferralInfo)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  if (!referralBearing.length) {
    const best = [...outcomes].sort((a, b) => b.score - a.score || a.index - b.index)[0];
    if (best) best.role = "primary";
    const extract = best?.extract ?? emptyReferralExtract();
    if (!extract.warnings.length) {
      extract.warnings = [
        "Attachments were saved, but none clearly contained referral patient/parent/GP details.",
      ];
    }
    return {
      extract,
      error: best?.error || "Could not extract referral details from any attachment.",
      outcomes,
      primaryIndex: best?.index ?? null,
      hasIdentityConflict: false,
    };
  }

  const primary = referralBearing[0]!;
  primary.role = "primary";
  primary.identityConflict = false;
  const primaryIdentity = identityFromExtract(primary.extract);

  const samePatient: DocumentExtractionOutcome[] = [];
  const conflicts: DocumentExtractionOutcome[] = [];

  for (const extra of referralBearing.slice(1)) {
    const otherIdentity = identityFromExtract(extra.extract);
    if (patientIdentitiesConflict(primaryIdentity, otherIdentity)) {
      extra.role = "conflict";
      extra.identityConflict = true;
      conflicts.push(extra);
    } else {
      extra.role = "supporting";
      extra.identityConflict = false;
      samePatient.push(extra);
    }
  }

  const merged = mergeReferralExtracts(
    primary.extract,
    samePatient.map((o) => o.extract)
  );

  if (conflicts.length) {
    merged.confidence = "low";
    const conflictLabels = conflicts.map((o) => {
      const who = formatPatientIdentity(identityFromExtract(o.extract));
      return `${o.filename} → ${who}`;
    });
    merged.warnings = [
      ...merged.warnings,
      "Possible different patient: primary and supporting documents contain conflicting child identities. Information from conflicting attachments was not merged.",
      `Primary patient: ${formatPatientIdentity(primaryIdentity)}.`,
      `Conflicting attachment(s): ${conflictLabels.join("; ")}.`,
      "Staff must resolve the conflict before approving this referral.",
    ];
  }

  if (outcomes.length > 1) {
    const labels = outcomes.map((o) => {
      const tag =
        o.role === "primary"
          ? "primary referral"
          : o.role === "supporting"
            ? "supporting referral"
            : o.role === "conflict"
              ? "different patient"
              : "stored only";
      return `${o.filename} (${tag})`;
    });
    merged.warnings = [
      ...merged.warnings,
      `Processed ${outcomes.length} attachment(s): ${labels.join("; ")}.`,
    ];
  }

  return {
    extract: merged,
    outcomes,
    primaryIndex: primary.index,
    hasIdentityConflict: conflicts.length > 0,
  };
}
