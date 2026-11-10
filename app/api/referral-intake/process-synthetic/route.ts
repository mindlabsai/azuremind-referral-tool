import { NextResponse } from "next/server";
import { referralIntakeEnabled } from "@/lib/referral-intake/config";
import { createReferralFromIntake } from "@/lib/referral-intake/pipeline";
import type { ReferralReaderExtract } from "@/lib/referral-reader/types";

export const runtime = "nodejs";

/**
 * Synthetic intake for Phase 1 verification without Gmail credentials.
 * Accepts a forced extract + optional PDF bytes (base64). Never sends parent comms.
 */
export async function POST(req: Request) {
  if (!referralIntakeEnabled()) {
    return NextResponse.json({ success: false, error: "intake_disabled" }, { status: 403 });
  }

  // Extra gate: only allow in non-production OR when explicitly enabled
  if (
    process.env.NODE_ENV === "production" &&
    process.env.TEXLEX_REFERRAL_SYNTHETIC_API !== "1"
  ) {
    return NextResponse.json(
      { success: false, error: "Synthetic intake API is disabled in production." },
      { status: 403 }
    );
  }

  const body = (await req.json()) as {
    clinicSlug?: string;
    messageId?: string;
    fromAddress?: string;
    subject?: string;
    receivedAt?: string;
    extract?: ReferralReaderExtract;
    pdfBase64?: string;
    filename?: string;
  };

  if (!body.extract) {
    return NextResponse.json({ success: false, error: "extract is required." }, { status: 400 });
  }

  const messageId =
    body.messageId?.trim() || `synthetic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const documents = [];
  if (body.pdfBase64) {
    documents.push({
      filename: body.filename || "synthetic-referral.pdf",
      contentType: "application/pdf",
      bytes: Buffer.from(body.pdfBase64, "base64"),
    });
  } else {
    // Minimal placeholder PDF bytes so document store always has an original
    documents.push({
      filename: body.filename || "synthetic-referral.pdf",
      contentType: "application/pdf",
      bytes: Buffer.from(
        `%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\nsynthetic:${messageId}\n`
      ),
    });
  }

  const result = await createReferralFromIntake({
    clinicSlug: body.clinicSlug || "perth-paediatrics",
    source: "gp_email",
    actor: "synthetic",
    forcedExtract: body.extract,
    email: {
      provider: "synthetic",
      providerMessageId: messageId,
      fromAddress: body.fromAddress || "gp.synthetic@example.com",
      subject: body.subject || "Synthetic GP referral",
      receivedAt: body.receivedAt || new Date().toISOString(),
      mailboxEmail: "referrals-test@example.com",
    },
    documents,
  });

  // Idempotency check: second call with same messageId
  const duplicate = await createReferralFromIntake({
    clinicSlug: body.clinicSlug || "perth-paediatrics",
    source: "gp_email",
    actor: "synthetic-dedupe-check",
    forcedExtract: body.extract,
    email: {
      provider: "synthetic",
      providerMessageId: messageId,
      receivedAt: body.receivedAt || new Date().toISOString(),
    },
    documents,
  });

  return NextResponse.json({
    success: result.ok,
    result,
    idempotency: {
      secondCallOk: duplicate.ok,
      sameReferralId: Boolean(
        result.referralId && duplicate.referralId && result.referralId === duplicate.referralId
      ),
      duplicateOfReferralId: duplicate.duplicateOfReferralId ?? null,
    },
    liveCommsBlocked: true,
    error: result.error,
  });
}
