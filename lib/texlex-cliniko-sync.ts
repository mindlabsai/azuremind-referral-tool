import {
  type ClinikoCustomFieldKey,
  type ClinikoPatientFull,
  formatClinikoAddress,
  splitParentName,
} from "@/lib/cliniko";

export type TexlexPatientDetailsForCliniko = {
  clientName: string;
  parent1: string;
  parent2: string;
  parent1Relationship: string;
  parent2Relationship: string;
  dob: string;
  referringPractitioner: string;
  referringPractitionerType: string;
  referringPractitionerEmail: string;
  assessmentType: string;
  school: string;
  yearLevel: string;
  phone: string;
  address: string;
};

export type ClinikoBaseline = {
  standard: {
    clientName: string;
    dob: string;
    phone: string;
    address: string;
  };
  custom: Partial<Record<ClinikoCustomFieldKey, string>>;
};

export type ClinikoDraftState = {
  patientId: string;
  connectedName: string;
  syncEnabled: boolean;
  baseline: ClinikoBaseline;
};

export function emptyClinikoDraftState(): ClinikoDraftState | null {
  return null;
}

export function buildClientNameFromCliniko(patient: ClinikoPatientFull): string {
  const title = patient.title?.trim();
  const first = patient.first_name.trim();
  const last = patient.last_name.trim();
  const base = [first, last].filter(Boolean).join(" ");
  if (!title) return base;
  if (/^(master|miss|mr|mrs|ms|dr)\.?$/i.test(title)) {
    return [title, base].filter(Boolean).join(" ");
  }
  return base || title;
}

export function applyClinikoPatientToForm(
  patient: ClinikoPatientFull,
  customFields: Partial<Record<ClinikoCustomFieldKey, string>>
): TexlexPatientDetailsForCliniko {
  const parent1Name = [customFields.parent1FirstName, customFields.parent1LastName].filter(Boolean).join(" ").trim();
  const parent2Name = [customFields.parent2FirstName, customFields.parent2LastName].filter(Boolean).join(" ").trim();
  const address = formatClinikoAddress(patient.addresses[0] ?? { line1: "", line2: "", line3: "", city: "", state: "", post_code: "" });

  return {
    clientName: buildClientNameFromCliniko(patient),
    parent1: parent1Name,
    parent2: parent2Name,
    parent1Relationship: customFields.parent1Relationship ?? "",
    parent2Relationship: customFields.parent2Relationship ?? "",
    dob: patient.date_of_birth ?? "",
    referringPractitioner: customFields.referrerName ?? "",
    referringPractitionerType: customFields.referrerType ?? "",
    referringPractitionerEmail: customFields.referrerEmail ?? "",
    assessmentType: customFields.assessmentType ?? "",
    school: customFields.schoolName ?? "",
    yearLevel: customFields.yearLevel ?? "",
    phone: patient.phone_numbers[0]?.number ?? "",
    address,
  };
}

export function buildClinikoBaseline(
  patient: ClinikoPatientFull,
  customFields: Partial<Record<ClinikoCustomFieldKey, string>>,
  patientDetails: TexlexPatientDetailsForCliniko
): ClinikoBaseline {
  return {
    standard: {
      clientName: buildClientNameFromCliniko(patient),
      dob: patient.date_of_birth ?? "",
      phone: patient.phone_numbers[0]?.number ?? "",
      address: formatClinikoAddress(
        patient.addresses[0] ?? { line1: "", line2: "", line3: "", city: "", state: "", post_code: "" }
      ),
    },
    custom: {
      parent1FirstName: customFields.parent1FirstName ?? "",
      parent1LastName: customFields.parent1LastName ?? "",
      parent1Relationship: customFields.parent1Relationship ?? patientDetails.parent1Relationship,
      parent2FirstName: customFields.parent2FirstName ?? "",
      parent2LastName: customFields.parent2LastName ?? "",
      parent2Relationship: customFields.parent2Relationship ?? patientDetails.parent2Relationship,
      schoolName: customFields.schoolName ?? patientDetails.school,
      yearLevel: customFields.yearLevel ?? patientDetails.yearLevel,
      referrerName: customFields.referrerName ?? patientDetails.referringPractitioner,
      referrerType: customFields.referrerType ?? patientDetails.referringPractitionerType,
      referrerEmail: customFields.referrerEmail ?? patientDetails.referringPractitionerEmail,
      assessmentType: customFields.assessmentType ?? patientDetails.assessmentType,
    },
  };
}

export function buildClinikoSyncPayload(
  patientDetails: TexlexPatientDetailsForCliniko,
  baseline: ClinikoBaseline
): {
  standardFields: Record<string, string>;
  customFields: Partial<Record<ClinikoCustomFieldKey, string>>;
  changedCount: number;
} {
  const standardFields: Record<string, string> = {};
  let changedCount = 0;

  if (patientDetails.clientName.trim() && patientDetails.clientName.trim() !== baseline.standard.clientName.trim()) {
    changedCount += 1;
  }
  if (patientDetails.dob.trim() && patientDetails.dob.trim() !== baseline.standard.dob.trim()) {
    standardFields.date_of_birth = patientDetails.dob.trim();
    changedCount += 1;
  }
  if (patientDetails.phone.trim() && patientDetails.phone.trim() !== baseline.standard.phone.trim()) {
    standardFields.phone = patientDetails.phone.trim();
    changedCount += 1;
  }
  if (patientDetails.address.trim() && patientDetails.address.trim() !== baseline.standard.address.trim()) {
    standardFields.address_1 = patientDetails.address.trim();
    changedCount += 1;
  }

  const parent1 = splitParentName(patientDetails.parent1);
  const parent2 = splitParentName(patientDetails.parent2);
  const customFields: Partial<Record<ClinikoCustomFieldKey, string>> = {};
  const customPairs: Array<[ClinikoCustomFieldKey, string]> = [
    ["parent1FirstName", parent1.firstName],
    ["parent1LastName", parent1.lastName],
    ["parent1Relationship", patientDetails.parent1Relationship],
    ["parent2FirstName", parent2.firstName],
    ["parent2LastName", parent2.lastName],
    ["parent2Relationship", patientDetails.parent2Relationship],
    ["schoolName", patientDetails.school],
    ["yearLevel", patientDetails.yearLevel],
    ["referrerName", patientDetails.referringPractitioner],
    ["referrerType", patientDetails.referringPractitionerType],
    ["referrerEmail", patientDetails.referringPractitionerEmail],
    ["assessmentType", patientDetails.assessmentType],
  ];

  for (const [key, value] of customPairs) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const previous = (baseline.custom[key] ?? "").trim();
    if (trimmed !== previous) {
      customFields[key] = trimmed;
      changedCount += 1;
    }
  }

  return { standardFields, customFields, changedCount };
}
