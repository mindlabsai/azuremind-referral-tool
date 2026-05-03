import twilio from "twilio";

/** 04XXXXXXXX → +614XXXXXXXX; 4XXXXXXXX (9 digits) → +614XXXXXXXX; +614… E.164 accepted. */
function formatAU(phone: string) {
  if (!phone) return null;

  const digits = phone.replace(/\D/g, '');

  // 0400000000 → +61400000000
  if (digits.length === 10 && digits.startsWith('04')) {
    return '+61' + digits.slice(1);
  }

  // 400000000 → +61400000000
  if (digits.length === 9 && digits.startsWith('4')) {
    return '+61' + digits;
  }

  // 61400000000 → +61400000000
  if (digits.length === 11 && digits.startsWith('61')) {
    return '+' + digits;
  }

  // Already correct (+614...)
  if (phone.startsWith('+61')) {
    return phone;
  }

  return null;
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

  const to = formatAU(toRaw);
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
