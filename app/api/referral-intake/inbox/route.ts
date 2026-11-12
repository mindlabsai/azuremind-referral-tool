import { NextResponse } from "next/server";
import { referralIntakeEnabled } from "@/lib/referral-intake/config";
import { listInboxReferrals } from "@/lib/referral-intake/inbox-query";
import { dashboardLabel } from "@/lib/referral-intake/status";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!referralIntakeEnabled()) {
    return NextResponse.json(
      { success: false, error: "Referral intake is disabled (TEXLEX_REFERRAL_INTAKE_ENABLED)." },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const clinicSlug = url.searchParams.get("clinic") || undefined;
  const status = url.searchParams.get("status") || "all";
  const sourceParam = url.searchParams.get("source") || "intake";
  const source =
    sourceParam === "legacy" || sourceParam === "all" || sourceParam === "intake"
      ? sourceParam
      : "intake";

  try {
    const { rows, counts, clinicSlug: resolved, source: resolvedSource, legacyCount } =
      await listInboxReferrals({
        clinicSlug,
        status,
        source,
      });
    return NextResponse.json({
      success: true,
      clinicSlug: resolved,
      source: resolvedSource,
      legacyCount,
      counts,
      labels: Object.fromEntries(
        Object.keys(counts).map((key) => [key, dashboardLabel(key)])
      ),
      data: rows,
      liveCommsEnabled: false,
      liveMailboxEnabled: false,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        hint: "Apply supabase/migrations/20261106_referral_intake_phase1.sql if columns/tables are missing.",
      },
      { status: 500 }
    );
  }
}
