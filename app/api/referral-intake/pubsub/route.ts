import { NextResponse } from "next/server";
import {
  referralIntakeEnabled,
  referralIntakeLiveMailbox,
} from "@/lib/referral-intake/config";
import { listActiveMailboxes, processMailboxHistory } from "@/lib/referral-intake/gmail/mailbox";
import { writeReferralAudit } from "@/lib/referral-intake/audit";

export const runtime = "nodejs";

type PubSubPushBody = {
  message?: {
    data?: string;
    messageId?: string;
    publishTime?: string;
  };
  subscription?: string;
};

/**
 * Google Pub/Sub push endpoint for Gmail watch notifications.
 * When live mailbox is off, acknowledges (200) without processing.
 * Does not deploy or activate watches by itself.
 */
export async function POST(req: Request) {
  if (!referralIntakeEnabled()) {
    return NextResponse.json({ ok: false, error: "intake_disabled" }, { status: 403 });
  }

  let body: PubSubPushBody;
  try {
    body = (await req.json()) as PubSubPushBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  let decoded: { emailAddress?: string; historyId?: string | number } = {};
  if (body.message?.data) {
    try {
      decoded = JSON.parse(Buffer.from(body.message.data, "base64").toString("utf8")) as {
        emailAddress?: string;
        historyId?: string | number;
      };
    } catch {
      decoded = {};
    }
  }

  if (!referralIntakeLiveMailbox()) {
    console.info("[referral-intake] Pub/Sub received but live mailbox processing is off", {
      emailAddress: decoded.emailAddress ?? null,
      historyId: decoded.historyId ?? null,
      messageId: body.message?.messageId ?? null,
    });
    return NextResponse.json({
      ok: true,
      processed: false,
      reason: "live_mailbox_disabled",
    });
  }

  try {
    const mailboxes = await listActiveMailboxes();
    const email = decoded.emailAddress?.trim().toLowerCase();
    const targets = email
      ? mailboxes.filter((m) => m.email_address.toLowerCase() === email)
      : mailboxes;

    const outcomes = [];
    for (const mailbox of targets) {
      const result = await processMailboxHistory({
        mailbox,
        historyId: decoded.historyId != null ? String(decoded.historyId) : undefined,
      });
      outcomes.push({ mailbox: mailbox.email_address, ...result });
      await writeReferralAudit({
        clinicId: mailbox.clinic_id,
        actor: "pubsub",
        action: "mailbox.pubsub_notification",
        detail: {
          historyId: decoded.historyId ?? null,
          processed: result.processed,
        },
      });
    }

    return NextResponse.json({ ok: true, processed: true, outcomes });
  } catch (error) {
    console.error("[referral-intake] pubsub handler error", error);
    // Return 200 sparingly — prefer 500 so Pub/Sub retries on hard failures
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
