import { NextResponse } from "next/server";
import { referralIntakeEnabled } from "@/lib/referral-intake/config";
import {
  recordAutoReadyQa,
  updateReferralDashboardStatus,
} from "@/lib/referral-intake/review";
import { assertStaffClinicAccess } from "@/lib/referral-intake/staff-access";
import { referralIntakeSupabase } from "@/lib/referral-intake/supabase-admin";
import type { ReferralDashboardStatus } from "@/lib/referral-intake/types";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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
    dashboardStatus?: ReferralDashboardStatus;
    notes?: string;
    markFirstContact?: boolean;
    actor?: string;
    autoReadyQa?: "confirmed" | "incorrect";
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
      referrerType?: string;
      referrerEmail?: string;
      notes?: string;
    };
    documentResolutions?: Array<{
      documentId: string;
      resolution: "excluded" | "accepted_same_patient";
    }>;
  };

  if (!body.referralId) {
    return NextResponse.json({ success: false, error: "referralId is required." }, { status: 400 });
  }

  const admin = referralIntakeSupabase();
  const { data: referral } = await admin
    .from("referrals")
    .select("id, clinic_id")
    .eq("id", body.referralId)
    .maybeSingle();
  if (!referral) {
    return NextResponse.json({ success: false, error: "Referral not found." }, { status: 404 });
  }
  const access = await assertStaffClinicAccess({
    userId: user.id,
    clinicId: referral.clinic_id ? String(referral.clinic_id) : null,
  });
  if (!access.ok) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status });
  }

  const actor = user.email || body.actor || "clinician";

  if (body.autoReadyQa === "confirmed" || body.autoReadyQa === "incorrect") {
    const qa = await recordAutoReadyQa({
      referralId: body.referralId,
      status: body.autoReadyQa,
      notes: body.notes,
      actor,
    });
    if (!qa.ok) {
      return NextResponse.json({ success: false, error: qa.error }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      liveCommsBlocked: true,
      message:
        body.autoReadyQa === "incorrect"
          ? "Marked incorrect and pulled back to awaiting review. No parent comms sent."
          : "Auto-ready decision confirmed against the original letter.",
    });
  }

  if (!body.dashboardStatus) {
    return NextResponse.json(
      { success: false, error: "referralId and dashboardStatus are required." },
      { status: 400 }
    );
  }

  const result = await updateReferralDashboardStatus({
    referralId: body.referralId,
    dashboardStatus: body.dashboardStatus,
    notes: body.notes,
    markFirstContact: body.markFirstContact,
    actor,
    fields: body.fields,
    documentResolutions: body.documentResolutions,
  });

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    liveCommsBlocked: true,
    message:
      body.dashboardStatus === "contacted"
        ? "Marked contacted (phone). Message send uses Contact attempted separately."
        : "Status updated. No parent email or SMS was sent.",
  });
}
