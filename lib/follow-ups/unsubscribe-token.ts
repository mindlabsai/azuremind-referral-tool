import { createHmac, timingSafeEqual } from "crypto";

function secret(): string {
  const value =
    process.env.UNSUBSCRIBE_SECRET?.trim() || process.env.CRON_SECRET?.trim() || "";
  if (!value) {
    throw new Error("UNSUBSCRIBE_SECRET or CRON_SECRET is required for unsubscribe links.");
  }
  return value;
}

/** HMAC token bound to a referral id (URL-safe hex). */
export function signUnsubscribeToken(referralId: string): string {
  return createHmac("sha256", secret()).update(`unsubscribe:${referralId}`).digest("hex");
}

export function verifyUnsubscribeToken(referralId: string, token: string): boolean {
  if (!referralId || !token) return false;
  try {
    const expected = signUnsubscribeToken(referralId);
    const a = Buffer.from(expected);
    const b = Buffer.from(token);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function buildUnsubscribeUrl(origin: string, referralId: string): string {
  const token = signUnsubscribeToken(referralId);
  const url = new URL("/api/follow-ups/unsubscribe", origin);
  url.searchParams.set("id", referralId);
  url.searchParams.set("token", token);
  return url.toString();
}
