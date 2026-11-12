import { NextRequest, NextResponse } from "next/server";
import { halaxySearchPatients, isHalaxyConfigured } from "@/lib/halaxy";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!isHalaxyConfigured()) {
    return NextResponse.json({ patients: [] });
  }
  const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ patients: [] });
  try {
    const patients = await halaxySearchPatients(query);
    return NextResponse.json({ patients });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Halaxy search failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
