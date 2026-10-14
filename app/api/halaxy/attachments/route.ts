import { NextResponse } from "next/server";
import { isHalaxyConfigured } from "@/lib/halaxy";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!isHalaxyConfigured()) {
    return NextResponse.json({ error: "Halaxy credentials not configured." }, { status: 503 });
  }
  const patientId = new URL(req.url).searchParams.get("patientId")?.trim();
  if (!patientId) return NextResponse.json({ error: "Missing patientId" }, { status: 400 });
  return NextResponse.json({
    attachments: [],
    note: "Halaxy does not list existing patient files through this connection. The finished PDF still saves as a Halaxy clinical note.",
  });
}
