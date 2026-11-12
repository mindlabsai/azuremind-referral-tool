import { NextResponse } from "next/server";
import { clinikoGetPatientAppointments, isClinikoConfigured } from "@/lib/cliniko";

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
    const { appointments, hasUpcomingBooking } = await clinikoGetPatientAppointments(patientId);
    return NextResponse.json({ appointments, hasUpcomingBooking });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load Cliniko appointments.";
    const status = message.includes("not found") ? 404 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
