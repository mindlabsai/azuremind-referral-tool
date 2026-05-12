import { NextRequest, NextResponse } from "next/server";
import {
  clinikoUpdateCustomFields,
  clinikoUpdatePatient,
  isClinikoConfigured,
  type ClinikoCustomFieldKey,
} from "@/lib/cliniko";
import { buildClinikoSyncPayload, type ClinikoBaseline } from "@/lib/texlex-cliniko-sync";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!isClinikoConfigured()) {
    return NextResponse.json({ updatedCount: 0, skipped: true });
  }

  const body = (await req.json()) as {
    patientId?: string;
    baseline?: ClinikoBaseline;
    patientDetails?: Parameters<typeof buildClinikoSyncPayload>[0];
  };

  if (!body.patientId || !body.baseline || !body.patientDetails) {
    return NextResponse.json({ error: "Missing Cliniko sync payload." }, { status: 400 });
  }

  const { standardFields, customFields, changedCount } = buildClinikoSyncPayload(
    body.patientDetails,
    body.baseline
  );

  if (!changedCount) {
    return NextResponse.json({ updatedCount: 0 });
  }

  try {
    if (Object.keys(standardFields).length) {
      await clinikoUpdatePatient(body.patientId, standardFields);
    }
    if (Object.keys(customFields).length) {
      await clinikoUpdateCustomFields(body.patientId, customFields as Partial<Record<ClinikoCustomFieldKey, string>>);
    }
    return NextResponse.json({ updatedCount: changedCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cliniko sync failed.";
    return NextResponse.json({ error: message, updatedCount: 0 }, { status: 502 });
  }
}
