import { clinikoFindOrCreatePatient, clinikoUpdateCustomFields } from "@/lib/cliniko";
import { createClient } from "@/lib/supabase/server";

async function resolveClinicIdForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  const preferredSlug = process.env.TEXLEX_DEFAULT_CLINIC_SLUG?.trim() || "perth-paediatrics";
  const { data: preferred } = await supabase
    .from("clinics")
    .select("id")
    .eq("slug", preferredSlug)
    .maybeSingle();

  if (preferred?.id) {
    const { data: membership } = await supabase
      .from("clinic_memberships")
      .select("clinic_id")
      .eq("user_id", userId)
      .eq("clinic_id", preferred.id)
      .maybeSingle();
    if (membership?.clinic_id) return membership.clinic_id as string;
  }

  const { data: anyMembership } = await supabase
    .from("clinic_memberships")
    .select("clinic_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  return (anyMembership?.clinic_id as string | undefined) ?? null;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("referrals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, data });
  } catch (e) {
    console.error("API ERROR:", e);
    return Response.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const body = await req.json();
    const createdAt = new Date();
    const nextFollowUpAt = new Date(createdAt.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const clinicId = await resolveClinicIdForUser(supabase, user.id);

    let clinikoPatientId: string | null = null;

    try {
      const { patient } = await clinikoFindOrCreatePatient({
        firstName: body.child_first_name ?? "",
        lastName: body.child_last_name ?? "",
        dateOfBirth: body.child_dob ?? undefined,
        email: body.parent_email ?? "",
        phone: body.parent_mobile ?? "",
      });

      clinikoPatientId = patient.id;

      await clinikoUpdateCustomFields(patient.id, {
        parent1FirstName: body.parent_first_name ?? "",
        parent1LastName: body.parent_last_name ?? "",
        assessmentType: body.assessment_type ?? "",
      });
    } catch (clinikoError) {
      console.error("Cliniko sync failed for referral enquiry:", clinikoError);
    }

    const row: Record<string, unknown> = {
      child_first_name: body.child_first_name ?? null,
      child_last_name: body.child_last_name ?? null,
      child_dob: body.child_dob || null,
      parent_first_name: body.parent_first_name ?? null,
      parent_last_name: body.parent_last_name ?? null,
      parent_email: body.parent_email ?? null,
      parent_mobile: body.parent_mobile ?? null,
      assessment_type: body.assessment_type ?? null,
      booking_link: body.booking_link ?? null,
      clinic_phone: body.clinic_phone ?? null,
      sent_email: body.sent_email ?? false,
      sent_sms: body.sent_sms ?? false,
      send_status: body.send_status ?? "sent",
      notes: body.notes ?? null,
      cliniko_patient_id: clinikoPatientId,
      follow_up_stage: 0,
      next_follow_up_at: nextFollowUpAt,
      status: "active",
      opted_out: false,
    };

    // clinic_id only (added by security migration). Extra intake columns stay optional.
    if (clinicId) {
      row.clinic_id = clinicId;
    }

    const { data, error } = await supabase.from("referrals").insert([row]).select().single();

    if (error) {
      console.error("Supabase insert error:", error);
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, data, clinikoPatientId });
  } catch (e) {
    console.error("POST /api/referrals error:", e);
    return Response.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
