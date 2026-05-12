import { NextRequest, NextResponse } from "next/server";
import { clinikoSearchPatients, isClinikoConfigured } from "@/lib/cliniko";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!isClinikoConfigured()) {
    return NextResponse.json({ patients: [] });
  }

  const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json({ patients: [] });
  }

  try {
    const patients = await clinikoSearchPatients(query);
    return NextResponse.json({ patients });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cliniko search failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
