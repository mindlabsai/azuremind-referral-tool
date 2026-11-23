import { referralIntakeSupabase } from "./supabase-admin";

/**
 * Require an existing clinic_memberships row for this user + clinic.
 * Uses the service role for a reliable read (avoids RLS false-negatives),
 * but does NOT auto-enrol — missing membership is a hard forbid.
 *
 * Diagnosis note (Nov 2026): Gmail intake referrals are correctly clinic-scoped
 * to Perth Paediatrics (mailbox clinic). "Forbidden for this clinic" happened when
 * the logged-in user had no membership for that clinic, or when membership was
 * checked only via the user JWT under RLS. Fix is enrol staff into the clinic
 * they operate — not remove the check.
 */
export async function assertStaffClinicAccess(args: {
  userId: string;
  clinicId: string | null | undefined;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (!args.clinicId) {
    return { ok: false, error: "Referral has no clinic assignment.", status: 403 };
  }

  try {
    const admin = referralIntakeSupabase();
    const { data: existing, error } = await admin
      .from("clinic_memberships")
      .select("clinic_id")
      .eq("user_id", args.userId)
      .eq("clinic_id", args.clinicId)
      .maybeSingle();

    if (error) {
      return { ok: false, error: error.message, status: 500 };
    }
    if (!existing?.clinic_id) {
      return {
        ok: false,
        error:
          "Forbidden for this clinic. Your account is not a member of the clinic that owns this referral. Ask an admin to add clinic_memberships for Perth Paediatrics / Azure Mind.",
        status: 403,
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      status: 500,
    };
  }
}

/** @deprecated Use assertStaffClinicAccess — does not auto-enrol. */
export async function ensureStaffClinicAccess(args: {
  userId: string;
  clinicId: string | null | undefined;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  return assertStaffClinicAccess(args);
}

export async function userClinicIds(userId: string): Promise<string[]> {
  const admin = referralIntakeSupabase();
  const { data } = await admin
    .from("clinic_memberships")
    .select("clinic_id")
    .eq("user_id", userId);
  return (data ?? []).map((row) => String(row.clinic_id)).filter(Boolean);
}
