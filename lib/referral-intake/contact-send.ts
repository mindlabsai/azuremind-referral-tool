import {
  clinikoFindOrCreatePatient,
  clinikoListPatientAttachments,
  clinikoUpdateCustomFields,
  clinikoUploadPatientAttachment,
} from "@/lib/cliniko";
import {
  buildParentBookingEmailHtml,
  DEFAULT_CLINIKO_BOOKINGS,
  getParentBookingSms,
  getParentBookingSubject,
  type ParentBookingPathway,
} from "@/lib/referral-comms/parent-booking-email";
import { writeReferralAudit } from "./audit";
import {
  referralAutoFirstContactEnabled,
  referralLiveCommsEnabled,
} from "./config";
import {
  documentsEligibleForPatientComms,
  isUnresolvedIdentityConflict,
} from "./document-eligibility";
import { readStoredReferralDocument } from "./document-store";
import { assertStaffClinicAccess } from "./staff-access";
import { referralIntakeSupabase } from "./supabase-admin";

const DEFAULT_CLINIC_PHONE = "0422 182 967";
const REFERRAL_ATTACHMENT_DESCRIPTION = "GP referral — Texlex intake";

export type ContactSendChannel = "email" | "sms" | "email+sms";

/**
 * preview = compose only
 * simulate = labelled audit rehearsal only (no status / Cliniko / outbound)
 * live = real or synthetic-delivery send that updates operational status
 */
export type ContactSendMode = "preview" | "simulate" | "live";

export type ContactSendInput = {
  referralId: string;
  userId: string;
  actor?: string;
  channel: ContactSendChannel;
  /**
   * preview (default): no status change, no outbound.
   * simulate: audit-only rehearsal — must not change operational status or create Cliniko records.
   * live: real send (requires TEXLEX_REFERRAL_LIVE_COMMS=1), or syntheticDeliver under SYNTHETIC_API.
   */
  mode?: ContactSendMode;
  /** @deprecated Prefer mode. liveSend=true maps to mode=live. */
  liveSend?: boolean;
  /**
   * System/auto path only — skips clinic membership check.
   * Staff UI must never set this.
   */
  systemActor?: boolean;
  /**
   * Synthetic tests only (TEXLEX_REFERRAL_SYNTHETIC_API=1).
   * Exercises the live recording path without Resend/Twilio while LIVE_COMMS stays 0.
   */
  syntheticDeliver?: boolean;
  /** Synthetic tests only — force both channels to fail without recording success. */
  forceFailSend?: boolean;
  bookingLink?: string;
  clinicPhone?: string;
  fields?: {
    childFirst?: string;
    childLast?: string;
    childDob?: string;
    parentFirst?: string;
    parentLast?: string;
    parentEmail?: string;
    parentMobile?: string;
    assessmentType?: string;
    referrerName?: string;
  };
};

function syntheticApiEnabled(): boolean {
  return process.env.TEXLEX_REFERRAL_SYNTHETIC_API === "1";
}

function asPathway(value: string): ParentBookingPathway {
  const u = value.trim().toUpperCase();
  if (u === "ASD" || u === "SLD" || u === "ADHD") return u;
  return "ADHD";
}

function emailOk(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function resolveMode(input: ContactSendInput): ContactSendMode {
  if (input.mode === "preview" || input.mode === "simulate" || input.mode === "live") {
    return input.mode;
  }
  if (input.liveSend === true) return "live";
  return "preview";
}

async function sendEmailViaApi(args: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { Resend } = await import("resend");
    const key = process.env.RESEND_API_KEY?.trim();
    if (!key) return { ok: false, error: "Missing RESEND_API_KEY" };
    const resend = new Resend(key);
    const from =
      process.env.EMAIL_FROM_REFERRAL?.trim() || "Azure Mind <referrals@azuremind.com.au>";
    const replyTo = process.env.EMAIL_REPLY_TO?.trim() || "admin@azuremind.com.au";
    const { error } = await resend.emails.send({
      from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      replyTo,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function sendSmsViaApi(args: {
  to: string;
  message: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const token = process.env.TWILIO_AUTH_TOKEN?.trim();
    const from = process.env.TWILIO_FROM_NUMBER?.trim();
    if (!sid || !token || !from) return { ok: false, error: "Twilio is not configured" };
    const twilio = (await import("twilio")).default;
    const client = twilio(sid, token);
    await client.messages.create({ to: args.to, from, body: args.message });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function linkClinikoPatientAndDocument(args: {
  childFirst: string;
  childLast: string;
  childDob: string;
  parentFirst: string;
  parentLast: string;
  parentEmail: string;
  parentMobile: string;
  assessmentType: string;
  originalDocumentId: string | null;
  docRows: Array<Record<string, unknown>>;
}): Promise<{ clinikoPatientId: string | null; attachmentId: string | null; createdPatient: boolean }> {
  const { patient, created } = await clinikoFindOrCreatePatient({
    firstName: args.childFirst,
    lastName: args.childLast,
    dateOfBirth: args.childDob || undefined,
    email: args.parentEmail || "",
    phone: args.parentMobile || "",
  });
  await clinikoUpdateCustomFields(patient.id, {
    parent1FirstName: args.parentFirst,
    parent1LastName: args.parentLast,
    assessmentType: args.assessmentType,
  });

  let attachmentId: string | null = null;
  const eligible = documentsEligibleForPatientComms(
    args.docRows.map((d) => ({
      id: String(d.id),
      filename: typeof d.filename === "string" ? d.filename : null,
      extraction_role: typeof d.extraction_role === "string" ? d.extraction_role : null,
      identity_conflict: d.identity_conflict === true,
      conflict_resolution: typeof d.conflict_resolution === "string" ? d.conflict_resolution : null,
    }))
  );
  const primary =
    eligible.find((d) => d.id === args.originalDocumentId) ||
    eligible.find((d) => d.extraction_role === "primary") ||
    eligible[0];
  const primaryFull = primary
    ? (args.docRows.find((d) => String(d.id) === primary.id) as
        | {
            storage_path?: string | null;
            storage_driver?: string | null;
            content_type?: string | null;
            filename?: string | null;
          }
        | undefined)
    : undefined;

  if (primaryFull?.storage_path && primaryFull.storage_driver === "supabase") {
    const filename = primaryFull.filename || "referral.pdf";
    const existing = await clinikoListPatientAttachments(patient.id, { maxPages: 2 });
    const already = existing.find(
      (a) =>
        a.filename === filename &&
        (a.description || "").includes("Texlex intake")
    );
    if (already) {
      attachmentId = already.id;
    } else {
      const bytes = await readStoredReferralDocument(String(primaryFull.storage_path));
      const contentType =
        primaryFull.content_type?.trim() ||
        (filename.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream");
      const uploaded = await clinikoUploadPatientAttachment(
        patient.id,
        filename,
        bytes,
        contentType,
        REFERRAL_ATTACHMENT_DESCRIPTION
      );
      attachmentId = uploaded.id;
    }
  }

  return { clinikoPatientId: patient.id, attachmentId, createdPatient: created };
}

/**
 * Send or simulate booking email/SMS for an intake referral.
 * Does not re-extract. Blocks unresolved identity conflicts and duplicate sends.
 * Failed sends never set contact_attempted.
 */
export async function sendReferralBookingContact(
  input: ContactSendInput
): Promise<{
  ok: boolean;
  error?: string;
  dryRun?: boolean;
  simulated?: boolean;
  emailSent?: boolean;
  smsSent?: boolean;
  clinikoPatientId?: string | null;
  clinikoAttachmentId?: string | null;
  clinikoCreatedPatient?: boolean;
  dashboardStatus?: string;
  preview?: { subject: string; emailHtml: string; sms: string; toEmail: string; toMobile: string };
}> {
  const supabase = referralIntakeSupabase();
  const actor = input.actor?.trim() || "clinician";
  const mode = resolveMode(input);

  const allowSyntheticLive =
    mode === "live" &&
    Boolean(input.syntheticDeliver) &&
    syntheticApiEnabled() &&
    !referralLiveCommsEnabled();

  if (mode === "live" && !referralLiveCommsEnabled() && !allowSyntheticLive) {
    return {
      ok: false,
      error: "Live send blocked — TEXLEX_REFERRAL_LIVE_COMMS is off.",
    };
  }
  if (input.syntheticDeliver && !syntheticApiEnabled()) {
    return {
      ok: false,
      error: "syntheticDeliver requires TEXLEX_REFERRAL_SYNTHETIC_API=1.",
    };
  }
  if (input.forceFailSend && !syntheticApiEnabled()) {
    return {
      ok: false,
      error: "forceFailSend requires TEXLEX_REFERRAL_SYNTHETIC_API=1.",
    };
  }

  const { data: referral, error: loadError } = await supabase
    .from("referrals")
    .select(
      "id, clinic_id, child_first_name, child_last_name, child_dob, parent_first_name, parent_last_name, parent_email, parent_mobile, assessment_type, referring_practitioner, notes, dashboard_status, needs_human_review, patient_identity_conflict, sent_email, sent_sms, send_status, contact_status, cliniko_patient_id, original_document_id, booking_link, clinic_phone, follow_up_stage, next_follow_up_at"
    )
    .eq("id", input.referralId)
    .maybeSingle();

  if (loadError || !referral) {
    return { ok: false, error: loadError?.message || "Referral not found." };
  }

  if (!input.systemActor) {
    const access = await assertStaffClinicAccess({
      userId: input.userId,
      clinicId: referral.clinic_id ? String(referral.clinic_id) : null,
    });
    if (!access.ok) return { ok: false, error: access.error };
  }

  const { data: docs } = await supabase
    .from("referral_documents")
    .select(
      "id, filename, content_type, storage_driver, storage_path, extraction_role, identity_conflict, conflict_resolution, contains_referral_info"
    )
    .eq("referral_id", input.referralId);

  const docRows = (docs ?? []) as Array<Record<string, unknown>>;
  if (
    docRows.some((d) =>
      isUnresolvedIdentityConflict({
        id: String(d.id),
        extraction_role: typeof d.extraction_role === "string" ? d.extraction_role : null,
        identity_conflict: d.identity_conflict === true,
        conflict_resolution: typeof d.conflict_resolution === "string" ? d.conflict_resolution : null,
      })
    )
  ) {
    return {
      ok: false,
      error: "Cannot message parents until document patient conflicts are resolved.",
    };
  }
  if (
    (referral.patient_identity_conflict || referral.needs_human_review) &&
    referral.dashboard_status === "awaiting_review"
  ) {
    return {
      ok: false,
      error: "Cannot message parents while this referral still needs review.",
    };
  }

  const fields = {
    childFirst: (input.fields?.childFirst ?? referral.child_first_name ?? "").trim(),
    childLast: (input.fields?.childLast ?? referral.child_last_name ?? "").trim(),
    childDob: (input.fields?.childDob ?? referral.child_dob ?? "").trim(),
    parentFirst: (input.fields?.parentFirst ?? referral.parent_first_name ?? "").trim(),
    parentLast: (input.fields?.parentLast ?? referral.parent_last_name ?? "").trim(),
    parentEmail: (input.fields?.parentEmail ?? referral.parent_email ?? "").trim(),
    parentMobile: (input.fields?.parentMobile ?? referral.parent_mobile ?? "").trim(),
    assessmentType: asPathway(
      input.fields?.assessmentType ?? referral.assessment_type ?? "ADHD"
    ),
    referrerName: (input.fields?.referrerName ?? referral.referring_practitioner ?? "").trim(),
    bookingLink: (input.bookingLink ?? referral.booking_link ?? DEFAULT_CLINIKO_BOOKINGS).trim(),
    clinicPhone: (input.clinicPhone ?? referral.clinic_phone ?? DEFAULT_CLINIC_PHONE).trim(),
  };

  if (!fields.childFirst || !fields.childLast || !fields.childDob) {
    return { ok: false, error: "Child name and DOB are required before contact." };
  }

  const wantEmail = input.channel === "email" || input.channel === "email+sms";
  const wantSms = input.channel === "sms" || input.channel === "email+sms";

  if (wantEmail && !emailOk(fields.parentEmail)) {
    return { ok: false, error: "Valid parent email is required to send email." };
  }
  if (wantSms && !fields.parentMobile.trim()) {
    return { ok: false, error: "Parent mobile is required to send SMS." };
  }

  // Duplicate guard for live sends only — preview/simulate never block a later genuine send.
  if (mode === "live") {
    if (wantEmail && referral.sent_email) {
      return { ok: false, error: "Booking email already sent for this referral." };
    }
    if (wantSms && referral.sent_sms) {
      return { ok: false, error: "Booking SMS already sent for this referral." };
    }
  }

  const subject = getParentBookingSubject({
    childFirst: fields.childFirst,
    parentFirst: fields.parentFirst,
    referrerName: fields.referrerName,
    assessmentType: fields.assessmentType,
    bookingLink: fields.bookingLink,
    clinicPhone: fields.clinicPhone,
  });
  const emailHtml = buildParentBookingEmailHtml({
    childFirst: fields.childFirst,
    parentFirst: fields.parentFirst,
    referrerName: fields.referrerName,
    assessmentType: fields.assessmentType,
    bookingLink: fields.bookingLink,
    clinicPhone: fields.clinicPhone,
  });
  const sms = getParentBookingSms({
    childFirst: fields.childFirst,
    parentFirst: fields.parentFirst,
    referrerName: fields.referrerName,
    assessmentType: fields.assessmentType,
    bookingLink: fields.bookingLink,
    clinicPhone: fields.clinicPhone,
  });
  const preview = {
    subject,
    emailHtml,
    sms,
    toEmail: fields.parentEmail,
    toMobile: fields.parentMobile,
  };

  if (mode === "preview" || mode === "simulate") {
    await writeReferralAudit({
      referralId: referral.id,
      clinicId: referral.clinic_id,
      actor,
      action: mode === "simulate" ? "contact.simulate_only" : "contact.preview_only",
      detail: {
        channel: input.channel,
        mode,
        simulation: mode === "simulate",
        operationalStatusUnchanged: true,
        liveCommsEnabled: referralLiveCommsEnabled(),
        autoFirstContactEnabled: referralAutoFirstContactEnabled(),
        toEmail: fields.parentEmail || null,
        toMobile: fields.parentMobile || null,
        subject,
        wouldSendEmail: wantEmail,
        wouldSendSms: wantSms,
      },
    });
    return {
      ok: true,
      dryRun: true,
      simulated: mode === "simulate",
      emailSent: false,
      smsSent: false,
      clinikoPatientId: referral.cliniko_patient_id ?? null,
      dashboardStatus: referral.dashboard_status ?? undefined,
      preview,
    };
  }

  // ── live path only below ──
  let emailSent = false;
  let smsSent = false;
  const errors: string[] = [];

  if (input.forceFailSend) {
    errors.push("Forced send failure (synthetic test)");
  } else if (allowSyntheticLive) {
    emailSent = wantEmail;
    smsSent = wantSms;
  } else {
    if (wantEmail) {
      const result = await sendEmailViaApi({
        to: fields.parentEmail,
        subject,
        html: emailHtml,
      });
      if (result.ok) emailSent = true;
      else errors.push(`Email: ${result.error}`);
    }
    if (wantSms) {
      const result = await sendSmsViaApi({
        to: fields.parentMobile,
        message: sms,
      });
      if (result.ok) smsSent = true;
      else errors.push(`SMS: ${result.error}`);
    }
  }

  // Failed send must NOT be recorded as a successful contact attempt,
  // create Cliniko records, or start follow-ups.
  if (!emailSent && !smsSent) {
    await writeReferralAudit({
      referralId: referral.id,
      clinicId: referral.clinic_id,
      actor,
      action: "contact.send_failed",
      detail: {
        channel: input.channel,
        mode,
        syntheticDeliver: allowSyntheticLive,
        errors,
      },
    });
    return {
      ok: false,
      error: errors.join(" · ") || "Send failed.",
      clinikoPatientId: referral.cliniko_patient_id ?? null,
      preview,
      dashboardStatus: referral.dashboard_status ?? undefined,
    };
  }

  let clinikoPatientId = referral.cliniko_patient_id ? String(referral.cliniko_patient_id) : null;
  let clinikoAttachmentId: string | null = null;
  let clinikoCreatedPatient = false;
  try {
    const linked = await linkClinikoPatientAndDocument({
      ...fields,
      originalDocumentId: referral.original_document_id
        ? String(referral.original_document_id)
        : null,
      docRows,
    });
    clinikoPatientId = linked.clinikoPatientId;
    clinikoAttachmentId = linked.attachmentId;
    clinikoCreatedPatient = linked.createdPatient;
  } catch (clinikoError) {
    console.warn("[referral-intake] Cliniko link failed:", clinikoError);
  }

  const nextFollowUp = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const patch: Record<string, unknown> = {
    sent_email: Boolean(referral.sent_email) || emailSent,
    sent_sms: Boolean(referral.sent_sms) || smsSent,
    send_status:
      (Boolean(referral.sent_email) || emailSent) && (Boolean(referral.sent_sms) || smsSent)
        ? allowSyntheticLive
          ? "synthetic_sent"
          : "sent"
        : emailSent || smsSent
          ? allowSyntheticLive
            ? "synthetic_partial"
            : "partial"
          : referral.send_status,
    contact_status: "contact_attempted",
    dashboard_status: "contact_attempted",
    first_contact_at: new Date().toISOString(),
    cliniko_patient_id: clinikoPatientId,
    booking_link: fields.bookingLink,
    clinic_phone: fields.clinicPhone,
    follow_up_stage: referral.follow_up_stage ?? 0,
    next_follow_up_at: referral.next_follow_up_at ?? nextFollowUp,
    child_first_name: fields.childFirst,
    child_last_name: fields.childLast,
    child_dob: fields.childDob || null,
    parent_first_name: fields.parentFirst || null,
    parent_last_name: fields.parentLast || null,
    parent_email: fields.parentEmail || null,
    parent_mobile: fields.parentMobile || null,
    assessment_type: fields.assessmentType,
    referring_practitioner: fields.referrerName || null,
  };

  const { error: updateError } = await supabase.from("referrals").update(patch).eq("id", referral.id);
  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  await writeReferralAudit({
    referralId: referral.id,
    clinicId: referral.clinic_id,
    actor,
    action: allowSyntheticLive ? "contact.synthetic_send_succeeded" : "contact.send_succeeded",
    detail: {
      channel: input.channel,
      mode,
      syntheticDeliver: allowSyntheticLive,
      emailSent,
      smsSent,
      toEmail: emailSent ? fields.parentEmail : null,
      toMobile: smsSent ? fields.parentMobile : null,
      clinikoPatientId,
      clinikoAttachmentId,
      clinikoCreatedPatient,
      errors: errors.length ? errors : undefined,
      dashboardStatus: "contact_attempted",
      firstContactAt: patch.first_contact_at,
    },
  });

  return {
    ok: true,
    dryRun: false,
    simulated: false,
    emailSent,
    smsSent,
    clinikoPatientId,
    clinikoAttachmentId,
    clinikoCreatedPatient,
    dashboardStatus: "contact_attempted",
    preview,
  };
}

/**
 * Stage B: automatic first contact after auto-verify for THIS new referral only.
 * Requires LIVE_COMMS + AUTO_FIRST_CONTACT + newlyCreatedAndVerified.
 * Existing Ready-for-contact rows are never swept.
 */
export async function maybeAutoSendFirstContact(args: {
  referralId: string;
  clinicId?: string | null;
  /**
   * Must be true only for a referral just created+auto-verified in this request.
   * Existing inbox rows cannot be auto-contacted by flipping the env flag.
   */
  newlyCreatedAndVerified: boolean;
}): Promise<{ attempted: boolean; result?: Awaited<ReturnType<typeof sendReferralBookingContact>> }> {
  if (!referralLiveCommsEnabled() || !referralAutoFirstContactEnabled()) {
    return { attempted: false };
  }
  if (!args.newlyCreatedAndVerified) {
    return { attempted: false };
  }

  const supabase = referralIntakeSupabase();
  const { data: referral } = await supabase
    .from("referrals")
    .select(
      "id, dashboard_status, parent_email, parent_mobile, sent_email, sent_sms, patient_identity_conflict, needs_human_review, auto_ready_at"
    )
    .eq("id", args.referralId)
    .maybeSingle();
  if (!referral) return { attempted: false };
  if (referral.dashboard_status !== "ready_for_contact") return { attempted: false };
  if (!referral.auto_ready_at) return { attempted: false };
  if (referral.patient_identity_conflict || referral.needs_human_review) return { attempted: false };
  if (referral.sent_email || referral.sent_sms) return { attempted: false };

  const channel: ContactSendChannel =
    referral.parent_email && referral.parent_mobile
      ? "email+sms"
      : referral.parent_email
        ? "email"
        : referral.parent_mobile
          ? "sms"
          : "email";
  if (channel === "email" && !referral.parent_email) return { attempted: false };
  if (channel === "sms" && !referral.parent_mobile) return { attempted: false };

  const result = await sendReferralBookingContact({
    referralId: args.referralId,
    userId: "system",
    actor: "system.auto_first_contact",
    channel,
    mode: "live",
    systemActor: true,
  });
  return { attempted: true, result };
}
