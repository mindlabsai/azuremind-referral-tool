import { defaultClinicSlug } from "./config";
import { referralIntakeSupabase } from "./supabase-admin";
import type { ClinicRecord } from "./types";

const FALLBACK_CLINICS: ClinicRecord[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    slug: "perth-paediatrics",
    display_name: "Perth Paediatrics",
    timezone: "Australia/Perth",
    active: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    slug: "azure-mind",
    display_name: "Azure Mind",
    timezone: "Australia/Perth",
    active: true,
  },
];

export async function resolveClinicBySlug(slug?: string): Promise<ClinicRecord> {
  const wanted = (slug || defaultClinicSlug()).trim().toLowerCase();
  try {
    const supabase = referralIntakeSupabase();
    const { data, error } = await supabase
      .from("clinics")
      .select("id, slug, display_name, timezone, active")
      .eq("slug", wanted)
      .maybeSingle();
    if (!error && data) return data as ClinicRecord;
  } catch {
    /* schema may not be applied yet */
  }
  const fallback = FALLBACK_CLINICS.find((c) => c.slug === wanted) ?? FALLBACK_CLINICS[0]!;
  return fallback;
}

export function listFallbackClinics(): ClinicRecord[] {
  return FALLBACK_CLINICS;
}
