import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type AttachmentIn = {
  filename: string;
  /** Base64 without data: prefix */
  contentBase64: string;
  contentType?: string;
};

type SendBody = {
  to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject?: string;
  html?: string;
  text?: string;
  attachments?: AttachmentIn[];
  /** Optional reply-to */
  replyTo?: string;
};

function asAddressList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr.map((s) => String(s).trim()).filter(Boolean);
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
      from: "Azure Mind <referrals@azuremind.com.au>",
      to,
      ...(cc.length ? { cc } : {}),
      ...(bcc.length ? { bcc } : {}),
      ...(body.replyTo?.trim() ? { replyTo: body.replyTo.trim() } : {}),
      subject: body.subject || "Azure Mind correspondence",
      html: body.html || "<p>Azure Mind correspondence</p>",
      ...(body.text?.trim() ? { text: body.text.trim() } : {}),
      ...(attachments?.length ? { attachments } : {}),
    });

    if (result.error) {
      return Response.json({ success: false, error: result.error.message }, { status: 400 });
    }

    return Response.json({ success: true, data: result.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email error";
    console.error("RESEND CATCH ERROR:", message);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
