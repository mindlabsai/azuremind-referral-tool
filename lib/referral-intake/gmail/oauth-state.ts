import { createHmac, timingSafeEqual } from "crypto";

type OAuthStatePayload = {
  clinicSlug: string;
  mailboxEmail: string;
  nonce: string;
  t: number;
};

function stateSecret(): string {
  return (
    process.env.TEXLEX_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.GOOGLE_CLIENT_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    ""
  );
}

/** Prefer configured APP_URL so Vercel internal hosts never break the post-Allow redirect. */
export function appOriginFromRequest(req: Request): string {
  const configured =
    process.env.APP_URL?.trim() ||
    process.env.TEXLEX_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  if (configured) return configured.replace(/\/$/, "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (host) return `${proto.split(",")[0]!.trim()}://${host.split(",")[0]!.trim()}`;
  return new URL(req.url).origin;
}

export function createSignedOAuthState(input: {
  clinicSlug: string;
  mailboxEmail?: string;
}): string {
  const secret = stateSecret();
  if (!secret) {
    throw new Error("Missing TEXLEX_TOKEN_ENCRYPTION_KEY (needed to sign OAuth state).");
  }
  const payload: OAuthStatePayload = {
    clinicSlug: input.clinicSlug,
    mailboxEmail: input.mailboxEmail?.trim() || "",
    nonce: createHmac("sha256", secret).update(`${Date.now()}:${Math.random()}`).digest("hex").slice(0, 32),
    t: Date.now(),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySignedOAuthState(state: string): OAuthStatePayload | null {
  const secret = stateSecret();
  if (!secret) return null;
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthStatePayload;
    if (!parsed?.clinicSlug || typeof parsed.t !== "number") return null;
    // 30 minutes — Google consent can be slow; cookie alone was dropping returns.
    if (Date.now() - parsed.t > 30 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}
