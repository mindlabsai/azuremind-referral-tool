import { referralIntakeSupabase } from "./supabase-admin";

export type OpsFlagKey = "auto_ready_enabled";

/** Short in-process cache so kill-switch flips take effect within seconds, not one DB hit per ms. */
const cache = new Map<OpsFlagKey, { enabled: boolean; expiresAt: number }>();
const CACHE_TTL_MS = 3_000;

function envAutoReadyForcedOff(): boolean {
  const raw = process.env.TEXLEX_REFERRAL_AUTO_READY?.trim();
  return raw === "0" || raw === "false";
}

/**
 * Immediate operational switch for auto-ready.
 * - Env TEXLEX_REFERRAL_AUTO_READY=0 always wins (requires redeploy to change).
 * - Otherwise reads referral_ops_flags.auto_ready_enabled (DB; live within ~3s).
 * - Missing flag / DB error → default ON (fail open to product intent; env can still force off).
 */
export async function referralAutoReadyEnabled(): Promise<boolean> {
  if (envAutoReadyForcedOff()) return false;

  const cached = cache.get("auto_ready_enabled");
  if (cached && cached.expiresAt > Date.now()) return cached.enabled;

  try {
    const supabase = referralIntakeSupabase();
    const { data, error } = await supabase
      .from("referral_ops_flags")
      .select("enabled")
      .eq("key", "auto_ready_enabled")
      .maybeSingle();

    if (error) {
      console.warn("[referral-intake] ops flag read failed — defaulting auto-ready ON:", error.message);
      cache.set("auto_ready_enabled", { enabled: true, expiresAt: Date.now() + CACHE_TTL_MS });
      return true;
    }

    const enabled = data == null ? true : Boolean(data.enabled);
    cache.set("auto_ready_enabled", { enabled, expiresAt: Date.now() + CACHE_TTL_MS });
    return enabled;
  } catch (err) {
    console.warn("[referral-intake] ops flag read exception — defaulting auto-ready ON:", err);
    return true;
  }
}

export async function setReferralAutoReadyEnabled(args: {
  enabled: boolean;
  actor?: string;
  note?: string;
}): Promise<{ ok: true; enabled: boolean } | { ok: false; error: string }> {
  try {
    const supabase = referralIntakeSupabase();
    const { error } = await supabase.from("referral_ops_flags").upsert(
      {
        key: "auto_ready_enabled",
        enabled: args.enabled,
        updated_at: new Date().toISOString(),
        updated_by: args.actor?.trim() || "clinician",
        note:
          args.note?.trim() ||
          (args.enabled
            ? "Auto-ready re-enabled"
            : "Emergency stop — all new referrals forced to staff review"),
      },
      { onConflict: "key" }
    );
    if (error) return { ok: false, error: error.message };
    cache.set("auto_ready_enabled", {
      enabled: args.enabled,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return { ok: true, enabled: args.enabled };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function getReferralAutoReadyFlag(): Promise<{
  enabled: boolean;
  source: "env" | "db" | "default";
  updatedAt?: string | null;
  updatedBy?: string | null;
  note?: string | null;
}> {
  if (envAutoReadyForcedOff()) {
    return { enabled: false, source: "env" };
  }
  try {
    const supabase = referralIntakeSupabase();
    const { data, error } = await supabase
      .from("referral_ops_flags")
      .select("enabled, updated_at, updated_by, note")
      .eq("key", "auto_ready_enabled")
      .maybeSingle();
    if (error || !data) {
      return { enabled: true, source: "default" };
    }
    return {
      enabled: Boolean(data.enabled),
      source: "db",
      updatedAt: data.updated_at ?? null,
      updatedBy: data.updated_by ?? null,
      note: data.note ?? null,
    };
  } catch {
    return { enabled: true, source: "default" };
  }
}

/** Test helper — clear in-process cache. */
export function clearOpsFlagCache(): void {
  cache.clear();
}
