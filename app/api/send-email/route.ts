import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return Response.json(
        { success: false, error: "Missing RESEND_API_KEY" },
        { status: 500 }
      );
    }

    const { to, subject, html } = await req.json();

const result = await resend.emails.send({
  from: "Azure Mind <referrals@azuremind.com.au>",
  to,
  subject: subject || "Azure Mind Referral",
  html: html || "<p>Azure Mind referral email</p>",
});

    console.log("RESEND RESULT:", JSON.stringify(result, null, 2));

    if (result.error) {
      return Response.json(
        { success: false, error: result.error.message },
        { status: 400 }
      );
    }

    return Response.json({ success: true, data: result.data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown email error";

    console.error("RESEND CATCH ERROR:", message);

    return Response.json({ success: false, error: message }, { status: 500 });
  }
}