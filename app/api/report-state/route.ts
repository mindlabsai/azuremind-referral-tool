import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const body = (await req.json()) as { patientId?: string; state?: unknown };
    if (!body.patientId || body.state == null) {
      return Response.json({ success: false, error: "Missing patientId or state" }, { status: 400 });
    }
    const { error } = await supabase.from("report_states").upsert(
      {
        patient_id: body.patientId,
        state: body.state,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "patient_id" }
    );
    if (error) {
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }
    return Response.json({ success: true });
  } catch (e) {
    return Response.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const patientId = new URL(req.url).searchParams.get("patientId");
    if (!patientId) {
      return Response.json({ success: false, error: "Missing patientId" }, { status: 400 });
    }
    const { data, error } = await supabase
      .from("report_states")
      .select("state, updated_at")
      .eq("patient_id", patientId)
      .maybeSingle();
    if (error) {
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }
    return Response.json({
      success: true,
      state: data?.state ?? null,
      updatedAt: data?.updated_at ?? null,
    });
  } catch (e) {
    return Response.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
