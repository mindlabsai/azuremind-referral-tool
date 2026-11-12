import { gmailConfig, referralIntakeLiveMailbox } from "../config";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export function gmailOAuthConfigured(): boolean {
  const cfg = gmailConfig();
  return Boolean(cfg.clientId && cfg.clientSecret && cfg.redirectUri);
}

export function buildGmailAuthUrl(state: string): string {
  const cfg = gmailConfig();
  if (!cfg.clientId || !cfg.redirectUri) {
    throw new Error("Google OAuth is not configured (GOOGLE_CLIENT_ID / GOOGLE_OAUTH_REDIRECT_URI).");
  }
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: cfg.scopes.join(" "),
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeGmailCode(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
}> {
  const cfg = gmailConfig();
  if (!cfg.clientId || !cfg.clientSecret || !cfg.redirectUri) {
    throw new Error("Google OAuth is not configured.");
  }
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const json = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || "Google token exchange failed.");
  }
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_in: json.expires_in ?? 3600,
    scope: json.scope,
    token_type: json.token_type,
  };
}

export async function refreshGmailAccessToken(refreshToken: string): Promise<string> {
  const cfg = gmailConfig();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json = (await response.json()) as { access_token?: string; error?: string };
  if (!response.ok || !json.access_token) {
    throw new Error(json.error || "Google refresh token failed.");
  }
  return json.access_token;
}

export function assertLiveMailboxAllowed(): void {
  if (!referralIntakeLiveMailbox()) {
    throw new Error(
      "Live Gmail mailbox processing is disabled. Set TEXLEX_REFERRAL_INTAKE_ENABLED=1, TEXLEX_REFERRAL_INTAKE_LIVE=1, and Google OAuth credentials."
    );
  }
}
