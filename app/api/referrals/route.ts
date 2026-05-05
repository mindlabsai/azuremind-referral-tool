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
}