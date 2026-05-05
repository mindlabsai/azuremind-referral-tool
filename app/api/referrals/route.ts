import { createClient } from "@supabase/supabase-js";

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
}export async function POST(req: Request) {
    try {
      const body = await req.json();
  
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
          },
        ])
        .select()
        .single();
  
      if (error) {
        console.error("Supabase insert error:", error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
      }
  
      return Response.json({ success: true, data });
    } catch (e) {
      console.error("POST /api/referrals error:", e);
      return Response.json(
        { success: false, error: e instanceof Error ? e.message : String(e) },
        { status: 500 }
      );
    }
  }// force vercel route rebuild
