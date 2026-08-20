import type { ClinikoPatientFormDetail } from "@/lib/cliniko";
import type { TexlexPatientDetailsForCliniko } from "@/lib/texlex-cliniko-sync";

export type RegistrationFormKind = "autism" | "adhd" | "other";

export type RegistrationDemographics = Partial<TexlexPatientDetailsForCliniko> & {
  formName?: string;
  formKind?: RegistrationFormKind;
};

function normalizeQuestionKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function answerMap(form: ClinikoPatientFormDetail): Map<string, string> {
  const map = new Map<string, string>();
  for (const question of form.questions) {
    const key = normalizeQuestionKey(question.name);
    if (!key) continue;
    const text = (question.answer ?? "").trim();
    if (text) {
      map.set(key, text);
      continue;
    }
    if (question.selectedAnswers.length) {
      map.set(key, question.selectedAnswers.join(", "));
    }
  }
  return map;
}

function getAnswer(map: Map<string, string>, ...aliases: string[]): string {
  for (const alias of aliases) {
    const value = map.get(normalizeQuestionKey(alias));
    if (value?.trim()) return value.trim();
  }
  // Fuzzy contains match for minor typo variants (e.g. "Given Maes").
  for (const alias of aliases) {
    const needle = normalizeQuestionKey(alias);
    for (const [key, value] of map.entries()) {
      if (key.includes(needle) || needle.includes(key)) {
        if (value.trim()) return value.trim();
      }
    }
  }
  return "";
}

/** Parse common AU form dates (DD-MM-YYYY / DD/MM/YYYY) into YYYY-MM-DD. */
export function parseRegistrationDobToIso(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (!m) return "";
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (!day || !month || month > 12 || day > 31) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function classifyRegistrationForm(name: string): RegistrationFormKind {
  const lower = name.toLowerCase();
  if (lower.includes("autism")) return "autism";
  if (lower.includes("adhd")) return "adhd";
  return "other";
}

export function extractDemographicsFromRegistrationForm(
  form: ClinikoPatientFormDetail
): RegistrationDemographics {
  const map = answerMap(form);
  const given = getAnswer(map, "Given Names", "Given Maes", "Given Name", "First Name");
  const surname = getAnswer(map, "Surname", "Last Name", "Family Name");
  const title = getAnswer(map, "Title");
  const clientName = [title && /^(master|miss|mr|mrs|ms|dr)\.?$/i.test(title) ? title : "", given, surname]
    .filter(Boolean)
    .join(" ")
    .trim();

  const street = getAnswer(map, "Address");
  const suburb = getAnswer(
    map,
    "Suburb and Postcode",
    "Suburb and Post Code",
    "Suburb / Postcode",
    "Suburb"
  );
  const address = [street, suburb].filter(Boolean).join(", ");

  const phone = getAnswer(map, "Phone Number", "Phone number", "Mobile", "Contact number");
  const dobRaw = getAnswer(map, "Date of Birth", "DOB");
  const referringPractitioner = getAnswer(
    map,
    "Referring Doctors Name",
    "Referring Doctor's Name",
    "Referring Doctor",
    "Referring GP"
  );
  const referringClinic = getAnswer(map, "Referring GP clinic", "Referring Clinic");
  const parent1 =
    getAnswer(map, "Contact name", "Claimant Name (If under 16)", "Claimant Name") || "";
  const parent1Relationship = getAnswer(
    map,
    "Their relationship to you",
    "Relationship",
    "Parent relationship"
  );
  const parentPhone = getAnswer(map, "Their contact number");

  const kind = classifyRegistrationForm(form.name);
  const assessmentType =
    kind === "autism" ? "ASD" : kind === "adhd" ? "ADHD" : "";

  return {
    formName: form.name,
    formKind: kind,
    clientName,
    dob: parseRegistrationDobToIso(dobRaw) || dobRaw,
    address,
    phone: phone || parentPhone,
    referringPractitioner: referringPractitioner || referringClinic,
    referringPractitionerType: referringPractitioner || referringClinic ? "GP" : "",
    assessmentType,
    parent1,
    parent1Relationship,
  };
}

function prefer(
  existing: string | undefined,
  incoming: string | undefined,
  mode: "incoming-wins" | "keep-existing" = "incoming-wins"
): string {
  const prev = (existing ?? "").trim();
  const next = (incoming ?? "").trim();
  if (mode === "keep-existing") return prev || next;
  return next || prev;
}

export function registrationFormHasAnswers(form: ClinikoPatientFormDetail): boolean {
  return form.questions.some((question) => (question.answer ?? "").trim().length > 0);
}

export function registrationDemographicsHasContent(
  registration: RegistrationDemographics | null | undefined
): boolean {
  if (!registration) return false;
  return Boolean(
    registration.clientName?.trim() ||
      registration.dob?.trim() ||
      registration.address?.trim() ||
      registration.phone?.trim() ||
      registration.referringPractitioner?.trim() ||
      registration.parent1?.trim()
  );
}

function rankRegistrationForms(
  forms: ClinikoPatientFormDetail[],
  engine: "asd" | "adhd" | null = null
): ClinikoPatientFormDetail[] {
  return [...forms].sort((a, b) => {
    const aHas = registrationFormHasAnswers(a) ? 0 : 1;
    const bHas = registrationFormHasAnswers(b) ? 0 : 1;
    if (aHas !== bHas) return aHas - bHas;

    const aCompleted = a.completedAt ? 0 : 1;
    const bCompleted = b.completedAt ? 0 : 1;
    if (aCompleted !== bCompleted) return aCompleted - bCompleted;

    const aKind = classifyRegistrationForm(a.name);
    const bKind = classifyRegistrationForm(b.name);
    const score = (kind: RegistrationFormKind) => {
      if (engine === "asd" && kind === "autism") return 0;
      if (engine === "adhd" && kind === "adhd") return 0;
      if (kind === "autism" || kind === "adhd") return 1;
      return 2;
    };
    const byKind = score(aKind) - score(bKind);
    if (byKind !== 0) return byKind;

    const aTime = a.completedAt
      ? Date.parse(a.completedAt)
      : a.updatedAt
        ? Date.parse(a.updatedAt)
        : 0;
    const bTime = b.completedAt
      ? Date.parse(b.completedAt)
      : b.updatedAt
        ? Date.parse(b.updatedAt)
        : 0;
    return bTime - aTime;
  });
}

export function pickPreferredRegistrationForm(
  forms: ClinikoPatientFormDetail[],
  engine: "asd" | "adhd" | null = null
): ClinikoPatientFormDetail | null {
  if (!forms.length) return null;
  const ranked = rankRegistrationForms(forms, engine);
  const withAnswers = ranked.find(registrationFormHasAnswers);
  return withAnswers ?? ranked[0] ?? null;
}

/**
 * Merge Cliniko patient details with all answered Autism/ADHD registration forms.
 * Answered forms beat blank re-issues; first matched form wins field conflicts, later forms only fill gaps.
 *
 * Identity (client name + DOB) always stays with the Cliniko patient record when present.
 * Registration forms often contain parent/claimant names in “Given Names” (e.g. Jessie Little
 * on Emma Pate’s autism registration) — those must not rename the patient.
 */
export function mergeRegistrationFormsIntoPatientDetails(
  base: TexlexPatientDetailsForCliniko,
  forms: ClinikoPatientFormDetail[],
  engine: "asd" | "adhd" | null = null
): { details: TexlexPatientDetailsForCliniko; registration: RegistrationDemographics | null } {
  const ranked = rankRegistrationForms(forms, engine);
  const patientClientName = (base.clientName ?? "").trim();
  const patientDob = (base.dob ?? "").trim();
  let merged = base;
  let primary: RegistrationDemographics | null = null;
  let appliedAnswered = false;

  for (const form of ranked) {
    if (!registrationFormHasAnswers(form)) continue;
    const extracted = extractDemographicsFromRegistrationForm(form);
    if (!registrationDemographicsHasContent(extracted)) continue;
    if (!primary) primary = extracted;
    merged = mergeRegistrationIntoPatientDetails(
      merged,
      extracted,
      appliedAnswered ? "keep-existing" : "incoming-wins"
    );
    appliedAnswered = true;
  }

  if (patientClientName || patientDob) {
    merged = {
      ...merged,
      ...(patientClientName ? { clientName: patientClientName } : {}),
      ...(patientDob ? { dob: patientDob } : {}),
    };
  }

  return { details: merged, registration: primary };
}

export function mergeRegistrationIntoPatientDetails(
  base: TexlexPatientDetailsForCliniko,
  registration: RegistrationDemographics | null | undefined,
  mode: "incoming-wins" | "keep-existing" = "incoming-wins"
): TexlexPatientDetailsForCliniko {
  if (!registration) return base;
  return {
    ...base,
    clientName: prefer(base.clientName, registration.clientName, mode),
    dob: prefer(base.dob, registration.dob, mode),
    address: prefer(base.address, registration.address, mode),
    phone: prefer(base.phone, registration.phone, mode),
    referringPractitioner: prefer(
      base.referringPractitioner,
      registration.referringPractitioner,
      mode
    ),
    referringPractitionerType: prefer(
      base.referringPractitionerType,
      registration.referringPractitionerType,
      mode
    ),
    referringPractitionerEmail: prefer(
      base.referringPractitionerEmail,
      registration.referringPractitionerEmail,
      mode
    ),
    assessmentType: prefer(base.assessmentType, registration.assessmentType, mode),
    parent1: prefer(base.parent1, registration.parent1, mode),
    parent1Relationship: prefer(base.parent1Relationship, registration.parent1Relationship, mode),
    parent2: prefer(base.parent2, registration.parent2, mode),
    parent2Relationship: prefer(base.parent2Relationship, registration.parent2Relationship, mode),
    school: prefer(base.school, registration.school, mode),
    yearLevel: prefer(base.yearLevel, registration.yearLevel, mode),
  };
}

/** Local calendar day YYYY-MM-DD from an appointment ISO timestamp. */
export function appointmentStartsAtToDateSeen(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
