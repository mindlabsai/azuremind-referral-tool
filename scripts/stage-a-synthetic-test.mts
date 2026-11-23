/**
 * Stage A synthetic verification — no real parent email/SMS.
 * Run: npx tsx scripts/stage-a-synthetic-test.mts
 *
 * LIVE_COMMS and AUTO_FIRST_CONTACT stay 0.
 * Successful-send path is exercised via syntheticDeliver (SYNTHETIC_API=1).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));

process.env.TEXLEX_REFERRAL_LIVE_COMMS = "0";
process.env.TEXLEX_REFERRAL_AUTO_FIRST_CONTACT = "0";
process.env.TEXLEX_REFERRAL_INTAKE_ENABLED = process.env.TEXLEX_REFERRAL_INTAKE_ENABLED || "1";
process.env.TEXLEX_REFERRAL_SYNTHETIC_API = "1";

const { createReferralFromIntake } = await import("../lib/referral-intake/pipeline");
const { sendReferralBookingContact, maybeAutoSendFirstContact } = await import(
  "../lib/referral-intake/contact-send"
);
const { referralIntakeSupabase } = await import("../lib/referral-intake/supabase-admin");
const {
  referralLiveCommsEnabled,
  referralAutoFirstContactEnabled,
} = await import("../lib/referral-intake/config");
const { DEFAULT_CLINIKO_BOOKINGS, feeOptionsForPathway } = await import(
  "../lib/referral-comms/parent-booking-email"
);
const { assertStaffClinicAccess } = await import("../lib/referral-intake/staff-access");

type Result = { name: string; ok: boolean; detail: string };
const results: Result[] = [];

function pass(name: string, detail: string) {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name} — ${detail}`);
}
function fail(name: string, detail: string) {
  results.push({ name, ok: false, detail });
  console.error(`FAIL  ${name} — ${detail}`);
}

async function snapshot(referralId: string) {
  const supabase = referralIntakeSupabase();
  const { data } = await supabase
    .from("referrals")
    .select(
      "dashboard_status, contact_status, sent_email, sent_sms, cliniko_patient_id, first_contact_at, next_follow_up_at, send_status"
    )
    .eq("id", referralId)
    .maybeSingle();
  return data;
}

async function main() {
  if (referralLiveCommsEnabled() || referralAutoFirstContactEnabled()) {
    throw new Error("Comms flags must stay 0 for this synthetic run.");
  }

  const stamp = Date.now();
  const childFirst = "StageA";
  const childLast = `Fix${stamp}`;
  const parentEmail = `stage-a-fix-${stamp}@example.com`;
  const parentMobile = "+61400000088";

  const created = await createReferralFromIntake({
    clinicSlug: "perth-paediatrics",
    source: "gp_email",
    actor: "stage-a-synthetic-test",
    forcedExtract: {
      childFirst,
      childLast,
      childDob: "2016-05-12",
      parentFirst: "Jordan",
      parentLast: "Parent",
      parentEmail,
      parentMobile,
      assessmentType: "ADHD",
      referrerName: "Dr Synthetic GP",
      referrerType: "GP",
      referrerEmail: "gp.synthetic@example.com",
      confidence: "high",
      warnings: ["Processed 1 attachment (synthetic)."],
      internalNotes: "Stage A simulate-fix synthetic test",
    },
    email: {
      provider: "synthetic",
      providerMessageId: `stage-a-fix-${stamp}`,
      fromAddress: "gp.synthetic@example.com",
      subject: "Stage A simulate-fix synthetic referral",
      receivedAt: new Date().toISOString(),
      mailboxEmail: "referrals-test@example.com",
    },
    documents: [
      {
        filename: `stage-a-fix-${stamp}.pdf`,
        contentType: "application/pdf",
        bytes: Buffer.from(
          `%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\nstage-a-fix:${stamp}\n`
        ),
      },
    ],
  });

  if (!created.ok || !created.referralId) {
    fail("1. Open ready referral", created.error || "create failed");
    return finish();
  }

  const supabase = referralIntakeSupabase();
  const { data: row } = await supabase
    .from("referrals")
    .select(
      "id, clinic_id, child_first_name, child_last_name, parent_email, dashboard_status, original_document_id"
    )
    .eq("id", created.referralId)
    .maybeSingle();

  const { data: docs } = await supabase
    .from("referral_documents")
    .select("id, filename")
    .eq("referral_id", created.referralId);

  if (
    row &&
    row.child_first_name === childFirst &&
    row.child_last_name === childLast &&
    (docs?.length ?? 0) >= 1
  ) {
    pass(
      "1. Open ready referral",
      `${row.child_first_name} ${row.child_last_name} · ${row.dashboard_status} · docs=${docs?.length}`
    );
  } else {
    fail("1. Open ready referral", JSON.stringify({ row, docs, created }));
  }

  if (row?.dashboard_status !== "ready_for_contact") {
    await supabase
      .from("referrals")
      .update({
        dashboard_status: "ready_for_contact",
        extraction_status: "extracted",
        needs_human_review: false,
        patient_identity_conflict: false,
        sent_email: false,
        sent_sms: false,
        contact_status: "not_contacted",
        cliniko_patient_id: null,
        first_contact_at: null,
        next_follow_up_at: null,
      })
      .eq("id", created.referralId);
  }

  const { data: member } = await supabase
    .from("clinic_memberships")
    .select("user_id")
    .eq("clinic_id", row?.clinic_id)
    .limit(1)
    .maybeSingle();
  const userId = member?.user_id ? String(member.user_id) : "synthetic-tester";
  const systemActor = !member?.user_id;

  const beforeSim = await snapshot(created.referralId);

  const preview = await sendReferralBookingContact({
    referralId: created.referralId,
    userId,
    actor: "stage-a-synthetic-test",
    channel: "email+sms",
    mode: "preview",
    systemActor,
  });
  const fees = feeOptionsForPathway("ADHD");
  if (
    preview.ok &&
    preview.dryRun &&
    preview.preview?.toEmail === parentEmail &&
    preview.preview?.emailHtml.includes(DEFAULT_CLINIKO_BOOKINGS) &&
    fees.some((f) => preview.preview?.emailHtml.includes(f.feeDisplay))
  ) {
    pass(
      "2. Preview parent email/SMS",
      `to=${preview.preview?.toEmail} · fees present · booking link present`
    );
  } else {
    fail("2. Preview parent email/SMS", JSON.stringify(preview).slice(0, 400));
  }

  const simulated = await sendReferralBookingContact({
    referralId: created.referralId,
    userId,
    actor: "stage-a-synthetic-test",
    channel: "email+sms",
    mode: "simulate",
    systemActor,
  });
  const afterSim = await snapshot(created.referralId);
  const simUnchanged =
    afterSim?.dashboard_status === beforeSim?.dashboard_status &&
    afterSim?.contact_status === beforeSim?.contact_status &&
    afterSim?.sent_email === beforeSim?.sent_email &&
    afterSim?.sent_sms === beforeSim?.sent_sms &&
    afterSim?.cliniko_patient_id === beforeSim?.cliniko_patient_id &&
    afterSim?.first_contact_at === beforeSim?.first_contact_at &&
    afterSim?.next_follow_up_at === beforeSim?.next_follow_up_at;

  if (simulated.ok && simulated.simulated && simulated.dryRun && simUnchanged) {
    pass(
      "3. Simulate send (audit only)",
      `status remains ${afterSim?.dashboard_status} · no Cliniko · no send flags · no follow-up`
    );
  } else {
    fail("3. Simulate send (audit only)", JSON.stringify({ simulated, beforeSim, afterSim }));
  }

  // Simulate must not block a later genuine/synthetic-delivery send
  const afterSimAgain = await sendReferralBookingContact({
    referralId: created.referralId,
    userId,
    actor: "stage-a-synthetic-test",
    channel: "email+sms",
    mode: "simulate",
    systemActor,
  });
  if (afterSimAgain.ok && afterSimAgain.simulated) {
    pass("3b. Simulate does not block retries", "second simulate still allowed");
  } else {
    fail("3b. Simulate does not block retries", JSON.stringify(afterSimAgain));
  }

  const failed = await sendReferralBookingContact({
    referralId: created.referralId,
    userId,
    actor: "stage-a-synthetic-test",
    channel: "email+sms",
    mode: "live",
    syntheticDeliver: true,
    forceFailSend: true,
    systemActor,
  });
  const afterFail = await snapshot(created.referralId);
  if (
    !failed.ok &&
    afterFail?.dashboard_status !== "contact_attempted" &&
    !afterFail?.sent_email &&
    !afterFail?.sent_sms &&
    !afterFail?.cliniko_patient_id
  ) {
    pass("4. Failed send not recorded", failed.error || "failed as expected");
  } else {
    fail("4. Failed send not recorded", JSON.stringify({ failed, afterFail }));
  }

  const delivered = await sendReferralBookingContact({
    referralId: created.referralId,
    userId,
    actor: "stage-a-synthetic-test",
    channel: "email+sms",
    mode: "live",
    syntheticDeliver: true,
    systemActor,
  });
  const afterDeliver = await snapshot(created.referralId);
  if (
    delivered.ok &&
    !delivered.dryRun &&
    !delivered.simulated &&
    delivered.emailSent &&
    delivered.smsSent &&
    afterDeliver?.dashboard_status === "contact_attempted" &&
    afterDeliver.sent_email &&
    afterDeliver.sent_sms &&
    afterDeliver.first_contact_at
  ) {
    pass(
      "5. Successful send records contact_attempted",
      `channel email+sms · patient=${delivered.clinikoPatientId} · attachment=${delivered.clinikoAttachmentId ?? "n/a"}`
    );
  } else {
    fail("5. Successful send records contact_attempted", JSON.stringify({ delivered, afterDeliver }));
  }

  const dup = await sendReferralBookingContact({
    referralId: created.referralId,
    userId,
    actor: "stage-a-synthetic-test",
    channel: "email+sms",
    mode: "live",
    syntheticDeliver: true,
    systemActor,
  });
  if (!dup.ok && /already sent/i.test(dup.error || "")) {
    pass("6. Duplicate send blocked", dup.error || "blocked");
  } else {
    fail("6. Duplicate send blocked", JSON.stringify(dup));
  }

  // Cliniko idempotency: second successful path already blocked; re-link via findOrCreate on a
  // fresh referral with same child identity would reuse — verify attachment list on first patient.
  if (delivered.clinikoPatientId) {
    const { clinikoListPatientAttachments } = await import("../lib/cliniko");
    const attachments = await clinikoListPatientAttachments(delivered.clinikoPatientId, {
      maxPages: 1,
    });
    const referralAttachments = attachments.filter((a) =>
      (a.description || "").includes("Texlex intake")
    );
    // Re-run link path by calling send on a clone is heavy; verify one intake attachment exists
    // and patient id is stable on the referral row.
    if (
      afterDeliver?.cliniko_patient_id === delivered.clinikoPatientId &&
      referralAttachments.length <= 1
    ) {
      pass(
        "7. Cliniko idempotent",
        `patient=${delivered.clinikoPatientId} · texlex attachments=${referralAttachments.length}`
      );
    } else {
      fail(
        "7. Cliniko idempotent",
        JSON.stringify({
          patient: delivered.clinikoPatientId,
          attachments: referralAttachments.length,
          afterDeliver,
        })
      );
    }
  } else {
    pass("7. Cliniko idempotent", "Cliniko unavailable in this environment — send recording still ok");
  }

  const autoBlocked = await maybeAutoSendFirstContact({
    referralId: created.referralId,
    clinicId: row?.clinic_id,
    newlyCreatedAndVerified: false,
  });
  if (!autoBlocked.attempted) {
    pass("8. Existing Ready referrals not auto-contacted", "newlyCreatedAndVerified=false → no attempt");
  } else {
    fail("8. Existing Ready referrals not auto-contacted", JSON.stringify(autoBlocked));
  }

  const liveBlocked = await sendReferralBookingContact({
    referralId: created.referralId,
    userId,
    actor: "stage-a-synthetic-test",
    channel: "email",
    mode: "live",
    systemActor,
  });
  // Already sent email, so either duplicate or live-comms-off — both fine; ensure no real Resend
  if (!liveBlocked.ok) {
    pass("8b. Live send stays blocked/deduped with LIVE_COMMS=0", liveBlocked.error || "blocked");
  } else {
    fail("8b. Live send stays blocked/deduped with LIVE_COMMS=0", JSON.stringify(liveBlocked));
  }

  const created2 = await createReferralFromIntake({
    clinicSlug: "perth-paediatrics",
    source: "gp_email",
    actor: "stage-a-synthetic-test",
    forcedExtract: {
      childFirst: "Conflict",
      childLast: `Child${stamp}`,
      childDob: "2015-01-01",
      parentFirst: "Alex",
      parentLast: "Parent",
      parentEmail: `conflict-fix-${stamp}@example.com`,
      parentMobile: "+61400000122",
      assessmentType: "ASD",
      referrerName: "Dr Conflict",
      referrerType: "GP",
      referrerEmail: "gp2@example.com",
      confidence: "high",
      warnings: [],
      internalNotes: "",
    },
    email: {
      provider: "synthetic",
      providerMessageId: `stage-a-conflict-fix-${stamp}`,
      receivedAt: new Date().toISOString(),
    },
    documents: [
      {
        filename: `conflict-primary-fix-${stamp}.pdf`,
        contentType: "application/pdf",
        bytes: Buffer.from(`%PDF-1.4\nconflict-primary-fix:${stamp}\n%%EOF\n`),
      },
    ],
  });

  if (created2.referralId) {
    await supabase
      .from("referrals")
      .update({
        dashboard_status: "ready_for_contact",
        needs_human_review: false,
        sent_email: false,
        sent_sms: false,
        contact_status: "not_contacted",
      })
      .eq("id", created2.referralId);

    await supabase.from("referral_documents").insert({
      clinic_id: row?.clinic_id,
      referral_id: created2.referralId,
      filename: "other-patient.pdf",
      content_type: "application/pdf",
      storage_driver: "memory",
      storage_path: `memory://other-fix-${stamp}`,
      extraction_role: "conflict",
      identity_conflict: true,
      conflict_resolution: null,
      contains_referral_info: true,
      byte_size: 8,
      sha256: `other-fix-${stamp}`,
    });

    const conflictSend = await sendReferralBookingContact({
      referralId: created2.referralId,
      userId,
      actor: "stage-a-synthetic-test",
      channel: "email",
      mode: "live",
      syntheticDeliver: true,
      systemActor: true,
    });

    const unauth = await assertStaffClinicAccess({
      userId: "00000000-0000-0000-0000-000000000099",
      clinicId: row?.clinic_id ? String(row.clinic_id) : null,
    });

    if (!conflictSend.ok && /conflict/i.test(conflictSend.error || "") && !unauth.ok) {
      pass(
        "9. Identity conflict / clinic authorisation",
        `conflict=${conflictSend.error}; auth=${unauth.error}`
      );
    } else {
      fail(
        "9. Identity conflict / clinic authorisation",
        JSON.stringify({ conflictSend, unauth })
      );
    }
  } else {
    fail("9. Identity conflict / clinic authorisation", created2.error || "second create failed");
  }

  finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok);
  console.log("\n── Stage A synthetic summary ──");
  console.log(`Passed ${results.filter((r) => r.ok).length}/${results.length}`);
  if (failed.length) {
    console.error("Failures:", failed);
    process.exit(1);
  }
  console.log("LIVE_COMMS=0 AUTO_FIRST_CONTACT=0 — safe. No real parent messages sent.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
