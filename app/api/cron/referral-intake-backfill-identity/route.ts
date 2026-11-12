import { NextResponse } from "next/server";
import { backfillIdentityConflicts } from "@/lib/referral-intake/backfill-identity-conflicts";
import { referralIntakeEnabled } from "@/lib/referral-intake/config";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * One-shot / repeatable historical identity-conflict backfill for multi-attachment referrals.
 * Auth: Bearer CRON_SECRET. Never sends parent email/SMS.
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
    }
  }

  if (!referralIntakeEnabled()) {
    return NextResponse.json({ success: true, skipped: true, reason: "intake_disabled" });
  }

  try {
    const result = await backfillIdentityConflicts({ actor: "cron-backfill" });
    return NextResponse.json({
      success: true,
      liveCommsBlocked: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
