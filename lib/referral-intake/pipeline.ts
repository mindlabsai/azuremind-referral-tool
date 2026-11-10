import { writeReferralAudit } from "./audit";
import { resolveClinicBySlug } from "./clinics";
import { referralLiveCommsEnabled } from "./config";
import { storeReferralDocument } from "./document-store";
import { isLikelySamePatient, providerDedupeKey } from "./duplicate";
import { verifyReferralForAutoReady } from "./auto-verify";
import { extractAcrossDocuments } from "./multi-extract";
import { referralAutoReadyEnabled } from "./ops-flags";
import { deriveDashboardStatus, deriveExtractionStatus } from "./status";
import { referralIntakeSupabase } from "./supabase-admin";
import type {
  CreateIntakeReferralInput,
  CreateIntakeReferralResult,
  ReferralContactStatus,
} from "./types";

/**
 * Create a referral from an inbound (or synthetic/manual) email + attachments.
 * Idempotent on provider message id. Does not send parent email/SMS.
 */
export async function createReferralFromIntake(
  input: CreateIntakeReferralInput
): Promise<CreateIntakeReferralResult> {
  if (referralLiveCommsEnabled()) {
    // Safety: intake must never auto-message parents in Phase 1 even if the flag is flipped.
    console.warn(
      "[referral-intake] TEXLEX_REFERRAL_LIVE_COMMS is on, but intake still will not send parent messages."
    );
  }

  const clinic = await resolveClinicBySlug(input.clinicSlug);
  const actor = input.actor ?? "system";
  const provider = input.email?.provider ?? "manual";
  const providerMessageId =
    input.email?.providerMessageId?.trim() ||
    `manual:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
  const dedupeKey = providerDedupeKey(provider, providerMessageId);
  const receivedAt = input.email?.receivedAt || new Date().toISOString();

  let supabase;
  try {
    supabase = referralIntakeSupabase();
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Supabase unavailable",
    };
  }

  // Idempotency: existing intake event for this provider message
  const { data: existingEvent } = await supabase
    .from("referral_intake_events")
    .select("id, processing_status")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();

  if (existingEvent?.id) {
    const { data: existingReferral } = await supabase
      .from("referrals")
      .select("id, dashboard_status")
      .eq("intake_event_id", existingEvent.id)
      .maybeSingle();

    const canRetry =
      existingEvent.processing_status === "failed" ||
      existingEvent.processing_status === "processing" ||
      existingReferral?.dashboard_status === "processing_error";

    if (!canRetry) {
      await writeReferralAudit({
        referralId: existingReferral?.id,
        intakeEventId: existingEvent.id,
        clinicId: clinic.id,
        actor,
        action: "intake.duplicate_message",
        detail: { dedupeKey, providerMessageId },
      });
      return {
        ok: true,
        referralId: existingReferral?.id,
        intakeEventId: existingEvent.id,
        dashboardStatus:
          (existingReferral?.dashboard_status as CreateIntakeReferralResult["dashboardStatus"]) ||
          "new",
        duplicateOfReferralId: existingReferral?.id,
      };
    }

    // Failed prior run — clear the referral stub + DB document rows so recover can retry.
    // Supabase Storage objects are retained (content-addressed upsert); sha256 uniqueness
    // prevents duplicate document rows when the same PDF is processed again.
    if (existingReferral?.id) {
      await supabase.from("referral_documents").update({ referral_id: null }).eq("referral_id", existingReferral.id);
      await supabase.from("referrals").delete().eq("id", existingReferral.id);
    }
    await supabase.from("referral_documents").delete().eq("intake_event_id", existingEvent.id);
    await supabase.from("referral_intake_events").delete().eq("id", existingEvent.id);
    await writeReferralAudit({
      clinicId: clinic.id,
      actor,
      action: "intake.retry_cleared",
      detail: {
        dedupeKey,
        providerMessageId,
        priorEventId: existingEvent.id,
        storageRetained: true,
      },
    });
  }

  const { data: intakeEvent, error: intakeError } = await supabase
    .from("referral_intake_events")
    .insert({
      clinic_id: clinic.id,
      provider,
      provider_message_id: providerMessageId,
      provider_thread_id: input.email?.providerThreadId ?? null,
      history_id: input.email?.historyId ?? null,
      dedupe_key: dedupeKey,
      processing_status: "processing",
      raw_headers: {
        from: input.email?.fromAddress ?? null,
        subject: input.email?.subject ?? null,
        mailbox: input.email?.mailboxEmail ?? null,
      },
    })
    .select("id")
    .single();

  if (intakeError || !intakeEvent) {
    return { ok: false, error: intakeError?.message || "Could not create intake event." };
  }

  try {
    return await finishIntakeAfterEvent({
      input,
      clinic,
      actor,
      provider,
      providerMessageId,
      receivedAt,
      dedupeKey,
      intakeEventId: intakeEvent.id as string,
      supabase,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[referral-intake] createReferralFromIntake failed", message);
    await supabase
      .from("referral_intake_events")
      .update({
        processing_status: "failed",
        error_message: message.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("id", intakeEvent.id);
    return { ok: false, intakeEventId: intakeEvent.id as string, error: message };
  }
}

async function finishIntakeAfterEvent(args: {
  input: CreateIntakeReferralInput;
  clinic: { id: string; slug: string };
  actor: string;
  provider: string;
  providerMessageId: string;
  receivedAt: string;
  dedupeKey: string;
  intakeEventId: string;
  supabase: ReturnType<typeof referralIntakeSupabase>;
}): Promise<CreateIntakeReferralResult> {
  const { input, clinic, actor, receivedAt, intakeEventId, supabase } = args;

  const documentIds: string[] = [];
  /** Parallel to input.documents indices — every attachment is retained. */
  const documentIdByIndex: Array<string | null> = input.documents.map(() => null);

  for (let i = 0; i < input.documents.length; i++) {
    const doc = input.documents[i]!;
    const stored = await storeReferralDocument({
      clinicSlug: clinic.slug,
      filename: doc.filename,
      bytes: doc.bytes,
      contentType: doc.contentType,
    });

    const { data: existingDoc } = await supabase
      .from("referral_documents")
      .select("id, referral_id, storage_path, storage_driver")
      .eq("clinic_id", clinic.id)
      .eq("sha256", stored.sha256)
      .maybeSingle();

    if (existingDoc?.id) {
      documentIds.push(existingDoc.id);
      documentIdByIndex[i] = existingDoc.id;
      if (existingDoc.referral_id) {
        await supabase
          .from("referral_intake_events")
          .update({ processing_status: "duplicate", updated_at: new Date().toISOString() })
          .eq("id", intakeEventId);
        await writeReferralAudit({
          referralId: existingDoc.referral_id,
          intakeEventId: intakeEventId,
          clinicId: clinic.id,
          actor,
          action: "intake.duplicate_document",
          detail: { sha256: stored.sha256, filename: doc.filename },
        });
        return {
          ok: true,
          referralId: existingDoc.referral_id,
          intakeEventId: intakeEventId,
          documentIds,
          duplicateOfReferralId: existingDoc.referral_id,
          dashboardStatus: "new",
        };
      }
      // Same file from a prior failed run — relink to this intake; storage already upserted.
      await supabase
        .from("referral_documents")
        .update({
          intake_event_id: intakeEventId,
          storage_driver: stored.storageDriver,
          storage_path: stored.storagePath,
          content_type: stored.contentType,
          byte_size: stored.byteSize,
          filename: doc.filename,
        })
        .eq("id", existingDoc.id);
      continue;
    }

    const { data: insertedDoc, error: docError } = await supabase
      .from("referral_documents")
      .insert({
        intake_event_id: intakeEventId,
        clinic_id: clinic.id,
        filename: doc.filename,
        content_type: stored.contentType,
        byte_size: stored.byteSize,
        sha256: stored.sha256,
        storage_driver: stored.storageDriver,
        storage_path: stored.storagePath,
      })
      .select("id")
      .single();

    if (docError || !insertedDoc) {
      await supabase
        .from("referral_intake_events")
        .update({
          processing_status: "failed",
          error_message: docError?.message || "Document store failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", intakeEventId);
      return { ok: false, intakeEventId: intakeEventId, error: docError?.message || "Document store failed" };
    }
    documentIds.push(insertedDoc.id);
    documentIdByIndex[i] = insertedDoc.id;
  }

  const {
    extract,
    error: extractError,
    outcomes,
    primaryIndex,
    hasIdentityConflict,
  } = await extractAcrossDocuments(input.documents, input.forcedExtract);

  for (const outcome of outcomes) {
    const docId = documentIdByIndex[outcome.index];
    if (!docId) continue;
    const { error: labelError } = await supabase
      .from("referral_documents")
      .update({
        contains_referral_info: outcome.containsReferralInfo,
        extraction_role: outcome.role,
        identity_conflict: outcome.identityConflict,
        conflict_resolution: null,
        extracted_child_first: outcome.extract.childFirst || null,
        extracted_child_last: outcome.extract.childLast || null,
        extracted_child_dob: outcome.extract.childDob || null,
      })
      .eq("id", docId);
    if (labelError) {
      console.warn(
        "[referral-intake] document label update skipped — run phase2/phase3 SQL:",
        labelError.message
      );
    }
  }

  const primaryDocumentId =
    (primaryIndex != null ? documentIdByIndex[primaryIndex] : null) ||
    documentIds[0] ||
    null;
  // Soft patient duplicate: name + DOB only (never parent mobile).
  let duplicateOfReferralId: string | undefined;
  if (
    extract.childFirst.trim() &&
    extract.childLast.trim() &&
    extract.childDob.trim()
  ) {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: candidates } = await supabase
      .from("referrals")
      .select("id, child_first_name, child_last_name, child_dob, received_at, created_at")
      .eq("clinic_id", clinic.id)
      .ilike("child_first_name", extract.childFirst.trim())
      .ilike("child_last_name", extract.childLast.trim())
      .eq("child_dob", extract.childDob.trim())
      .gte("created_at", since)
      .limit(20);
    const match = (candidates ?? []).find((row) =>
      isLikelySamePatient(
        {
          childFirst: String(row.child_first_name ?? ""),
          childLast: String(row.child_last_name ?? ""),
          childDob: String(row.child_dob ?? ""),
        },
        extract
      )
    );
    if (match?.id) duplicateOfReferralId = String(match.id);
  }

  const autoVerify = verifyReferralForAutoReady({
    extract,
    hasIdentityConflict,
    softDuplicateOfReferralId: duplicateOfReferralId,
    outcomes,
  });
  const autoReadyEnabled = await referralAutoReadyEnabled();
  const passAutoReady = autoReadyEnabled && autoVerify.autoReady && !extractError;

  const extractionStatus = extractError
    ? "failed"
    : passAutoReady
      ? "extracted"
      : hasIdentityConflict || !autoVerify.autoReady
        ? "needs_review"
        : deriveExtractionStatus(extract);
  const contactStatus: ReferralContactStatus = "not_contacted";
  const bookingStatus = "not_booked";
  // Exception-only human review. Parent email/SMS remain off.
  const dashboardStatus = deriveDashboardStatus({
    extractionStatus,
    contactStatus,
    bookingStatus,
    failed: Boolean(extractError) && !extract.childFirst,
    forceReview: !passAutoReady && (hasIdentityConflict || !autoVerify.autoReady),
  });
  const needsReview = !passAutoReady;

  const referralPayload: Record<string, unknown> = {
    child_first_name: extract.childFirst || null,
    child_last_name: extract.childLast || null,
    child_dob: extract.childDob || null,
    parent_first_name: extract.parentFirst || null,
    parent_last_name: extract.parentLast || null,
    parent_email: extract.parentEmail || null,
    parent_mobile: extract.parentMobile || null,
    assessment_type: extract.assessmentType || null,
    notes: extract.internalNotes || null,
    sent_email: false,
    sent_sms: false,
    send_status: "not_sent",
    cliniko_patient_id: null,
    follow_up_stage: 0,
    next_follow_up_at: null,
    status: "active",
    opted_out: false,
    clinic_id: clinic.id,
    intake_event_id: intakeEventId,
    referral_source: input.source,
    received_at: receivedAt,
    first_contact_at: null,
    referring_practitioner: extract.referrerName || null,
    referring_practitioner_type: extract.referrerType || null,
    referring_practitioner_email: extract.referrerEmail || null,
    extraction_status: extractionStatus,
    extraction_confidence: extract.confidence,
    extraction_warnings: [
      ...extract.warnings,
      ...(passAutoReady
        ? []
        : autoVerify.reasons.map((r) => `Auto-verify held for review: ${r}`)),
    ],
    contact_status: contactStatus,
    booking_status: bookingStatus,
    dashboard_status: passAutoReady ? "ready_for_contact" : dashboardStatus === "processing_error" ? "processing_error" : "awaiting_review",
    needs_human_review: needsReview,
    patient_identity_conflict: hasIdentityConflict,
    duplicate_of_referral_id: duplicateOfReferralId ?? null,
    original_document_id: primaryDocumentId,
    ...(passAutoReady
      ? {
          auto_ready_at: new Date().toISOString(),
          auto_ready_qa_status: "pending",
        }
      : {
          auto_ready_at: null,
          auto_ready_qa_status: null,
        }),
  };

  let referralInsert = await supabase
    .from("referrals")
    .insert(referralPayload)
    .select("id")
    .single();
  if (
    referralInsert.error &&
    /patient_identity_conflict/i.test(referralInsert.error.message)
  ) {
    delete referralPayload.patient_identity_conflict;
    referralInsert = await supabase.from("referrals").insert(referralPayload).select("id").single();
  }
  if (
    referralInsert.error &&
    /auto_ready_/i.test(referralInsert.error.message)
  ) {
    delete referralPayload.auto_ready_at;
    delete referralPayload.auto_ready_qa_status;
    referralInsert = await supabase.from("referrals").insert(referralPayload).select("id").single();
  }
  const { data: referral, error: referralError } = referralInsert;

  if (referralError || !referral) {
    await supabase
      .from("referral_intake_events")
      .update({
        processing_status: "failed",
        error_message: referralError?.message || "Referral insert failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", intakeEventId);
    return {
      ok: false,
      intakeEventId: intakeEventId,
      documentIds,
      error: referralError?.message || "Referral insert failed",
    };
  }

  if (documentIds.length) {
    await supabase
      .from("referral_documents")
      .update({ referral_id: referral.id })
      .in("id", documentIds);
  }

  await supabase
    .from("referral_intake_events")
    .update({
      processing_status: needsReview ? "needs_review" : "ready",
      error_message: extractError ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", intakeEventId);

  const finalDashboardStatus = String(referralPayload.dashboard_status);

  await writeReferralAudit({
    referralId: referral.id,
    intakeEventId: intakeEventId,
    clinicId: clinic.id,
    actor,
    action: passAutoReady ? "intake.auto_verified" : "intake.created",
    detail: {
      dashboardStatus: finalDashboardStatus,
      extractionStatus,
      needsReview,
      autoReady: passAutoReady,
      autoReadyEnabled,
      autoVerifyChecks: autoVerify.checks,
      autoVerifyReasons: autoVerify.reasons,
      duplicateOfReferralId: duplicateOfReferralId ?? null,
      documentCount: documentIds.length,
      referralBearingCount: outcomes.filter((o) => o.containsReferralInfo).length,
      hasIdentityConflict,
      documents: outcomes.map((o) => ({
        filename: o.filename,
        kind: o.kind,
        role: o.role,
        containsReferralInfo: o.containsReferralInfo,
        identityConflict: o.identityConflict,
        score: o.score,
        child: [o.extract.childFirst, o.extract.childLast].filter(Boolean).join(" "),
      })),
      liveCommsBlocked: true,
    },
  });

  return {
    ok: true,
    referralId: referral.id,
    intakeEventId: intakeEventId,
    documentIds,
    dashboardStatus: finalDashboardStatus as CreateIntakeReferralResult["dashboardStatus"],
    duplicateOfReferralId,
    extract,
    error: extractError,
  };
}
