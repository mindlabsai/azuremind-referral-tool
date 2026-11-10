import { createClient } from "@supabase/supabase-js";
import {
  defaultClinicSlug,
  gmailConfig,
  referralDocumentsBucket,
  referralIntakeEnabled,
  referralIntakeLiveMailbox,
  referralLiveCommsEnabled,
} from "./config";
import { referralDocumentsBucketReady } from "./document-store";
import { gmailOAuthConfigured } from "./gmail/oauth";

export type IntakeReadiness = {
  intakeEnabled: boolean;
  liveMailbox: boolean;
  liveComms: boolean;
  defaultClinicSlug: string;
  productionReady: boolean;
  blockers: string[];
  warnings: string[];
  google: {
    oauthConfigured: boolean;
    clientIdPresent: boolean;
    clientSecretPresent: boolean;
    pubsubTopicPresent: boolean;
    redirectUri: string;
    scopes: string[];
  };
  secrets: {
    serviceRoleKey: boolean;
    tokenEncryptionKey: boolean;
    cronSecret: boolean;
    anthropicApiKey: boolean;
  };
  schema: {
    clinics: boolean;
    mailboxes: boolean;
    intakeEvents: boolean;
    documents: boolean;
    audit: boolean;
    referralsClinicId: boolean;
    documentLabels: boolean;
    phase3Review: boolean;
  };
  storage: {
    bucket: string;
    ready: boolean;
  };
  mailboxes: Array<{
    email: string;
    clinicSlug: string | null;
    active: boolean;
    watchExpiration: string | null;
    hasRefreshToken: boolean;
  }>;
  safety: {
    parentEmailSmsFromIntake: false;
    automaticRedistribution: false;
    automaticClinicalDecisions: false;
    humanReviewForUncertainExtraction: true;
  };
};

async function probeSchema(): Promise<IntakeReadiness["schema"]> {
  const empty = {
    clinics: false,
    mailboxes: false,
    intakeEvents: false,
    documents: false,
    audit: false,
    referralsClinicId: false,
    documentLabels: false,
    phase3Review: false,
  };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return empty;

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const check = async (table: string) => {
    const { error } = await supabase.from(table).select("*").limit(1);
    if (!error) return true;
    // missing table / permission
    return !/does not exist|Could not find the table/i.test(error.message);
  };

  const [clinics, mailboxes, intakeEvents, documents, audit] = await Promise.all([
    check("clinics"),
    check("referral_mailboxes"),
    check("referral_intake_events"),
    check("referral_documents"),
    check("referral_audit_events"),
  ]);

  let referralsClinicId = false;
  const { error: colError } = await supabase.from("referrals").select("clinic_id").limit(1);
  referralsClinicId = !colError;

  const { error: labelError } = await supabase
    .from("referral_documents")
    .select("contains_referral_info, extraction_role")
    .limit(1);
  const documentLabels = !labelError;

  const { error: phase3DocError } = await supabase
    .from("referral_documents")
    .select("identity_conflict, conflict_resolution")
    .limit(1);
  const { error: phase3RefError } = await supabase
    .from("referrals")
    .select("patient_identity_conflict")
    .limit(1);
  const phase3Review = !phase3DocError && !phase3RefError;

  return {
    clinics,
    mailboxes,
    intakeEvents,
    documents,
    audit,
    referralsClinicId,
    documentLabels,
    phase3Review,
  };
}

async function listMailboxes(): Promise<IntakeReadiness["mailboxes"]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return [];
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase
    .from("referral_mailboxes")
    .select(
      "email_address, active, watch_expiration, oauth_refresh_token_encrypted, clinics(slug)"
    )
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => {
    const clinics = (row as { clinics?: { slug?: string } | { slug?: string }[] }).clinics;
    const slug = Array.isArray(clinics) ? clinics[0]?.slug : clinics?.slug;
    return {
      email: String((row as { email_address?: string }).email_address ?? ""),
      clinicSlug: slug ?? null,
      active: Boolean((row as { active?: boolean }).active),
      watchExpiration: ((row as { watch_expiration?: string | null }).watch_expiration as string | null) ?? null,
      hasRefreshToken: Boolean(
        (row as { oauth_refresh_token_encrypted?: string | null }).oauth_refresh_token_encrypted
      ),
    };
  });
}

export async function getIntakeReadiness(): Promise<IntakeReadiness> {
  const gmail = gmailConfig();
  const schema = await probeSchema();
  const mailboxes = await listMailboxes();
  const secrets = {
    serviceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    tokenEncryptionKey: Boolean(process.env.TEXLEX_TOKEN_ENCRYPTION_KEY?.trim()),
    cronSecret: Boolean(process.env.CRON_SECRET?.trim()),
    anthropicApiKey: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
  };
  const storageReady = secrets.serviceRoleKey ? await referralDocumentsBucketReady() : false;
  const storage = {
    bucket: referralDocumentsBucket(),
    ready: storageReady,
  };

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!referralIntakeEnabled()) blockers.push("Set TEXLEX_REFERRAL_INTAKE_ENABLED=1");
  if (!secrets.serviceRoleKey) blockers.push("Add SUPABASE_SERVICE_ROLE_KEY (required for intake writes under RLS)");
  if (!schema.clinics || !schema.mailboxes || !schema.intakeEvents || !schema.documents || !schema.audit) {
    blockers.push("Run supabase/migrations/20261106_referral_intake_phase1.sql");
  }
  if (!schema.referralsClinicId) blockers.push("referrals.clinic_id missing — re-run security/intake SQL");
  if (!storage.ready) {
    blockers.push(
      `Supabase Storage bucket "${storage.bucket}" missing — run supabase/migrations/20261110_referral_documents_storage.sql`
    );
  }
  if (!schema.documentLabels) {
    blockers.push(
      "Run supabase/migrations/20261110_referral_documents_phase2.sql (contains_referral_info / extraction_role)"
    );
  }
  if (!schema.phase3Review) {
    blockers.push(
      "Run supabase/migrations/20261111_referral_intake_phase3.sql (identity conflict + review columns)"
    );
  }
  if (!gmailOAuthConfigured()) blockers.push("Add GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + redirect URI");
  if (!gmail.pubsubTopic) blockers.push("Add GOOGLE_PUBSUB_TOPIC (projects/…/topics/…)");
  if (!secrets.tokenEncryptionKey) blockers.push("Add TEXLEX_TOKEN_ENCRYPTION_KEY");
  if (!secrets.anthropicApiKey) {
    blockers.push("Add ANTHROPIC_API_KEY (required for PDF/image vision and field extraction)");
  }
  if (!mailboxes.some((m) => m.hasRefreshToken)) {
    blockers.push("Connect clinic Gmail via Inbox → Connect mailbox (OAuth)");
  }
  if (!referralIntakeLiveMailbox()) {
    blockers.push("Set TEXLEX_REFERRAL_INTAKE_LIVE=1 after OAuth + Pub/Sub push URL are live");
  }
  if (!secrets.cronSecret) warnings.push("CRON_SECRET missing — watch renew/recover routes are open");
  if (referralLiveCommsEnabled()) {
    warnings.push("TEXLEX_REFERRAL_LIVE_COMMS=1 — keep off; intake still will not message parents");
  }
  if (
    !process.env.APP_URL?.trim() &&
    !process.env.TEXLEX_APP_URL?.trim() &&
    !process.env.NEXT_PUBLIC_APP_URL?.trim() &&
    !process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() &&
    process.env.VERCEL
  ) {
    warnings.push("Set APP_URL (or GOOGLE_OAUTH_REDIRECT_URI) to your production https origin");
  }

  const productionReady = blockers.length === 0;

  return {
    intakeEnabled: referralIntakeEnabled(),
    liveMailbox: referralIntakeLiveMailbox(),
    liveComms: referralLiveCommsEnabled(),
    defaultClinicSlug: defaultClinicSlug(),
    productionReady,
    blockers,
    warnings,
    google: {
      oauthConfigured: gmailOAuthConfigured(),
      clientIdPresent: Boolean(gmail.clientId),
      clientSecretPresent: Boolean(gmail.clientSecret),
      pubsubTopicPresent: Boolean(gmail.pubsubTopic),
      redirectUri: gmail.redirectUri,
      scopes: gmail.scopes,
    },
    secrets,
    schema,
    storage,
    mailboxes,
    safety: {
      parentEmailSmsFromIntake: false,
      automaticRedistribution: false,
      automaticClinicalDecisions: false,
      humanReviewForUncertainExtraction: true,
    },
  };
}
