import { NextResponse } from "next/server";
import { referralIntakeEnabled } from "@/lib/referral-intake/config";
import {
  getReferralAutoReadyFlag,
  setReferralAutoReadyEnabled,
} from "@/lib/referral-intake/ops-flags";
import { writeReferralAudit } from "@/lib/referral-intake/audit";
import { referralIntakeSupabase } from "@/lib/referral-intake/supabase-admin";

export const runtime = "nodejs";

/** Live operational switches — DB-backed, effective within ~3s (no redeploy). */
export async function GET() {
  if (!referralIntakeEnabled()) {
    return NextResponse.json({ success: false, error: "intake_disabled" }, { status: 403 });
  }
  const autoReady = await getReferralAutoReadyFlag();
  const qa = await loadAutoReadyQaSummary();
  return NextResponse.json({
    success: true,
    autoReady,
    qa,
    note:
      "Toggle autoReady via POST. Env TEXLEX_REFERRAL_AUTO_READY=0 still forces off after redeploy.",
  });
}

export async function POST(req: Request) {
  if (!referralIntakeEnabled()) {
    return NextResponse.json({ success: false, error: "intake_disabled" }, { status: 403 });
  }

  const body = (await req.json()) as {
    autoReadyEnabled?: boolean;
    actor?: string;
    note?: string;
  };

  if (typeof body.autoReadyEnabled !== "boolean") {
    return NextResponse.json(
      { success: false, error: "autoReadyEnabled boolean is required." },
      { status: 400 }
    );
  }

  const result = await setReferralAutoReadyEnabled({
    enabled: body.autoReadyEnabled,
    actor: body.actor,
    note: body.note,
  });
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  await writeReferralAudit({
    referralId: null,
    intakeEventId: null,
    clinicId: null,
    actor: body.actor?.trim() || "clinician",
    action: body.autoReadyEnabled ? "ops.auto_ready_enabled" : "ops.auto_ready_disabled",
    detail: { enabled: result.enabled, note: body.note ?? null },
  });

  return NextResponse.json({
    success: true,
    autoReady: await getReferralAutoReadyFlag(),
    message: result.enabled
      ? "Auto-ready is ON — clean referrals proceed without staff review."
      : "Auto-ready is OFF — every new referral goes to awaiting_review (immediate).",
  });
}

async function loadAutoReadyQaSummary(): Promise<{
  target: number;
  pending: number;
  confirmed: number;
  incorrect: number;
  totalAutoReady: number;
}> {
  const target = 50;
  const empty = { target, pending: 0, confirmed: 0, incorrect: 0, totalAutoReady: 0 };
  try {
    const supabase = referralIntakeSupabase();
    const { data, error } = await supabase
      .from("referrals")
      .select("auto_ready_qa_status")
      .not("auto_ready_at", "is", null)
      .order("auto_ready_at", { ascending: true })
      .limit(target);
    if (error || !data) return empty;
    const summary = { ...empty, totalAutoReady: data.length };
    for (const row of data) {
      const s = String((row as { auto_ready_qa_status?: string }).auto_ready_qa_status || "pending");
      if (s === "confirmed") summary.confirmed += 1;
      else if (s === "incorrect") summary.incorrect += 1;
      else summary.pending += 1;
    }
    return summary;
  } catch {
    return empty;
  }
}
