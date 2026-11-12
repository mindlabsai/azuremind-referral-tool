import type {
  ClinikoCustomFieldKey,
  ClinikoPatient,
  ClinikoPatientAppointment,
  ClinikoPatientFull,
  ClinikoPractitioner,
} from "@/lib/cliniko";

const HALAXY_BASE = "https://au-api.halaxy.com/main";
const USER_AGENT = "Texlex (admin@azuremind.com.au)";

type TokenCache = { token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

type FhirRef = { reference?: string; type?: string; display?: string };
type FhirHumanName = {
  use?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
};
type FhirCoding = { system?: string; code?: string; display?: string };
type FhirExtension = {
  url?: string;
  valueString?: string;
  valueCoding?: FhirCoding;
};
type FhirParticipant = {
  actor?: FhirRef;
  modifierExtension?: FhirExtension[];
};
type FhirPatient = {
  resourceType?: string;
  id?: string;
  name?: FhirHumanName[];
  birthDate?: string;
  gender?: string;
  telecom?: Array<{ system?: string; value?: string }>;
  address?: Array<{
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
  }>;
  contact?: Array<{
    relationship?: Array<{ coding?: FhirCoding[]; text?: string }>;
    name?: FhirHumanName;
    telecom?: Array<{ system?: string; value?: string }>;
  }>;
};
type FhirAppointment = {
  resourceType?: string;
  id?: string;
  start?: string;
  end?: string;
  description?: string | null;
  comment?: string | null;
  cancellationReason?: unknown;
  participant?: FhirParticipant[];
};
type FhirPractitionerRole = {
  resourceType?: string;
  id?: string;
  practitioner?: FhirRef;
};
type FhirResource = FhirPatient & FhirAppointment & FhirPractitionerRole;
type FhirBundle = {
  resourceType?: string;
  total?: number;
  entry?: Array<{ resource?: FhirResource; search?: { mode?: string } }>;
  issue?: Array<{ diagnostics?: string; details?: { text?: string } }>;
  link?: Array<{ relation?: string }>;
};

export function isHalaxyConfigured(): boolean {
  return Boolean(process.env.HALAXY_CLIENT_ID?.trim() && process.env.HALAXY_CLIENT_SECRET?.trim());
}

function refId(reference: string | undefined): string | null {
  if (!reference) return null;
  const id = reference.split("/").filter(Boolean).pop()?.trim();
  return id || null;
}

function issueMessage(body: FhirBundle | null, status: number): string {
  const issue = body?.issue?.[0];
  const text = issue?.diagnostics || issue?.details?.text;
  return text ? `Halaxy: ${text}` : `Halaxy request failed (${status}).`;
}

async function accessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;
  const clientId = process.env.HALAXY_CLIENT_ID?.trim();
  const clientSecret = process.env.HALAXY_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Halaxy credentials not configured.");
  }
  const response = await fetch(`${HALAXY_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      Accept: "application/fhir+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const body = (await response.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  } | null;
  if (!response.ok || !body?.access_token) {
    throw new Error(body?.error || `Halaxy login failed (${response.status}).`);
  }
  const expiresIn = Number(body.expires_in);
  tokenCache = {
    token: body.access_token,
    expiresAt: Date.now() + (Number.isFinite(expiresIn) ? expiresIn : 900) * 1000,
  };
  return body.access_token;
}

async function halaxyFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/fhir+json");
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("User-Agent", USER_AGENT);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/fhir+json");
  }
  return fetch(`${HALAXY_BASE}${path}`, { ...init, headers });
}

async function readBundle(response: Response): Promise<FhirBundle> {
  const body = (await response.json().catch(() => null)) as FhirBundle | null;
  if (!response.ok) throw new Error(issueMessage(body, response.status));
  return body ?? {};
}

function officialName(names: FhirHumanName[] | undefined): FhirHumanName | undefined {
  return names?.find((name) => name.use === "official") ?? names?.[0];
}

function splitName(name: FhirHumanName | undefined): { first: string; last: string; title: string | null } {
  return {
    first: (name?.given ?? []).map((part) => part.trim()).filter(Boolean).join(" "),
    last: name?.family?.trim() ?? "",
    title: name?.prefix?.find((part) => part.trim())?.trim() ?? null,
  };
}

function telecomValue(
  telecom: Array<{ system?: string; value?: string }> | undefined,
  systems: string[]
): string | null {
  const hit = telecom?.find((item) => systems.includes(item.system ?? "") && item.value?.trim());
  return hit?.value?.trim() ?? null;
}

function mapPatientSummary(patient: FhirPatient): ClinikoPatient {
  const name = splitName(officialName(patient.name));
  return {
    id: String(patient.id ?? ""),
    first_name: name.first,
    last_name: name.last,
    date_of_birth: patient.birthDate ?? null,
  };
}

function mapPatientFull(patient: FhirPatient): ClinikoPatientFull {
  const name = splitName(officialName(patient.name));
  const address = patient.address?.[0];
  const phone = telecomValue(patient.telecom, ["phone", "sms"]);
  return {
    id: String(patient.id ?? ""),
    first_name: name.first,
    last_name: name.last,
    date_of_birth: patient.birthDate ?? null,
    sex: patient.gender ?? null,
    title: name.title,
    email: telecomValue(patient.telecom, ["email"]),
    phone_numbers: phone ? [{ number: phone, phone_type: "Mobile" }] : [],
    addresses: address
      ? [
          {
            line1: (address.line ?? []).join(", "),
            line2: "",
            line3: "",
            city: address.city ?? "",
            state: address.state ?? "",
            post_code: address.postalCode ?? "",
          },
        ]
      : [],
  };
}

function contactFields(patient: FhirPatient): Partial<Record<ClinikoCustomFieldKey, string>> {
  const fields: Partial<Record<ClinikoCustomFieldKey, string>> = {};
  const contacts = patient.contact ?? [];
  const slots = [
    ["parent1FirstName", "parent1LastName", "parent1Relationship"],
    ["parent2FirstName", "parent2LastName", "parent2Relationship"],
  ] as const;
  contacts.slice(0, 2).forEach((contact, index) => {
    const name = splitName(contact.name);
    const slot = slots[index];
    if (!slot) return;
    fields[slot[0]] = name.first;
    fields[slot[1]] = name.last;
    const coding = contact.relationship?.[0]?.coding?.[0];
    fields[slot[2]] = coding?.display?.trim() || contact.relationship?.[0]?.text?.trim() || "";
  });
  return fields;
}

function participantStatus(participant: FhirParticipant | undefined): string | null {
  const coding = participant?.modifierExtension?.find((item) => item.valueCoding?.code)?.valueCoding;
  return coding?.code?.trim().toLowerCase() ?? null;
}

function isCancelledStatus(status: string | null, appointment: FhirAppointment): boolean {
  if (appointment.cancellationReason) return true;
  if (!status) return false;
  return status.startsWith("cancelled") || status === "declined" || status === "rejected";
}

function patientParticipant(appointment: FhirAppointment): FhirParticipant | undefined {
  return appointment.participant?.find((item) => item.actor?.type === "Patient" || refId(item.actor?.reference)?.match(/^\d/));
}

function roleIdOf(appointment: FhirAppointment): string | null {
  const role = appointment.participant?.find((item) => item.actor?.type === "PractitionerRole");
  return refId(role?.actor?.reference);
}

async function searchBundle(path: string): Promise<FhirResource[]> {
  const resources: FhirResource[] = [];
  for (let page = 1; page <= 6; page += 1) {
    const joiner = path.includes("?") ? "&" : "?";
    const response = await halaxyFetch(`${path}${joiner}page=${page}&_count=100`);
    const bundle = await readBundle(response);
    const batch = (bundle.entry ?? []).map((entry) => entry.resource).filter(Boolean) as FhirResource[];
    resources.push(...batch);
    const matches = batch.filter((item) => item.resourceType === "Appointment" || !path.startsWith("/Appointment"));
    if (batch.length < 100 || matches.length === 0) break;
    if ((bundle.total ?? 0) <= page * 100) break;
  }
  return resources;
}

export async function halaxySearchPatients(query: string): Promise<ClinikoPatient[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const response = await halaxyFetch(`/Patient?name=${encodeURIComponent(trimmed)}&_count=20`);
  const bundle = await readBundle(response);
  return (bundle.entry ?? [])
    .map((entry) => entry.resource)
    .filter((resource): resource is FhirPatient => resource?.resourceType === "Patient" && Boolean(resource.id))
    .map(mapPatientSummary);
}

export async function halaxyGetPatient(id: string): Promise<{
  patient: ClinikoPatientFull;
  customFields: Partial<Record<ClinikoCustomFieldKey, string>>;
}> {
  const response = await halaxyFetch(`/Patient/${encodeURIComponent(id)}`);
  const body = (await response.json().catch(() => null)) as FhirPatient | null;
  if (response.status === 404) throw new Error("Halaxy patient not found.");
  if (!response.ok || !body?.id) throw new Error(issueMessage(body as FhirBundle, response.status));
  return { patient: mapPatientFull(body), customFields: contactFields(body) };
}

function mapAppointment(
  appointment: FhirAppointment,
  patients: Map<string, ClinikoPatient>
): ClinikoPatientAppointment | null {
  const patientRef = appointment.participant?.find((item) => item.actor?.type === "Patient");
  const patientId = refId(patientRef?.actor?.reference);
  if (!patientId) return null;
  const status = participantStatus(patientRef);
  const cancelled = isCancelledStatus(status, appointment);
  const known = patients.get(patientId);
  const patientName = known
    ? [known.first_name, known.last_name].filter(Boolean).join(" ")
    : patientRef?.actor?.display?.trim() || null;
  return {
    id: String(appointment.id ?? ""),
    starts_at: appointment.start ?? null,
    ends_at: appointment.end ?? null,
    cancelled_at: cancelled ? appointment.start ?? new Date().toISOString() : null,
    archived_at: null,
    notes: appointment.description || appointment.comment || null,
    patient_name: patientName,
    patient_id: patientId,
    appointment_type_id: null,
  };
}

export async function halaxyListScheduleAppointments(options: {
  fromIso: string;
  toIso: string;
  practitionerId?: string | null;
}): Promise<{
  appointments: ClinikoPatientAppointment[];
  practitionerId: string | null;
  practitioners: ClinikoPractitioner[];
}> {
  const params = new URLSearchParams();
  params.append("date", `ge${options.fromIso}`);
  params.append("date", `lt${options.toIso}`);
  params.set("_sort", "date");
  params.append("_include", "Appointment:patient");
  params.append("_include", "Appointment:practitioner-role");
  if (options.practitionerId?.trim()) {
    params.set("practitioner-role", options.practitionerId.trim());
  }
  const resources = await searchBundle(`/Appointment?${params.toString()}`);
  const patients = new Map<string, ClinikoPatient>();
  for (const resource of resources) {
    if (resource.resourceType === "Patient" && resource.id) {
      patients.set(String(resource.id), mapPatientSummary(resource));
    }
  }
  const appointments = resources
    .filter((resource): resource is FhirAppointment => resource.resourceType === "Appointment")
    .map((appointment) => mapAppointment(appointment, patients))
    .filter((appointment): appointment is ClinikoPatientAppointment => Boolean(appointment))
    .filter((appointment) => !appointment.cancelled_at);
  return { appointments, practitionerId: options.practitionerId?.trim() || null, practitioners: [] };
}

export async function halaxyGetPatientAppointments(
  patientId: string
): Promise<{ appointments: ClinikoPatientAppointment[]; hasUpcomingBooking: boolean }> {
  const params = new URLSearchParams();
  params.set("patient", patientId);
  params.set("_sort", "-date");
  params.append("_include", "Appointment:patient");
  const resources = await searchBundle(`/Appointment?${params.toString()}`);
  const patients = new Map<string, ClinikoPatient>();
  const self = resources.find((resource) => resource.resourceType === "Patient" && resource.id);
  if (self?.id) patients.set(String(self.id), mapPatientSummary(self));
  const appointments = resources
    .filter((resource): resource is FhirAppointment => resource.resourceType === "Appointment")
    .map((appointment) => mapAppointment(appointment, patients))
    .filter((appointment): appointment is ClinikoPatientAppointment => Boolean(appointment));
  const now = Date.now();
  const hasUpcomingBooking = appointments.some((appointment) => {
    if (!appointment.starts_at || appointment.cancelled_at) return false;
    const starts = new Date(appointment.starts_at).getTime();
    return Number.isFinite(starts) && starts > now;
  });
  return { appointments, hasUpcomingBooking };
}

function perthMidnightIso(dayOffset: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Perth",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [year, month, day] = parts.split("-").map(Number);
  return new Date(Date.UTC(year!, (month ?? 1) - 1, (day ?? 1) + dayOffset, -8, 0, 0)).toISOString();
}

async function authorRoleForPatient(patientId: string): Promise<string> {
  const fromEnv = process.env.HALAXY_PRACTITIONER_ROLE_ID?.trim();
  if (fromEnv) return fromEnv;
  const params = new URLSearchParams();
  params.set("patient", patientId);
  params.set("_count", "10");
  params.set("_sort", "-date");
  const response = await halaxyFetch(`/Appointment?${params.toString()}`);
  const bundle = await readBundle(response);
  for (const entry of bundle.entry ?? []) {
    const appointment = entry.resource;
    if (appointment?.resourceType !== "Appointment") continue;
    const role = roleIdOf(appointment);
    const patient = patientParticipant(appointment);
    if (role && patient && !isCancelledStatus(participantStatus(patient), appointment)) return role;
  }
  const counts = new Map<string, number>();
  const resources = await searchBundle(
    `/Appointment?${new URLSearchParams([
      ["date", `ge${perthMidnightIso(0)}`],
      ["date", `lt${perthMidnightIso(1)}`],
      ["_count", "100"],
    ]).toString()}`
  );
  for (const resource of resources) {
    if (resource.resourceType !== "Appointment") continue;
    const role = roleIdOf(resource);
    if (role) counts.set(role, (counts.get(role) ?? 0) + 1);
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!best) throw new Error("Halaxy could not find a practitioner for this note.");
  return best;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function htmlNote(title: string, body: string): string {
  return `<p>${escapeHtml(title)}</p><pre>${escapeHtml(body)}</pre>`;
}

const HALAXY_FILE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const HALAXY_FILE_LIMIT_BYTES = 20 * 1024 * 1024;

function resourceUrl(type: "Patient" | "PractitionerRole", id: string): string {
  return `${HALAXY_BASE}/${type}/${id}`;
}

async function readHalaxyJson(response: Response): Promise<(FhirBundle & { id?: string; success?: boolean }) | null> {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as FhirBundle & { id?: string; success?: boolean };
  } catch {
    return null;
  }
}

export async function halaxyCreatePatientTask(options: {
  patientId: string;
  title: string;
  detail: string;
}): Promise<{ created: boolean; error?: string }> {
  const roleId = await authorRoleForPatient(options.patientId);
  return halaxyCreateTask({ ...options, roleId });
}

async function halaxyCreateTask(options: {
  patientId: string;
  roleId: string;
  title: string;
  detail: string;
}): Promise<{ created: boolean; error?: string }> {
  const response = await halaxyFetch("/Task", {
    method: "POST",
    body: JSON.stringify({
      resourceType: "Task",
      status: "requested",
      intent: "order",
      priority: "routine",
      description: options.title,
      note: [{ text: options.detail }],
      for: { type: "Patient", reference: resourceUrl("Patient", options.patientId) },
      owner: { type: "PractitionerRole", reference: resourceUrl("PractitionerRole", options.roleId) },
    }),
  });
  if (response.status === 404 || response.status === 405) {
    return { created: false, error: "Halaxy's API does not include tasks, so no task was created." };
  }
  const body = await readHalaxyJson(response);
  if (!response.ok || body?.success === false) {
    return { created: false, error: issueMessage(body, response.status) };
  }
  return { created: true };
}

export async function halaxyUploadPatientFile(options: {
  patientId: string;
  filename: string;
  content: Buffer | string;
  contentType: string;
  description?: string;
  createTask?: boolean;
  taskTitle?: string;
}): Promise<{ id: string; taskCreated: boolean; taskError?: string }> {
  const roleId = await authorRoleForPatient(options.patientId);
  const title = options.description?.trim() || options.filename;
  const bytes = Buffer.isBuffer(options.content) ? options.content : Buffer.from(options.content, "utf8");
  const attachFile = HALAXY_FILE_TYPES.has(options.contentType);
  if (attachFile && bytes.length > HALAXY_FILE_LIMIT_BYTES) {
    throw new Error("Halaxy accepts files up to 20 MB.");
  }
  const noteHtml = attachFile
    ? `<p>Uploaded from Texlex.</p><p>${escapeHtml(options.filename)}</p>`
    : htmlNote(title, bytes.toString("utf8"));
  const content: Array<{ attachment: { contentType: string; data: string; title?: string } }> = [
    { attachment: { contentType: "text/html", data: noteHtml } },
  ];
  if (attachFile) {
    content.push({
      attachment: {
        contentType: options.contentType,
        data: bytes.toString("base64"),
        title: options.filename,
      },
    });
  }
  const response = await halaxyFetch("/DocumentReference", {
    method: "POST",
    body: JSON.stringify({
      resourceType: "DocumentReference",
      status: "current",
      docStatus: attachFile ? "final" : "preliminary",
      description: title,
      subject: { type: "Patient", reference: resourceUrl("Patient", options.patientId) },
      author: [{ type: "PractitionerRole", reference: resourceUrl("PractitionerRole", roleId) }],
      content,
    }),
  });
  const body = await readHalaxyJson(response);
  if (!response.ok || body?.success === false || (!body?.id && body?.success !== true)) {
    throw new Error(issueMessage(body, response.status));
  }
  let taskCreated = false;
  let taskError: string | undefined;
  if (options.createTask) {
    const task = await halaxyCreateTask({
      patientId: options.patientId,
      roleId,
      title: options.taskTitle?.trim() || `Review uploaded file: ${options.filename}`,
      detail: `${title} (${options.filename}) was uploaded from Texlex.`,
    });
    taskCreated = task.created;
    taskError = task.error;
  }
  return { id: body?.id ? String(body.id) : "saved", taskCreated, taskError };
}

export async function halaxyFindOrCreatePatient(options: {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  email?: string;
  phone?: string;
}): Promise<{ patient: ClinikoPatient; created: boolean }> {
  const matches = await halaxySearchPatients(`${options.firstName} ${options.lastName}`);
  const existing = matches.find((patient) => {
    const sameName =
      patient.first_name.toLowerCase() === options.firstName.toLowerCase() &&
      patient.last_name.toLowerCase() === options.lastName.toLowerCase();
    if (!sameName) return false;
    if (options.dateOfBirth && patient.date_of_birth && patient.date_of_birth !== options.dateOfBirth) {
      return false;
    }
    return true;
  });
  if (existing) return { patient: existing, created: false };

  const telecom = [
    options.email ? { system: "email", value: options.email } : null,
    options.phone ? { system: "sms", value: options.phone } : null,
  ].filter(Boolean);
  const response = await halaxyFetch("/Patient", {
    method: "POST",
    body: JSON.stringify({
      resourceType: "Patient",
      name: [{ use: "official", given: [options.firstName], family: options.lastName }],
      birthDate: options.dateOfBirth || undefined,
      telecom,
    }),
  });
  const body = (await response.json().catch(() => null)) as FhirPatient | null;
  if (!response.ok || !body?.id) throw new Error(issueMessage(body as FhirBundle, response.status));
  return { patient: mapPatientSummary(body), created: true };
}
