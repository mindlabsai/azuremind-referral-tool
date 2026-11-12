import { NextResponse } from "next/server";
import { clinikoListScheduleAppointments, isClinikoConfigured } from "@/lib/cliniko";

export const runtime = "nodejs";

function isIsoDateTime(value: string): boolean {
  const t = Date.parse(value);
  return Number.isFinite(t);
}

export async function GET(req: Request) {
  if (!isClinikoConfigured()) {
    return NextResponse.json({ error: "Cliniko credentials not configured." }, { status: 503 });
  }

  const url = new URL(req.url);
  const fromIso = url.searchParams.get("from")?.trim() ?? "";
  const toIso = url.searchParams.get("to")?.trim() ?? "";
  const practitionerId = url.searchParams.get("practitionerId")?.trim() || null;

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
    const result = await clinikoListScheduleAppointments({
      fromIso,
      toIso,
      practitionerId,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load Cliniko schedule.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
