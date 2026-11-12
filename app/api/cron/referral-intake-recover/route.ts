import { NextResponse } from "next/server";
import {
  referralIntakeEnabled,
  referralIntakeLiveMailbox,
} from "@/lib/referral-intake/config";
import {
  listActiveMailboxes,
  recoverMissedMailboxMessages,
} from "@/lib/referral-intake/gmail/mailbox";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Vercel cron: recover missed Pub/Sub notifications (idempotent). */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
    }
  }

  if (!referralIntakeEnabled()) {
    return NextResponse.json({ success: true, scanned: 0, reason: "intake_disabled" });
  }
  if (!referralIntakeLiveMailbox()) {
    return NextResponse.json({ success: true, scanned: 0, reason: "live_mailbox_disabled" });
  }

  const mailboxes = await listActiveMailboxes();
  const outcomes = [];
  for (const mailbox of mailboxes) {
    try {
      const result = await recoverMissedMailboxMessages({ mailbox, maxResults: 40 });
      outcomes.push({ mailbox: mailbox.email_address, ok: true, ...result });
    } catch (error) {
      outcomes.push({
        mailbox: mailbox.email_address,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({ success: true, outcomes });
}
