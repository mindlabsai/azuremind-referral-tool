import { TEXLEX_SIGNATURE } from "@/app/asd-engine/report/constants/texlexBoilerplate";
import {
  computeChronologicalAge,
  formatAustralianPhone,
  formatIsoDate,
  placeholderForKind,
} from "@/app/asd-engine/report/pdf/utils";

export type SldCoverDetails = {
  clientName: string;
  dob: string;
  pronouns: string;
  yearLevel: string;
  school: string;
  reportDate: string;
  assessmentDate: string;
  parent1: string;
  parent1Relationship: string;
  parent2: string;
  parent2Relationship: string;
  referringPractitioner: string;
  phone: string;
  address: string;
  assessor: string;
};

export type CoverLine = { label: string; value: string };

function filled(value: string): string {
  return value.trim();
}

function parentLine(name: string, relationship: string): string {
  const person = filled(name);
  const relation = filled(relationship);
  if (!person) return "";
  return relation ? `${person} (${relation})` : person;
}

function dated(value: string): string {
  const raw = filled(value);
  if (!raw) return "";
  const formatted = formatIsoDate(raw, "notProvided");
  if (formatted === placeholderForKind("notProvided")) return "";
  return formatted;
}

export function sldCoverColumns(details: SldCoverDetails): {
  client: CoverLine[];
  assessor: CoverLine[];
  meta: CoverLine[];
} {
  const client: CoverLine[] = [];
  const name = filled(details.clientName);
  if (name) client.push({ label: "Client", value: name });

  const dob = filled(details.dob);
  if (dob) {
    const date = dated(dob);
    const age = computeChronologicalAge(dob);
    const ageText = age === placeholderForKind("notProvided") ? "" : age;
    const value = [date, ageText].filter(Boolean).join("  ·  ");
    if (value) client.push({ label: "Date of birth", value });
  }

  const parents = [parentLine(details.parent1, details.parent1Relationship), parentLine(details.parent2, details.parent2Relationship)]
    .filter(Boolean)
    .join("\n");
  if (parents) client.push({ label: "Parents", value: parents });

  const address = filled(details.address);
  if (address) client.push({ label: "Address", value: address });

  const phone = filled(details.phone);
  if (phone) client.push({ label: "Phone", value: formatAustralianPhone(phone) ?? phone });

  const assessor: CoverLine[] = [];
  const assessorName = filled(details.assessor);
  if (assessorName) {
    assessor.push({ label: "Assessor", value: assessorName });
    assessor.push({
      label: "Registration",
      value: `${TEXLEX_SIGNATURE.title} · ${TEXLEX_SIGNATURE.registration}`,
    });
    assessor.push({ label: "Practice", value: TEXLEX_SIGNATURE.practice });
  }
  const assessmentDate = dated(details.assessmentDate);
  if (assessmentDate) assessor.push({ label: "Date of assessment", value: assessmentDate });
  const reportDate = dated(details.reportDate);
  if (reportDate) assessor.push({ label: "Date of report", value: reportDate });

  const meta: CoverLine[] = [];
  const referrer = filled(details.referringPractitioner);
  if (referrer) meta.push({ label: "Referring practitioner", value: referrer });
  const school = filled(details.school);
  if (school) meta.push({ label: "School", value: school });
  const yearLevel = filled(details.yearLevel);
  if (yearLevel) meta.push({ label: "Year level", value: yearLevel });
  const pronouns = filled(details.pronouns);
  if (pronouns) meta.push({ label: "Pronouns", value: pronouns });

  return { client, assessor, meta };
}
