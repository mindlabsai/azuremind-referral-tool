import { referralIntakeSupabase } from "../supabase-admin";
import { encryptSecret } from "../token-crypto";

/** Save Gmail OAuth tokens only — keep this free of PDF/pipeline imports. */
export async function upsertMailboxOAuth(args: {
  clinicId: string;
  emailAddress: string;
  refreshToken: string;
  googleUserId?: string;
}): Promise<{ id: string }> {
  const supabase = referralIntakeSupabase();
  const encrypted = encryptSecret(args.refreshToken);
  const { data, error } = await supabase
    .from("referral_mailboxes")
    .upsert(
      {
        clinic_id: args.clinicId,
        email_address: args.emailAddress.trim().toLowerCase(),
        google_user_id: args.googleUserId ?? null,
        oauth_refresh_token_encrypted: encrypted,
        active: true,
      },
      { onConflict: "email_address" }
    )
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message || "Could not save mailbox OAuth.");
  return { id: data.id as string };
}
