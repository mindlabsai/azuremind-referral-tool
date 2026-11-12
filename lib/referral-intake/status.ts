import type { ReferralReaderExtract } from "@/lib/referral-reader/types";
import type {
  ReferralContactStatus,
  ReferralDashboardStatus,
  ReferralExtractionStatus,
} from "./types";

/**
 * Warnings that are informational only — they must not force human review
 * when core identity is present and confidence is medium/high.
 */
export function isInformationalExtractionWarning(warning: string): boolean {
  const w = warning.trim();
  if (!w) return true;
  if (/^Processed \d+ attachment/i.test(w)) return true;
  if (/outside the page boundary/i.test(w)) return true;
  if (/Parent first name|Parent last name|parent email are often absent/i.test(w)) return true;
  if (/HealthLink|fax|practice phone/i.test(w)) return true;
  return false;
}

export function blockingExtractionWarnings(warnings: string[]): string[] {
  return warnings.filter((w) => !isInformationalExtractionWarning(w));
}

/**
 * Baseline extract completeness (used when auto-verify is off / unavailable):
 * - Child first + last + DOB required (patient-specific; never mobile alone)
 * - medium or high confidence
 * - no blocking warnings
 * Identity conflicts are handled separately and always force review.
 */
export function deriveExtractionStatus(extract: ReferralReaderExtract): ReferralExtractionStatus {
  const hasChild = Boolean(extract.childFirst.trim() && extract.childLast.trim());
  const hasDob = Boolean(extract.childDob.trim());
  const blocking = blockingExtractionWarnings(extract.warnings);

  if (!hasChild) return "needs_review";
  if (!hasDob) return "needs_review";
  if (extract.confidence === "low") return "needs_review";
  if (blocking.length > 0) return "needs_review";
  return "extracted";
}

export function deriveDashboardStatus(args: {
  extractionStatus: ReferralExtractionStatus;
  contactStatus: ReferralContactStatus;
  bookingStatus: string;
  failed?: boolean;
  /** When true, never skip human review (e.g. cross-document patient conflict). */
  forceReview?: boolean;
}): ReferralDashboardStatus {
  if (args.failed) return "processing_error";
  if (args.bookingStatus === "booked") return "booked";
  if (args.contactStatus === "contacted" || args.contactStatus === "contact_attempted") {
    return "contacted";
  }
  if (args.forceReview || args.extractionStatus === "needs_review" || args.extractionStatus === "failed") {
    return "awaiting_review";
  }
  if (args.extractionStatus === "extracted") return "ready_for_contact";
  return "new";
}

export function dashboardLabel(status: string | null | undefined): string {
  switch (status) {
    case "new":
      return "New referrals";
    case "awaiting_review":
      return "Awaiting review";
    case "ready_for_contact":
      return "Ready for contact";
    case "contacted":
      return "Contacted";
    case "booked":
      return "Booked";
    case "closed":
      return "Closed";
    case "processing_error":
      return "Processing errors";
    default:
      return status?.trim() || "Unknown";
  }
}
