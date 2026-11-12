import { NextResponse } from "next/server";
import { clinikoListPatientAttachments, isClinikoConfigured } from "@/lib/cliniko";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!isClinikoConfigured()) {
    return NextResponse.json({ error: "Cliniko credentials not configured." }, { status: 503 });
  }

  const patientId = new URL(req.url).searchParams.get("patientId")?.trim();
  if (!patientId) {
    return NextResponse.json({ error: "Missing patientId" }, { status: 400 });
  }

  try {
    const attachments = await clinikoListPatientAttachments(patientId);
    return NextResponse.json({ attachments });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not list Cliniko attachments.";
    const status = message.includes("not found") ? 404 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
