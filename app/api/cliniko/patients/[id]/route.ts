import { NextResponse } from "next/server";
import {
  clinikoGetCustomFieldDefinitions,
  clinikoGetPatient,
  clinikoGetPatientCustomFields,
  clinikoGetRegistrationFormsForPatient,
  isClinikoConfigured,
} from "@/lib/cliniko";
import {
  extractDemographicsFromRegistrationForm,
  mergeRegistrationFormsIntoPatientDetails,
  pickPreferredRegistrationForm,
} from "@/lib/cliniko-registration-forms";
import { applyClinikoPatientToForm } from "@/lib/texlex-cliniko-sync";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(req: Request, context: RouteContext) {
  if (!isClinikoConfigured()) {
    return NextResponse.json({ error: "Cliniko credentials not configured." }, { status: 503 });
  }

  const { id } = await context.params;
  const engineParam = new URL(req.url).searchParams.get("engine");
  const engine = engineParam === "asd" || engineParam === "adhd" ? engineParam : null;

  try {
    const [patient, customFields, definitions, registrationForms] = await Promise.all([
      clinikoGetPatient(id),
      clinikoGetPatientCustomFields(id),
      clinikoGetCustomFieldDefinitions(),
      clinikoGetRegistrationFormsForPatient(id).catch((error) => {
        console.warn("[cliniko] registration forms fetch failed", error);
        return [];
      }),
    ]);

    const fromPatient = applyClinikoPatientToForm(patient, customFields);
    const { details: mergedDetails, registration } = mergeRegistrationFormsIntoPatientDetails(
      fromPatient,
      registrationForms,
      engine
    );
    const preferred = pickPreferredRegistrationForm(registrationForms, engine);
    const preferredExtracted = preferred
      ? extractDemographicsFromRegistrationForm(preferred)
      : null;

    return NextResponse.json({
      patient,
      customFields,
      definitions,
      registrationForms: registrationForms.map((form) => ({
        id: form.id,
        name: form.name,
        updatedAt: form.updatedAt,
        completedAt: form.completedAt,
        hasAnswers: form.questions.some((q) => (q.answer ?? "").trim().length > 0),
      })),
      /** Preferred form extract (answered form when available). */
      registration: registration ?? preferredExtracted,
      /** Demographics already merged: Cliniko patient + answered registration form(s). */
      mergedDetails,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load Cliniko patient.";
    const status = message.includes("not found") ? 404 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
