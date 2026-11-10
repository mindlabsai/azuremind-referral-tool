/**
 * Phase 1 referral intake feature flags and Google/Gmail config.
 * Live mailbox processing stays off until credentials + TEXLEX_REFERRAL_INTAKE_LIVE=1.
 */

export function referralIntakeEnabled(): boolean {
  return process.env.TEXLEX_REFERRAL_INTAKE_ENABLED === "1";
}

/** When false (default), never send parent email/SMS from intake paths. */
export function referralLiveCommsEnabled(): boolean {
  return process.env.TEXLEX_REFERRAL_LIVE_COMMS === "1";
}

/** When false (default), Pub/Sub + watch handlers acknowledge but do not process. */
export function referralIntakeLiveMailbox(): boolean {
  return (
    referralIntakeEnabled() &&
    process.env.TEXLEX_REFERRAL_INTAKE_LIVE === "1" &&
    Boolean(process.env.GOOGLE_CLIENT_ID?.trim()) &&
    Boolean(process.env.GOOGLE_CLIENT_SECRET?.trim())
  );
}

export function defaultClinicSlug(): string {
  return process.env.TEXLEX_DEFAULT_CLINIC_SLUG?.trim() || "perth-paediatrics";
}

function resolvedAppOrigin(): string {
  // Prefer server-only vars (no NEXT_PUBLIC_ — avoids browser exposure / Vercel warning).
  const serverOnly =
    process.env.APP_URL?.trim() ||
    process.env.TEXLEX_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  if (serverOnly) return serverOnly.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return "http://localhost:3001";
}

function resolvedOAuthRedirectUri(): string {
  const explicit = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  return `${resolvedAppOrigin()}/api/referral-intake/oauth/callback`;
}

export function gmailConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID?.trim() || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() || "",
    redirectUri: resolvedOAuthRedirectUri(),
    pubsubTopic: process.env.GOOGLE_PUBSUB_TOPIC?.trim() || "",
    pubsubAudience: process.env.GOOGLE_PUBSUB_AUDIENCE?.trim() || "",
    // Read-only mailbox access only (Phase 1).
    scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
  };
}

/** Private Supabase Storage bucket for original referral PDFs / images / DOCX. */
export function referralDocumentsBucket(): string {
  return process.env.TEXLEX_REFERRAL_DOC_BUCKET?.trim() || "referral-documents";
}

/** Signed URL lifetime for staff document access (seconds). */
export function referralDocumentSignedUrlTtlSeconds(): number {
  const raw = Number(process.env.TEXLEX_REFERRAL_DOC_URL_TTL_SECONDS ?? "300");
  if (!Number.isFinite(raw) || raw < 60) return 300;
  return Math.min(Math.floor(raw), 3600);
}
