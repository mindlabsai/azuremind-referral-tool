import { writeReferralAudit } from "../audit";
import { gmailConfig, referralIntakeLiveMailbox } from "../config";
import { referralIntakeSupabase } from "../supabase-admin";
import { decryptSecret } from "../token-crypto";
import {
  getAccessTokenForRefresh,
  listHistoryMessageIds,
  listRecentInboxMessageIds,
  startGmailWatch,
} from "./client";
import { upsertMailboxOAuth } from "./mailbox-oauth";

export { upsertMailboxOAuth };

export type MailboxRow = {
  id: string;
  clinic_id: string;
  email_address: string;
  google_user_id: string | null;
  watch_history_id: string | null;
  watch_expiration: string | null;
  last_history_id: string | null;
  oauth_refresh_token_encrypted: string | null;
  active: boolean;
  clinics?: { slug: string; display_name: string } | null;
};

export async function listActiveMailboxes(): Promise<MailboxRow[]> {
  const supabase = referralIntakeSupabase();
  const { data, error } = await supabase
    .from("referral_mailboxes")
    .select(
      "id, clinic_id, email_address, google_user_id, watch_history_id, watch_expiration, last_history_id, oauth_refresh_token_encrypted, active, clinics(slug, display_name)"
    )
    .eq("active", true);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<
    MailboxRow & { clinics?: MailboxRow["clinics"] | Array<NonNullable<MailboxRow["clinics"]>> }
  >).map((row) => {
    const clinics = Array.isArray(row.clinics) ? row.clinics[0] ?? null : row.clinics ?? null;
    return { ...row, clinics };
  });
}

export async function renewMailboxWatch(mailbox: MailboxRow): Promise<{
  historyId: string;
  expiration: string;
}> {
  if (!referralIntakeLiveMailbox()) {
    throw new Error("Live mailbox watch is disabled (TEXLEX_REFERRAL_INTAKE_LIVE).");
  }
  if (!mailbox.oauth_refresh_token_encrypted) {
    throw new Error(`Mailbox ${mailbox.email_address} has no OAuth refresh token.`);
  }
  const refreshToken = decryptSecret(mailbox.oauth_refresh_token_encrypted);
  const accessToken = await getAccessTokenForRefresh(refreshToken);
  const topic = gmailConfig().pubsubTopic;
  const watch = await startGmailWatch({ accessToken, topicName: topic });
  const supabase = referralIntakeSupabase();
  await supabase
    .from("referral_mailboxes")
    .update({
      watch_history_id: watch.historyId,
      last_history_id: watch.historyId,
      watch_expiration: watch.expiration || null,
    })
    .eq("id", mailbox.id);
  await writeReferralAudit({
    clinicId: mailbox.clinic_id,
    actor: "system",
    action: "mailbox.watch_renewed",
    detail: { mailboxId: mailbox.id, historyId: watch.historyId, expiration: watch.expiration },
  });
  return watch;
}

/** Process new history since last_history_id (Pub/Sub push handler). */
export async function processMailboxHistory(args: {
  mailbox: MailboxRow;
  historyId?: string;
}): Promise<{ processed: number; results: Array<{ messageId: string; ok: boolean; error?: string }> }> {
  const { mailbox } = args;
  if (!referralIntakeLiveMailbox()) {
    return { processed: 0, results: [] };
  }
  if (!mailbox.oauth_refresh_token_encrypted) {
    throw new Error("Mailbox missing OAuth token.");
  }
  const refreshToken = decryptSecret(mailbox.oauth_refresh_token_encrypted);
  const accessToken = await getAccessTokenForRefresh(refreshToken);
  const startHistoryId = mailbox.last_history_id || mailbox.watch_history_id;
  if (!startHistoryId) {
    throw new Error("Mailbox has no history cursor — renew watch first.");
  }

  const clinicSlug = mailbox.clinics?.slug;
  if (!clinicSlug) throw new Error("Mailbox clinic slug missing.");

  const { processGmailMessageIntoReferral } = await import("./process-message");
  const history = await listHistoryMessageIds({
    accessToken,
    startHistoryId,
  });
  const results: Array<{ messageId: string; ok: boolean; error?: string }> = [];
  for (const messageId of history.messageIds) {
    try {
      const outcome = await processGmailMessageIntoReferral({
        refreshToken,
        messageId,
        clinicSlug,
        mailboxEmail: mailbox.email_address,
      });
      results.push({
        messageId,
        ok: outcome.ok,
        error: outcome.error,
      });
    } catch (error) {
      results.push({
        messageId,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const supabase = referralIntakeSupabase();
  const nextHistory = args.historyId || history.latestHistoryId || startHistoryId;
  await supabase
    .from("referral_mailboxes")
    .update({
      last_history_id: nextHistory,
      last_polled_at: new Date().toISOString(),
    })
    .eq("id", mailbox.id);

  return { processed: results.length, results };
}

/** Missed-notification recovery: list recent inbox messages and process idempotently. */
export async function recoverMissedMailboxMessages(args: {
  mailbox: MailboxRow;
  maxResults?: number;
}): Promise<{ scanned: number; results: Array<{ messageId: string; ok: boolean; error?: string }> }> {
  const { mailbox } = args;
  if (!referralIntakeLiveMailbox()) {
    return { scanned: 0, results: [] };
  }
  if (!mailbox.oauth_refresh_token_encrypted) {
    throw new Error("Mailbox missing OAuth token.");
  }
  const refreshToken = decryptSecret(mailbox.oauth_refresh_token_encrypted);
  const accessToken = await getAccessTokenForRefresh(refreshToken);
  const clinicSlug = mailbox.clinics?.slug;
  if (!clinicSlug) throw new Error("Mailbox clinic slug missing.");

  let processGmailMessageIntoReferral: typeof import("./process-message").processGmailMessageIntoReferral;
  try {
    ({ processGmailMessageIntoReferral } = await import("./process-message"));
  } catch (error) {
    throw new Error(
      `process_message_import_failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  let messageIds: string[];
  try {
    messageIds = await listRecentInboxMessageIds({
      accessToken,
      maxResults: args.maxResults ?? 25,
    });
  } catch (error) {
    throw new Error(
      `gmail_list_failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const results: Array<{ messageId: string; ok: boolean; error?: string }> = [];
  for (const messageId of messageIds) {
    try {
      const outcome = await processGmailMessageIntoReferral({
        refreshToken,
        messageId,
        clinicSlug,
        mailboxEmail: mailbox.email_address,
        actor: "gmail-recovery",
      });
      results.push({ messageId, ok: outcome.ok, error: outcome.error });
    } catch (error) {
      results.push({
        messageId,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const supabase = referralIntakeSupabase();
  await supabase
    .from("referral_mailboxes")
    .update({ last_polled_at: new Date().toISOString() })
    .eq("id", mailbox.id);

  await writeReferralAudit({
    clinicId: mailbox.clinic_id,
    actor: "system",
    action: "mailbox.recovery_scan",
    detail: { mailboxId: mailbox.id, scanned: messageIds.length },
  });

  return { scanned: messageIds.length, results };
}
