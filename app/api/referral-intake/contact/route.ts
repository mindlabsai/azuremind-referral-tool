import { NextResponse } from "next/server";
import {
  referralAutoFirstContactEnabled,
  referralIntakeEnabled,
  referralLiveCommsEnabled,
} from "@/lib/referral-intake/config";
import {
  sendReferralBookingContact,
  type ContactSendChannel,
  type ContactSendMode,
} from "@/lib/referral-intake/contact-send";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Stage A: preview, simulate, or live-send booking email/SMS for an intake referral.
 * Simulate = labelled audit rehearsal only (no status / Cliniko / outbound).
 * Live send requires TEXLEX_REFERRAL_LIVE_COMMS=1.
 */
export async function POST(req: Request) {
  if (!referralIntakeEnabled()) {
    return NextResponse.json({ success: false, error: "intake_disabled" }, { status: 403 });
  }

  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
  }

  const body = (await req.json()) as {
    referralId?: string;
    channel?: ContactSendChannel;
    mode?: ContactSendMode;
    liveSend?: boolean;
    simulate?: boolean;
    forceFailSend?: boolean;
    syntheticDeliver?: boolean;
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

  if (!body.referralId?.trim()) {
    return NextResponse.json({ success: false, error: "referralId is required." }, { status: 400 });
  }

  const channel = body.channel || "email+sms";
  if (channel !== "email" && channel !== "sms" && channel !== "email+sms") {
    return NextResponse.json({ success: false, error: "Invalid channel." }, { status: 400 });
  }

  let mode: ContactSendMode = "preview";
  if (body.mode === "preview" || body.mode === "simulate" || body.mode === "live") {
    mode = body.mode;
  } else if (body.liveSend) {
    mode = "live";
  } else if (body.simulate) {
    mode = "simulate";
  }

  if (
    (body.forceFailSend || body.syntheticDeliver) &&
    process.env.TEXLEX_REFERRAL_SYNTHETIC_API !== "1"
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "syntheticDeliver/forceFailSend require TEXLEX_REFERRAL_SYNTHETIC_API=1.",
      },
      { status: 403 }
    );
  }

  const result = await sendReferralBookingContact({
    referralId: body.referralId.trim(),
    userId: user.id,
    actor: user.email || user.id,
    channel,
    mode,
    forceFailSend: Boolean(body.forceFailSend),
    syntheticDeliver: Boolean(body.syntheticDeliver),
    bookingLink: body.bookingLink,
    clinicPhone: body.clinicPhone,
    fields: body.fields,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        error: result.error || "Contact send failed.",
        dashboardStatus: result.dashboardStatus ?? null,
        clinikoPatientId: result.clinikoPatientId ?? null,
        preview: result.preview ?? null,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    dryRun: result.dryRun ?? false,
    simulated: result.simulated ?? false,
    emailSent: result.emailSent ?? false,
    smsSent: result.smsSent ?? false,
    clinikoPatientId: result.clinikoPatientId ?? null,
    clinikoAttachmentId: result.clinikoAttachmentId ?? null,
    clinikoCreatedPatient: result.clinikoCreatedPatient ?? false,
    dashboardStatus: result.dashboardStatus ?? null,
    preview: result.preview ?? null,
    liveCommsEnabled: referralLiveCommsEnabled(),
    autoFirstContactEnabled: referralAutoFirstContactEnabled(),
    message: result.simulated
      ? "Simulation only — labelled audit recorded. Status, Cliniko and send flags were not changed."
      : result.dryRun
        ? "Preview only — no parent message was sent and status was not changed."
        : "Booking message sent. Status set to Contact attempted.",
  });
}
