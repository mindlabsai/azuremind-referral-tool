import { NextResponse } from "next/server";
import {
  clinikoGetCustomFieldDefinitions,
  clinikoGetPatient,
  clinikoGetPatientCustomFields,
  isClinikoConfigured,
} from "@/lib/cliniko";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, context: RouteContext) {
  if (!isClinikoConfigured()) {
    return NextResponse.json({ error: "Cliniko credentials not configured." }, { status: 503 });
  }

  const { id } = await context.params;
  try {
    const [patient, customFields, definitions] = await Promise.all([
      clinikoGetPatient(id),
      clinikoGetPatientCustomFields(id),
      clinikoGetCustomFieldDefinitions(),
    ]);
    return NextResponse.json({ patient, customFields, definitions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load Cliniko patient.";
    const status = message.includes("not found") ? 404 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
