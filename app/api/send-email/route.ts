import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

/** Initial referral-engine invite (parents). */
const FROM_REFERRAL =
  process.env.EMAIL_FROM_REFERRAL?.trim() || "Azure Mind <referrals@azuremind.com.au>";

/** All later clinic correspondence (Texlex, follow-ups, letters). */
const FROM_CORRESPONDENCE =
  process.env.EMAIL_FROM_CORRESPONDENCE?.trim() || "Azure Mind <admin@azuremind.com.au>";

/** Where parent/clinician replies should land (Workspace → Gmail if forwarded). */
const REPLY_TO_DEFAULT =
  process.env.EMAIL_REPLY_TO?.trim() || "admin@azuremind.com.au";

type AttachmentIn = {
  filename: string;
  /** Base64 without data: prefix */
  contentBase64: string;
  contentType?: string;
};

type SendPurpose = "referral" | "correspondence";

type SendBody = {
  to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject?: string;
  html?: string;
  text?: string;
  attachments?: AttachmentIn[];
  /** Optional reply-to override; defaults to admin@azuremind.com.au */
  replyTo?: string;
  /**
   * referral = referrals@ (first invite)
   * correspondence = admin@ (everything after)
   * Default: correspondence
   */
  purpose?: SendPurpose;
};

function asAddressList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr.map((s) => String(s).trim()).filter(Boolean);
}

function resolveFrom(purpose: SendPurpose | undefined): string {
  return purpose === "referral" ? FROM_REFERRAL : FROM_CORRESPONDENCE;
}

export async function POST(req: Request) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return Response.json({ success: false, error: "Missing RESEND_API_KEY" }, { status: 500 });
    }

    const body = (await req.json()) as SendBody;
    const to = asAddressList(body.to);
    if (!to.length) {
      return Response.json({ success: false, error: "At least one recipient (to) is required" }, { status: 400 });
    }

    const cc = asAddressList(body.cc);
    const bcc = asAddressList(body.bcc);
    const purpose: SendPurpose = body.purpose === "referral" ? "referral" : "correspondence";
    const from = resolveFrom(purpose);
    const replyTo = body.replyTo?.trim() || REPLY_TO_DEFAULT;

    const attachments =
      Array.isArray(body.attachments) && body.attachments.length
        ? body.attachments
            .filter((a) => a?.filename && a?.contentBase64)
            .map((a) => ({
              filename: a.filename,
              content: Buffer.from(a.contentBase64, "base64"),
              contentType: a.contentType || "application/pdf",
            }))
        : undefined;

    // Cap total attachment payload ~15MB base64 ≈ practical Resend limit cushion
    if (attachments?.length) {
      const totalBytes = attachments.reduce((n, a) => n + a.content.length, 0);
      if (totalBytes > 12 * 1024 * 1024) {
        return Response.json(
          { success: false, error: "Attachments too large (max ~12MB combined)" },
          { status: 400 }
        );
      }
    }

    const result = await resend.emails.send({
      from,
      to,
      ...(cc.length ? { cc } : {}),
      ...(bcc.length ? { bcc } : {}),
      replyTo,
      subject: body.subject || "Azure Mind correspondence",
      html: body.html || "<p>Azure Mind correspondence</p>",
      ...(body.text?.trim() ? { text: body.text.trim() } : {}),
      ...(attachments?.length ? { attachments } : {}),
    });

    if (result.error) {
      return Response.json({ success: false, error: result.error.message }, { status: 400 });
    }

    return Response.json({
      success: true,
      data: result.data,
      from,
      replyTo,
      purpose,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email error";
    console.error("RESEND CATCH ERROR:", message);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
