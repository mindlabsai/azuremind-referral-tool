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

/** Missed Pub/Sub recovery scan. Idempotent via intake dedupe keys. */
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
      scanned: 0,
      reason: "live_mailbox_disabled",
    });
  }

  const body = (await req.json().catch(() => ({}))) as {
    mailboxEmail?: string;
    maxResults?: number;
  };

  let mailboxes = await listActiveMailboxes();
  if (body.mailboxEmail) {
    const wanted = body.mailboxEmail.trim().toLowerCase();
    mailboxes = mailboxes.filter((m) => m.email_address.toLowerCase() === wanted);
  }

  const outcomes = [];
  for (const mailbox of mailboxes) {
    const result = await recoverMissedMailboxMessages({
      mailbox,
      maxResults: body.maxResults,
    });
    outcomes.push({ mailbox: mailbox.email_address, ...result });
  }

  return NextResponse.json({ success: true, outcomes });
}
