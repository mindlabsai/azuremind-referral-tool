import { referralIntakeSupabase } from "./supabase-admin";

export async function writeReferralAudit(args: {
  referralId?: string | null;
  intakeEventId?: string | null;
  clinicId?: string | null;
  actor?: string;
  action: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = referralIntakeSupabase();
    await supabase.from("referral_audit_events").insert({
      referral_id: args.referralId ?? null,
      intake_event_id: args.intakeEventId ?? null,
      clinic_id: args.clinicId ?? null,
      actor: args.actor ?? "system",
      action: args.action,
      detail: args.detail ?? {},
    });
  } catch (error) {
    console.error("[referral-intake] audit write failed", error);
  }
}
