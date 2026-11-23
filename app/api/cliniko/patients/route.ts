import { NextResponse } from "next/server";
import {
  clinikoFindOrCreatePatient,
  clinikoUpdateCustomFields,
  isClinikoConfigured,
  splitParentName,
  type ClinikoCustomFieldKey,
} from "@/lib/cliniko";

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

/** Australian day-first, or an ISO date already stored by the report form. */
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
  if (!isClinikoConfigured()) {
    return NextResponse.json({ error: "Cliniko credentials not configured." }, { status: 503 });
  }

  let body: {
    clientName?: string;
    dateOfBirth?: string;
    email?: string;
    phone?: string;
    parent1?: string;
    parent2?: string;
    parent1Relationship?: string;
    parent2Relationship?: string;
    school?: string;
    yearLevel?: string;
    assessmentType?: string;
    referringPractitioner?: string;
    referringPractitionerType?: string;
    referringPractitionerEmail?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Could not read the patient details." }, { status: 400 });
  }

  const name = splitClientName(body.clientName ?? "");
  const dateOfBirth = isoDateOfBirth(body.dateOfBirth ?? "") ?? undefined;
  if (!name) {
    return NextResponse.json(
      { error: "Add the child's name, then save." },
      { status: 400 }
    );
  }

  try {
    const { patient, created } = await clinikoFindOrCreatePatient({
      firstName: name.firstName,
      lastName: name.lastName,
      dateOfBirth,
      email: body.email?.trim() ?? "",
      phone: body.phone?.trim() ?? "",
    });

    const parent1 = splitParentName(body.parent1 ?? "");
    const parent2 = splitParentName(body.parent2 ?? "");
    const custom: Partial<Record<ClinikoCustomFieldKey, string>> = {};
    const put = (key: ClinikoCustomFieldKey, value: string | undefined) => {
      const trimmed = value?.trim();
      if (trimmed) custom[key] = trimmed;
    };
    put("parent1FirstName", parent1.firstName);
    put("parent1LastName", parent1.lastName);
    put("parent1Relationship", body.parent1Relationship);
    put("parent2FirstName", parent2.firstName);
    put("parent2LastName", parent2.lastName);
    put("parent2Relationship", body.parent2Relationship);
    put("schoolName", body.school);
    put("yearLevel", body.yearLevel);
    put("assessmentType", body.assessmentType);
    put("referrerName", body.referringPractitioner);
    put("referrerType", body.referringPractitionerType);
    put("referrerEmail", body.referringPractitionerEmail);
    if (Object.keys(custom).length) {
      try {
        await clinikoUpdateCustomFields(patient.id, custom);
      } catch (error) {
        console.warn("[cliniko] patient file created; custom fields were not written", error);
      }
    }

    return NextResponse.json({
      success: true,
      created,
      patient: {
        id: patient.id,
        first_name: patient.first_name,
        last_name: patient.last_name,
        date_of_birth: patient.date_of_birth,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create the Cliniko patient file.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
