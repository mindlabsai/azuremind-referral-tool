import { NextResponse } from "next/server";
import { referralIntakeEnabled, referralLiveCommsEnabled } from "@/lib/referral-intake/config";
import { listInboxReferrals } from "@/lib/referral-intake/inbox-query";
import { assertStaffClinicAccess, userClinicIds } from "@/lib/referral-intake/staff-access";
import { dashboardLabel } from "@/lib/referral-intake/status";
import { referralIntakeSupabase } from "@/lib/referral-intake/supabase-admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!referralIntakeEnabled()) {
    return NextResponse.json(
      { success: false, error: "Referral intake is disabled (TEXLEX_REFERRAL_INTAKE_ENABLED)." },
      { status: 403 }
    );
  }

  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
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
    const admin = referralIntakeSupabase();
    const resolvedSlug = (clinicSlug || "perth-paediatrics").trim().toLowerCase();
    const { data: clinic } = await admin
      .from("clinics")
      .select("id, slug")
      .eq("slug", resolvedSlug)
      .maybeSingle();

    if (clinic?.id) {
      const access = await assertStaffClinicAccess({
        userId: user.id,
        clinicId: String(clinic.id),
      });
      if (!access.ok) {
        const memberIds = await userClinicIds(user.id);
        return NextResponse.json(
          {
            success: false,
            error: access.error,
            memberClinicCount: memberIds.length,
            hint: "Ask an admin to add clinic_memberships for this clinic. Access is not auto-granted.",
          },
          { status: access.status }
        );
      }
    }

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
      liveCommsEnabled: referralLiveCommsEnabled(),
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
