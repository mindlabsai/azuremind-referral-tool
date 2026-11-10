import { NextResponse } from "next/server";
import {
  buildGmailAuthUrl,
  gmailOAuthConfigured,
} from "@/lib/referral-intake/gmail/oauth";
import { createSignedOAuthState } from "@/lib/referral-intake/gmail/oauth-state";
import { referralIntakeEnabled } from "@/lib/referral-intake/config";

export const runtime = "nodejs";

/**
 * Begin Gmail OAuth (read-only). Does not activate live processing.
 * Query: clinicSlug (optional), mailboxEmail (optional, for display/state).
 */
export async function GET(req: Request) {
  try {
    if (!referralIntakeEnabled()) {
      return NextResponse.json(
        { success: false, error: "Referral intake is disabled (TEXLEX_REFERRAL_INTAKE_ENABLED)." },
        { status: 403 }
      );
    }
    if (!gmailOAuthConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Google OAuth not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI.",
        },
        { status: 503 }
      );
    }

    const url = new URL(req.url);
    const clinicSlug = url.searchParams.get("clinicSlug")?.trim() || "perth-paediatrics";
    const mailboxEmail = url.searchParams.get("mailboxEmail")?.trim() || "";
    const state = createSignedOAuthState({ clinicSlug, mailboxEmail });
    return NextResponse.redirect(buildGmailAuthUrl(state));
  } catch (error) {
    const message = error instanceof Error ? error.message : "oauth_start_failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
