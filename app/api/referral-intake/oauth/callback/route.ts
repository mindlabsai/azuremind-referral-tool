import { NextResponse } from "next/server";
import { resolveClinicBySlug } from "@/lib/referral-intake/clinics";
import { referralIntakeEnabled } from "@/lib/referral-intake/config";
import { exchangeGmailCode } from "@/lib/referral-intake/gmail/oauth";
import {
  appOriginFromRequest,
  verifySignedOAuthState,
} from "@/lib/referral-intake/gmail/oauth-state";
import { upsertMailboxOAuth } from "@/lib/referral-intake/gmail/mailbox-oauth";
import { getAccessTokenForRefresh } from "@/lib/referral-intake/gmail/client";

export const runtime = "nodejs";

async function fetchGmailProfileEmail(accessToken: string): Promise<string> {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = (await response.json()) as { emailAddress?: string; error?: { message?: string } };
  if (!response.ok || !json.emailAddress) {
    throw new Error(json.error?.message || "Could not read Gmail profile.");
  }
  return json.emailAddress;
}

function redirectInbox(origin: string, params: Record<string, string>) {
  const dest = new URL("/referral-inbox", origin);
  for (const [key, value] of Object.entries(params)) {
    dest.searchParams.set(key, value);
  }
  return NextResponse.redirect(dest);
}

export async function GET(req: Request) {
  const origin = appOriginFromRequest(req);
  try {
    if (!referralIntakeEnabled()) {
      return redirectInbox(origin, { oauth: "error", reason: "intake_disabled" });
    }

    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");
    if (oauthError) {
      return redirectInbox(origin, { oauth: "error", reason: oauthError });
    }
    if (!code || !state) {
      return redirectInbox(origin, { oauth: "error", reason: "missing_code_or_state" });
    }

    const parsed = verifySignedOAuthState(state);
    if (!parsed) {
      return redirectInbox(origin, { oauth: "error", reason: "invalid_or_expired_state" });
    }
    const clinicSlug = parsed.clinicSlug || "perth-paediatrics";

    const tokens = await exchangeGmailCode(code);
    if (!tokens.refresh_token) {
      return redirectInbox(origin, { oauth: "error", reason: "missing_refresh_token" });
    }
    const email = await fetchGmailProfileEmail(tokens.access_token);
    await getAccessTokenForRefresh(tokens.refresh_token);
    const clinic = await resolveClinicBySlug(clinicSlug);
    await upsertMailboxOAuth({
      clinicId: clinic.id,
      emailAddress: email,
      refreshToken: tokens.refresh_token,
    });

    return redirectInbox(origin, {
      oauth: "connected",
      mailbox: email,
      clinic: clinicSlug,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "oauth_failed";
    console.error("[gmail-oauth-callback]", message);
    return redirectInbox(origin, { oauth: "error", reason: message.slice(0, 180) });
  }
}
