import { NextResponse } from "next/server";
import { halaxyListPatientFiles, isHalaxyConfigured } from "@/lib/halaxy";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!isHalaxyConfigured()) {
    return NextResponse.json({ error: "Halaxy credentials not configured." }, { status: 503 });
  }
  const patientId = new URL(req.url).searchParams.get("patientId")?.trim();
  if (!patientId) return NextResponse.json({ error: "Missing patientId" }, { status: 400 });
  try {
    const attachments = await halaxyListPatientFiles(patientId);
    return NextResponse.json({ attachments });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not list Halaxy files.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
