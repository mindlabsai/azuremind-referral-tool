import type { ReferralAssessmentType, ReferralReaderExtract } from "@/lib/referral-reader/types";

export type ReferralDashboardStatus =
  | "new"
  | "awaiting_review"
  | "ready_for_contact"
  | "contacted"
  | "booked"
  | "closed"
  | "processing_error";

export type ReferralExtractionStatus =
  | "pending"
  | "extracted"
  | "needs_review"
  | "failed";

export type ReferralContactStatus =
  | "not_contacted"
  | "contact_attempted"
  | "contacted"
  | "opted_out";

export type ReferralBookingStatus =
  | "not_booked"
  | "booked"
  | "cancelled"
  | "declined"
  | "unknown";

export type ReferralSource =
  | "gp_email"
  | "manual_upload"
  | "self_referral"
  | "internal"
  | "other";

export type IntakeProcessingStatus =
  | "received"
  | "processing"
  | "extracted"
  | "needs_review"
  | "ready"
  | "failed"
  | "duplicate";

export type ClinicRecord = {
  id: string;
  slug: string;
  display_name: string;
  timezone: string;
  active: boolean;
};

export type IntakeDocumentInput = {
  filename: string;
  contentType: string;
  bytes: Buffer;
};

export type IntakeEmailContext = {
  provider: "gmail" | "synthetic" | "manual";
  providerMessageId: string;
  providerThreadId?: string;
  historyId?: string;
  fromAddress?: string;
  subject?: string;
  receivedAt: string;
  mailboxEmail?: string;
};

export type CreateIntakeReferralInput = {
  clinicSlug: string;
  source: ReferralSource;
  email?: IntakeEmailContext;
  documents: IntakeDocumentInput[];
  /** When set, skip Claude and use this extract (synthetic tests). */
  forcedExtract?: ReferralReaderExtract;
  actor?: string;
};

export type CreateIntakeReferralResult = {
  ok: boolean;
  referralId?: string;
  intakeEventId?: string;
  documentIds?: string[];
  dashboardStatus?: ReferralDashboardStatus;
  duplicateOfReferralId?: string;
  extract?: ReferralReaderExtract;
  error?: string;
};

export type ReferralInboxRow = {
  id: string;
  clinic_id: string | null;
  clinic_slug?: string | null;
  clinic_name?: string | null;
  child_first_name: string | null;
  child_last_name: string | null;
  child_dob: string | null;
  parent_first_name: string | null;
  parent_last_name: string | null;
  parent_email: string | null;
  parent_mobile: string | null;
  assessment_type: string | null;
  referring_practitioner: string | null;
  referral_source: string | null;
  received_at: string | null;
  first_contact_at: string | null;
  created_at: string | null;
  extraction_status: string | null;
  extraction_confidence: string | null;
  extraction_warnings: unknown;
  contact_status: string | null;
  booking_status: string | null;
  dashboard_status: string | null;
  needs_human_review: boolean | null;
  status: string | null;
  notes: string | null;
  original_document_id: string | null;
  original_document_filename?: string | null;
  intake_event_id?: string | null;
  patient_identity_conflict?: boolean | null;
  referring_practitioner_type?: string | null;
  referring_practitioner_email?: string | null;
  auto_ready_at?: string | null;
  auto_ready_qa_status?: "pending" | "confirmed" | "incorrect" | string | null;
  documents?: Array<{
    id: string;
    filename: string;
    content_type: string | null;
    contains_referral_info: boolean | null;
    extraction_role: string | null;
    identity_conflict?: boolean | null;
    conflict_resolution?: string | null;
    extracted_child_first?: string | null;
    extracted_child_last?: string | null;
    extracted_child_dob?: string | null;
  }>;
};

export type AssessmentRequested = ReferralAssessmentType | "";
