import { createClient } from "@supabase/supabase-js";
import { clinikoFindOrCreatePatient, clinikoUpdateCustomFields } from "@/lib/cliniko";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

// GET - fetch latest referrals
export async function GET() {
  try {
    console.log("SUPABASE URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log("SERVICE KEY EXISTS:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.log(
      "SERVICE KEY START:",
      process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 12)
    );

    const { data, error } = await supabase
      .from("referrals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return Response.json(
        { success: false, error: error.message },
        { status: 500 }
      );
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
    const body = await req.json();
    const createdAt = new Date();
    const nextFollowUpAt = new Date(createdAt.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();

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

    const { data, error } = await supabase
      .from("referrals")
      .insert([
        {
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
        },
      ])
      .select()
      .single();

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

// force vercel route rebuild
