import { NextResponse } from "next/server";
import {
  referralIntakeEnabled,
  referralIntakeLiveMailbox,
} from "@/lib/referral-intake/config";
import { listActiveMailboxes, renewMailboxWatch } from "@/lib/referral-intake/gmail/mailbox";

export const runtime = "nodejs";

/**
 * Renew Gmail watches for all active mailboxes (call from cron once credentials are live).
 * Safe no-op when live mailbox is disabled.
 */
export async function POST(req: Request) {
  if (!referralIntakeEnabled()) {
    return NextResponse.json({ success: false, error: "intake_disabled" }, { status: 403 });
  }

  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
    }
  }

  if (!referralIntakeLiveMailbox()) {
    return NextResponse.json({
      success: true,
      renewed: 0,
      reason: "live_mailbox_disabled",
      message: "Watch renewal scaffolding ready; live mailbox not activated.",
    });
  }

  const mailboxes = await listActiveMailboxes();
  const results = [];
  for (const mailbox of mailboxes) {
    try {
      const watch = await renewMailboxWatch(mailbox);
      results.push({ mailbox: mailbox.email_address, ok: true, ...watch });
    } catch (error) {
      results.push({
        mailbox: mailbox.email_address,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({ success: true, renewed: results.filter((r) => r.ok).length, results });
}
