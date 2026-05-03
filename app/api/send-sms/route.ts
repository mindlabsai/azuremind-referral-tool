import twilio from "twilio";

/** 04XXXXXXXX → +614XXXXXXXX; 4XXXXXXXX (9 digits) → +614XXXXXXXX; +614… E.164 accepted. */
function normalizeAuMobile(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;

  const digits = t.startsWith("+")
    ? t.slice(1).replace(/\D/g, "")
    : t.replace(/\D/g, "");

  let n: string;
  if (digits.length === 10 && digits.startsWith("04")) {
    n = "61" + digits.slice(1);
  } else if (digits.length === 9 && digits.startsWith("4")) {
    n = "61" + digits;
  } else if (digits.length === 11 && digits.startsWith("61")) {
    n = digits;
  } else if (t.startsWith("+") && digits.startsWith("61")) {
    n = digits.length >= 11 ? digits.slice(0, 11) : digits;
  } else {
    return null;
  }

  if (n.length !== 11 || !n.startsWith("61") || n[2] !== "4") return null;
  return `+${n}`;
}

export async function POST(req: Request) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER?.trim();

  if (!accountSid || !authToken || !from) {
    return Response.json(
      { success: false, error: "Missing Twilio environment variables" },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const p = body as { to?: unknown; message?: unknown };
  const toRaw = typeof p.to === "string" ? p.to : "";
  const message = typeof p.message === "string" ? p.message : "";

  const to = normalizeAuMobile(toRaw);
  if (!to) {
    return Response.json(
      { success: false, error: "Invalid Australian mobile number" },
      { status: 400 }
    );
  }

  if (!message.trim()) {
    return Response.json({ success: false, error: "Message is required" }, { status: 400 });
  }

  try {
    const client = twilio(accountSid, authToken);
    const sent = await client.messages.create({ from, to, body: message });
    return Response.json({ success: true, sid: sent.sid });
  } catch (e) {
    const error = e instanceof Error ? e.message : "SMS send failed";
    return Response.json({ success: false, error }, { status: 500 });
  }
}
