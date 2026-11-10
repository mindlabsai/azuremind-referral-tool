import { NextResponse } from "next/server";
import { referralIntakeEnabled } from "@/lib/referral-intake/config";
import {
  recordAutoReadyQa,
  updateReferralDashboardStatus,
} from "@/lib/referral-intake/review";
import type { ReferralDashboardStatus } from "@/lib/referral-intake/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!referralIntakeEnabled()) {
    return NextResponse.json({ success: false, error: "intake_disabled" }, { status: 403 });
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

  if (body.autoReadyQa === "confirmed" || body.autoReadyQa === "incorrect") {
    const qa = await recordAutoReadyQa({
      referralId: body.referralId,
      status: body.autoReadyQa,
      notes: body.notes,
      actor: body.actor ?? "clinician",
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
    actor: body.actor ?? "clinician",
    fields: body.fields,
    documentResolutions: body.documentResolutions,
  });

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    liveCommsBlocked: true,
    message: "Status updated. No parent email or SMS was sent.",
  });
}
