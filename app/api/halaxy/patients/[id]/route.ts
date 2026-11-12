import { NextResponse } from "next/server";
import { halaxyGetPatient, isHalaxyConfigured } from "@/lib/halaxy";
import { applyClinikoPatientToForm } from "@/lib/texlex-cliniko-sync";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  if (!isHalaxyConfigured()) {
    return NextResponse.json({ error: "Halaxy credentials not configured." }, { status: 503 });
  }
  const { id } = await context.params;
  try {
    const { patient, customFields } = await halaxyGetPatient(id);
    const mergedDetails = applyClinikoPatientToForm(patient, customFields);
    return NextResponse.json({
      patient,
      customFields,
      definitions: [],
      registrationForms: [],
      registration: null,
      mergedDetails,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load the Halaxy patient.";
    const status = message.includes("not found") ? 404 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
