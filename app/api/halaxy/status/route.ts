import { NextResponse } from "next/server";
import { halaxySearchPatients, isHalaxyConfigured } from "@/lib/halaxy";

export const runtime = "nodejs";

export async function GET() {
  if (!isHalaxyConfigured()) {
    return NextResponse.json({ configured: false, connected: false });
  }
  try {
    await halaxySearchPatients("aa");
    return NextResponse.json({ configured: true, connected: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Halaxy connection failed.";
    return NextResponse.json({ configured: true, connected: false, error: message });
  }
}
