import { NextResponse } from "next/server";
import { halaxyFindOrCreatePatient, isHalaxyConfigured } from "@/lib/halaxy";

export const runtime = "nodejs";

const TITLE = /^(master|miss|mr|mrs|ms|dr)\.?$/i;

function splitClientName(fullName: string): { firstName: string; lastName: string } | null {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  while (parts.length && TITLE.test(parts[0]!)) parts.shift();
  if (!parts.length) return null;
  if (parts.length === 1) return { firstName: parts[0]!, lastName: parts[0]! };
  const lastName = parts.pop()!;
  return { firstName: parts.join(" "), lastName };
}

function isoDateOfBirth(raw: string): string | null {
  const text = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export async function POST(req: Request) {
  if (!isHalaxyConfigured()) {
    return NextResponse.json({ error: "Halaxy credentials not configured." }, { status: 503 });
  }
  let body: { clientName?: string; dateOfBirth?: string; email?: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Could not read the patient details." }, { status: 400 });
  }
  const name = splitClientName(body.clientName ?? "");
  if (!name) {
    return NextResponse.json({ error: "Add the child's name, then save." }, { status: 400 });
  }
  try {
    const { patient } = await halaxyFindOrCreatePatient({
      firstName: name.firstName,
      lastName: name.lastName,
      dateOfBirth: isoDateOfBirth(body.dateOfBirth ?? "") ?? undefined,
      email: body.email?.trim() ?? "",
      phone: body.phone?.trim() ?? "",
    });
    return NextResponse.json({ patient });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create the Halaxy patient.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
