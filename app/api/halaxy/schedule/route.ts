import { NextResponse } from "next/server";
import { halaxyListScheduleAppointments, isHalaxyConfigured } from "@/lib/halaxy";

export const runtime = "nodejs";

function isIsoDateTime(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

export async function GET(req: Request) {
  if (!isHalaxyConfigured()) {
    return NextResponse.json({ error: "Halaxy credentials not configured." }, { status: 503 });
  }

  const url = new URL(req.url);
  const fromIso = url.searchParams.get("from")?.trim() ?? "";
  const toIso = url.searchParams.get("to")?.trim() ?? "";
  const requestedPractitioner = url.searchParams.get("practitionerId")?.trim() || null;
  const practitionerId = requestedPractitioner?.startsWith("PR-") ? requestedPractitioner : null;

  if (!fromIso || !toIso || !isIsoDateTime(fromIso) || !isIsoDateTime(toIso)) {
    return NextResponse.json(
      { error: "Query params from and to (ISO date-times) are required." },
      { status: 400 }
    );
  }
  if (Date.parse(toIso) <= Date.parse(fromIso)) {
    return NextResponse.json({ error: "to must be after from." }, { status: 400 });
  }

  try {
    const result = await halaxyListScheduleAppointments({ fromIso, toIso, practitionerId });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load the Halaxy schedule.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
