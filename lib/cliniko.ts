const CLINIKO_USER_AGENT = "Texlex (Azure Mind - vishal@azuremind.com.au)";

export const CLINIKO_FIELD_MAP = {
  "Parent 1 first name": "parent1FirstName",
  "Parent 1 last name": "parent1LastName",
  "Parent 1 relationship": "parent1Relationship",
  "Parent 2 first name": "parent2FirstName",
  "Parent 2 last name": "parent2LastName",
  "Parent 2 relationship": "parent2Relationship",
  "School name": "schoolName",
  "Year level": "yearLevel",
  "Referrer name": "referrerName",
  "Referrer type": "referrerType",
  "Referrer email": "referrerEmail",
  "Assessment type": "assessmentType",
} as const;

export type ClinikoCustomFieldKey = (typeof CLINIKO_FIELD_MAP)[keyof typeof CLINIKO_FIELD_MAP];

export const CLINIKO_FIELD_MAP_REVERSE: Record<ClinikoCustomFieldKey, string> = Object.fromEntries(
  Object.entries(CLINIKO_FIELD_MAP).map(([name, key]) => [key, name])
) as Record<ClinikoCustomFieldKey, string>;

const CLINIKO_FIELD_ALIASES: Record<string, ClinikoCustomFieldKey> = {
  "school name": "schoolName",
  "year level": "yearLevel",
  "referrer emaii": "referrerEmail",
  "referrer email": "referrerEmail",
};

export type ClinikoPatient = {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
};

export type ClinikoPhoneNumber = {
  number: string;
  phone_type: string;
};

export type ClinikoAddress = {
  line1: string;
  line2: string;
  line3: string;
  city: string;
  state: string;
  post_code: string;
};

export type ClinikoPatientFull = {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  sex: string | null;
  title: string | null;
  email: string | null;
  phone_numbers: ClinikoPhoneNumber[];
  addresses: ClinikoAddress[];
};

export type ClinikoCustomFieldDef = {
  id: string;
  name: string;
  token: string;
  type: string;
};

export type ClinikoStandardFields = {
  first_name?: string;
  last_name?: string;
  title?: string;
  date_of_birth?: string;
  email?: string;
  phone?: string;
  address_1?: string;
  address_2?: string;
  address_3?: string;
  city?: string;
  state?: string;
  post_code?: string;
};

type ClinikoSettingsSection = {
  name: string;
  token: string;
  fields: Array<{ name: string; type: string; token: string }>;
};

type ClinikoCustomFieldsPayload = {
  sections?: Array<{
    token: string;
    fields?: Array<{ token: string; type?: string; value?: string }>;
  }>;
};

type ClinikoApiPatient = {
  id: string | number;
  first_name?: string;
  last_name?: string;
  date_of_birth?: string | null;
  sex?: string | null;
  title?: string | null;
  email?: string | null;
  address_1?: string | null;
  address_2?: string | null;
  address_3?: string | null;
  city?: string | null;
  state?: string | null;
  post_code?: string | null;
  patient_phone_numbers?: Array<{ number?: string; phone_type?: string }>;
  custom_fields?: ClinikoCustomFieldsPayload | null;
};

export type ClinikoPatientAppointment = {
  id: string;
  starts_at: string | null;
  cancelled_at: string | null;
  archived_at: string | null;
};

type ClinikoApiIndividualAppointment = {
  id: string | number;
  starts_at?: string | null;
  cancelled_at?: string | null;
  archived_at?: string | null;
};

let customFieldDefinitionsCache: ClinikoCustomFieldDef[] | null = null;
let customFieldSectionToken: string | null = null;
let customFieldLookupByKey: Partial<Record<ClinikoCustomFieldKey, ClinikoCustomFieldDef>> = {};

function normalizeFieldName(name: string): string {
  return name.trim().toLowerCase();
}

function resolveCustomFieldKey(name: string): ClinikoCustomFieldKey | null {
  const normalized = normalizeFieldName(name);
  const alias = CLINIKO_FIELD_ALIASES[normalized];
  if (alias) return alias;

  for (const [fieldName, key] of Object.entries(CLINIKO_FIELD_MAP)) {
    if (normalizeFieldName(fieldName) === normalized) return key;
  }
  return null;
}

function getClinikoBaseUrl(): string {
  const region = process.env.CLINIKO_REGION?.trim() || "au1";
  return `https://api.${region}.cliniko.com/v1`;
}

function getClinikoApiKey(): string | null {
  const key = process.env.CLINIKO_API_KEY?.trim();
  return key || null;
}

export function isClinikoConfigured(): boolean {
  return Boolean(getClinikoApiKey());
}

function getClinikoHeaders(): HeadersInit {
  const apiKey = getClinikoApiKey();
  if (!apiKey) {
    throw new Error("Cliniko credentials not configured.");
  }
  const auth = Buffer.from(`${apiKey}:`).toString("base64");
  return {
    Authorization: `Basic ${auth}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": CLINIKO_USER_AGENT,
  };
}

async function parseClinikoError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string; error?: string; errors?: unknown };
    if (typeof body.message === "string" && body.message.trim()) return body.message;
    if (typeof body.error === "string" && body.error.trim()) return body.error;
    if (body.errors) return JSON.stringify(body.errors);
  } catch {
    // ignore
  }
  return `Cliniko request failed (${response.status})`;
}

async function clinikoFetch(
  path: string,
  init: RequestInit = {},
  options: { retried?: boolean; allow404?: boolean } = {}
): Promise<Response> {
  const started = Date.now();
  const method = init.method ?? "GET";
  console.log(`[cliniko] ${method} ${path} start`);
  let response: Response;
  try {
    response = await fetch(`${getClinikoBaseUrl()}${path}`, {
      ...init,
      headers: {
        ...getClinikoHeaders(),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    console.log(`[cliniko] ${method} ${path} failed network (${Date.now() - started}ms)`);
    throw new Error("Cannot reach Cliniko. Check connection.");
  }

  if (response.status === 429 && !options.retried) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return clinikoFetch(path, init, { ...options, retried: true });
  }

  if (response.status === 401) {
    throw new Error("Cliniko authentication failed. Check API key.");
  }
  if (response.status === 404) {
    if (options.allow404) {
      console.log(`[cliniko] ${method} ${path} 404 allowed (${Date.now() - started}ms)`);
      return response;
    }
    throw new Error("Patient not found in Cliniko.");
  }
  if (!response.ok) {
    const message = await parseClinikoError(response);
    console.log(`[cliniko] ${method} ${path} error ${response.status} (${Date.now() - started}ms)`);
    throw new Error(message);
  }

  console.log(`[cliniko] ${method} ${path} ok (${Date.now() - started}ms)`);
  return response;
}

function mapPatientSummary(patient: ClinikoApiPatient): ClinikoPatient {
  return {
    id: String(patient.id),
    first_name: patient.first_name ?? "",
    last_name: patient.last_name ?? "",
    date_of_birth: patient.date_of_birth ?? null,
  };
}

function mapPatientFull(patient: ClinikoApiPatient): ClinikoPatientFull {
  const street = [patient.address_1, patient.address_2, patient.address_3]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(", ");
  return {
    id: String(patient.id),
    first_name: patient.first_name ?? "",
    last_name: patient.last_name ?? "",
    date_of_birth: patient.date_of_birth ?? null,
    sex: patient.sex ?? null,
    title: patient.title ?? null,
    email: patient.email ?? null,
    phone_numbers: (patient.patient_phone_numbers ?? [])
      .filter((phone) => typeof phone.number === "string" && phone.number.trim())
      .map((phone) => ({
        number: phone.number!.trim(),
        phone_type: phone.phone_type ?? "Mobile",
      })),
    addresses: [
      {
        line1: street,
        line2: "",
        line3: "",
        city: (patient.city ?? "").trim(),
        state: (patient.state ?? "").trim(),
        post_code: (patient.post_code ?? "").trim(),
      },
    ],
  };
}

function buildCustomFieldLookup(definitions: ClinikoCustomFieldDef[]): void {
  customFieldLookupByKey = {};
  for (const definition of definitions) {
    const key = resolveCustomFieldKey(definition.name);
    if (key) customFieldLookupByKey[key] = definition;
  }

  for (const fieldName of Object.keys(CLINIKO_FIELD_MAP)) {
    const key = CLINIKO_FIELD_MAP[fieldName as keyof typeof CLINIKO_FIELD_MAP];
    if (!customFieldLookupByKey[key]) {
      console.warn(`[cliniko] Custom field not found in Cliniko: ${fieldName}`);
    }
  }
}

async function loadCustomFieldDefinitionsFromSettings(): Promise<ClinikoCustomFieldDef[]> {
  const response = await clinikoFetch("/settings");
  const settings = (await response.json()) as {
    patient_custom_fields_definition?: { sections?: ClinikoSettingsSection[] };
  };
  const sections = settings.patient_custom_fields_definition?.sections ?? [];
  const texlexSection =
    sections.find((section) => normalizeFieldName(section.name) === normalizeFieldName("Texlex Report Data")) ??
    sections[0];
  if (!texlexSection) return [];

  customFieldSectionToken = texlexSection.token;
  return texlexSection.fields.map((field) => ({
    id: field.token,
    name: field.name,
    token: field.token,
    type: field.type,
  }));
}

export async function clinikoGetCustomFieldDefinitions(): Promise<ClinikoCustomFieldDef[]> {
  const started = Date.now();
  console.log("[cliniko] clinikoGetCustomFieldDefinitions start");
  if (customFieldDefinitionsCache) {
    console.log(`[cliniko] clinikoGetCustomFieldDefinitions cache hit (${Date.now() - started}ms)`);
    return customFieldDefinitionsCache;
  }

  let definitions: ClinikoCustomFieldDef[] = [];
  const legacyResponse = await clinikoFetch("/custom_patient_fields?per_page=100", {}, { allow404: true });
  if (legacyResponse.status === 404) {
    definitions = await loadCustomFieldDefinitionsFromSettings();
  } else {
    const body = (await legacyResponse.json()) as {
      custom_patient_fields?: Array<{ id: string | number; name: string }>;
    };
    definitions = (body.custom_patient_fields ?? []).map((field) => ({
      id: String(field.id),
      name: field.name,
      token: String(field.id),
      type: "text",
    }));
  }

  customFieldDefinitionsCache = definitions;
  buildCustomFieldLookup(definitions);
  console.log(
    `[cliniko] clinikoGetCustomFieldDefinitions loaded ${definitions.length} fields (${Date.now() - started}ms)`
  );
  return definitions;
}

function emptyCustomFieldRecord(): Record<ClinikoCustomFieldKey, string> {
  return {
    parent1FirstName: "",
    parent1LastName: "",
    parent1Relationship: "",
    parent2FirstName: "",
    parent2LastName: "",
    parent2Relationship: "",
    schoolName: "",
    yearLevel: "",
    referrerName: "",
    referrerType: "",
    referrerEmail: "",
    assessmentType: "",
  };
}

export async function clinikoGetPatientCustomFields(patientId: string): Promise<Record<ClinikoCustomFieldKey, string>> {
  const started = Date.now();
  console.log(`[cliniko] clinikoGetPatientCustomFields(${patientId}) start`);
  await clinikoGetCustomFieldDefinitions();
  const values = emptyCustomFieldRecord();

  const response = await clinikoFetch(`/patients/${patientId}`);
  const patient = (await response.json()) as ClinikoApiPatient;
  const sections = patient.custom_fields?.sections ?? [];
  for (const section of sections) {
    for (const field of section.fields ?? []) {
      const definition = Object.values(customFieldLookupByKey).find((item) => item?.token === field.token);
      const key = definition ? resolveCustomFieldKey(definition.name) : null;
      if (!key) continue;
      values[key] = typeof field.value === "string" ? field.value : "";
    }
  }

  console.log(`[cliniko] clinikoGetPatientCustomFields(${patientId}) done (${Date.now() - started}ms)`);
  return values;
}

function dedupePatients(patients: ClinikoPatient[]): ClinikoPatient[] {
  const seen = new Set<string>();
  const results: ClinikoPatient[] = [];
  for (const patient of patients) {
    if (seen.has(patient.id)) continue;
    seen.add(patient.id);
    results.push(patient);
  }
  return results;
}

async function searchPatientsByFilters(filters: string[]): Promise<ClinikoPatient[]> {
  const query = filters.map((filter) => `q[]=${encodeURIComponent(filter)}`).join("&");
  const response = await clinikoFetch(`/patients?per_page=20&${query}`);
  const body = (await response.json()) as { patients?: ClinikoApiPatient[] };
  return (body.patients ?? []).map(mapPatientSummary);
}

export async function clinikoSearchPatients(query: string): Promise<ClinikoPatient[]> {
  const started = Date.now();
  const trimmed = query.trim();
  console.log(`[cliniko] clinikoSearchPatients("${trimmed}") start`);
  if (trimmed.length < 2) return [];

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const requests: Promise<ClinikoPatient[]>[] = [];
  if (tokens.length === 1) {
    const token = tokens[0]!;
    requests.push(searchPatientsByFilters([`first_name:~${token}`]));
    requests.push(searchPatientsByFilters([`last_name:~${token}`]));
  } else {
    const [first, ...rest] = tokens;
    const last = rest.join(" ");
    requests.push(searchPatientsByFilters([`first_name:~${first}`, `last_name:~${last}`]));
    requests.push(searchPatientsByFilters([`first_name:~${last}`, `last_name:~${first}`]));
    requests.push(searchPatientsByFilters([`first_name:~${first}`]));
    requests.push(searchPatientsByFilters([`last_name:~${last}`]));
  }

  const batches = await Promise.all(requests);
  const merged = dedupePatients(batches.flat()).slice(0, 20);
  console.log(`[cliniko] clinikoSearchPatients("${trimmed}") found ${merged.length} (${Date.now() - started}ms)`);
  return merged;
}

export async function clinikoGetPatient(id: string): Promise<ClinikoPatientFull> {
  const started = Date.now();
  console.log(`[cliniko] clinikoGetPatient(${id}) start`);
  const response = await clinikoFetch(`/patients/${id}`);
  const patient = (await response.json()) as ClinikoApiPatient;
  const mapped = mapPatientFull(patient);
  console.log(`[cliniko] clinikoGetPatient(${id}) done (${Date.now() - started}ms)`);
  return mapped;
}

export async function clinikoGetPatientAppointments(
  patientId: string
): Promise<{ appointments: ClinikoPatientAppointment[]; hasUpcomingBooking: boolean }> {
  const started = Date.now();
  console.log(`[cliniko] clinikoGetPatientAppointments(${patientId}) start`);
  const response = await clinikoFetch(
    `/individual_appointments?per_page=100&q[]=${encodeURIComponent(`patient_id:=${patientId}`)}`
  );
  const body = (await response.json()) as {
    individual_appointments?: ClinikoApiIndividualAppointment[];
  };
  const appointments = (body.individual_appointments ?? []).map((appointment) => ({
    id: String(appointment.id),
    starts_at: appointment.starts_at ?? null,
    cancelled_at: appointment.cancelled_at ?? null,
    archived_at: appointment.archived_at ?? null,
  }));

  const now = Date.now();
  const hasUpcomingBooking = appointments.some((appointment) => {
    if (!appointment.starts_at) return false;
    if (appointment.cancelled_at) return false;
    if (appointment.archived_at) return false;
    const startsAt = new Date(appointment.starts_at).getTime();
    return Number.isFinite(startsAt) && startsAt > now;
  });

  console.log(
    `[cliniko] clinikoGetPatientAppointments(${patientId}) found ${appointments.length}, upcoming=${hasUpcomingBooking} (${Date.now() - started}ms)`
  );
  return { appointments, hasUpcomingBooking };
}

export async function clinikoCreatePatient(
  standardFields: Partial<ClinikoStandardFields>
): Promise<ClinikoPatient> {
  const started = Date.now();
  console.log(`[cliniko] clinikoCreatePatient start`);
  const payload: Record<string, unknown> = { ...standardFields };
  if (standardFields.phone) {
    payload.patient_phone_numbers = [{ number: standardFields.phone, phone_type: "Mobile" }];
    delete payload.phone;
  }
  const response = await clinikoFetch(`/patients`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const patient = (await response.json()) as ClinikoApiPatient;
  console.log(`[cliniko] clinikoCreatePatient done id=${patient.id} (${Date.now() - started}ms)`);
  return mapPatientSummary(patient);
}

export async function clinikoFindOrCreatePatient(
  details: { firstName: string; lastName: string; dateOfBirth?: string } & Partial<ClinikoStandardFields>
): Promise<{ patient: ClinikoPatient; created: boolean }> {
  const { firstName, lastName, dateOfBirth, ...rest } = details;

  const candidates = await clinikoSearchPatients(`${firstName} ${lastName}`.trim());
  const norm = (s: string) => s.trim().toLowerCase();
  const match = candidates.find(
    (p) =>
      norm(p.first_name) === norm(firstName) &&
      norm(p.last_name) === norm(lastName) &&
      (!dateOfBirth || !p.date_of_birth || p.date_of_birth === dateOfBirth)
  );

  if (match) {
    console.log(`[cliniko] clinikoFindOrCreatePatient reuse id=${match.id}`);
    return { patient: match, created: false };
  }

  const patient = await clinikoCreatePatient({
    first_name: firstName,
    last_name: lastName,
    ...(dateOfBirth ? { date_of_birth: dateOfBirth } : {}),
    ...rest,
  });
  return { patient, created: true };
}

export async function clinikoUpdatePatient(
  patientId: string,
  standardFields: Partial<ClinikoStandardFields>
): Promise<void> {
  const started = Date.now();
  console.log(`[cliniko] clinikoUpdatePatient(${patientId}) start`);
  const payload: Record<string, unknown> = { ...standardFields };
  if (standardFields.phone) {
    payload.patient_phone_numbers = [{ number: standardFields.phone, phone_type: "Mobile" }];
    delete payload.phone;
  }
  await clinikoFetch(`/patients/${patientId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  console.log(`[cliniko] clinikoUpdatePatient(${patientId}) done (${Date.now() - started}ms)`);
}

export async function clinikoUpdateCustomFields(
  patientId: string,
  fields: Partial<Record<ClinikoCustomFieldKey, string>>
): Promise<void> {
  const started = Date.now();
  console.log(`[cliniko] clinikoUpdateCustomFields(${patientId}) start`);
  await clinikoGetCustomFieldDefinitions();
  if (!customFieldSectionToken) {
    throw new Error("Texlex custom field section not found in Cliniko.");
  }

  const fieldPayload: Array<{ token: string; type: string; value: string }> = [];
  const response = await clinikoFetch(`/patients/${patientId}`);
  const patient = (await response.json()) as ClinikoApiPatient;
  const existingValues = new Map<string, string>();
  for (const section of patient.custom_fields?.sections ?? []) {
    for (const field of section.fields ?? []) {
      if (typeof field.token === "string" && typeof field.value === "string" && field.value.trim()) {
        existingValues.set(field.token, field.value.trim());
      }
    }
  }

  for (const [key, value] of Object.entries(fields) as Array<[ClinikoCustomFieldKey, string]>) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const definition = customFieldLookupByKey[key];
    if (!definition) continue;
    existingValues.set(definition.token, trimmed);
  }

  for (const [token, value] of existingValues.entries()) {
    const definition = Object.values(customFieldLookupByKey).find((item) => item?.token === token);
    fieldPayload.push({
      token,
      type: definition?.type || "text",
      value,
    });
  }

  if (!fieldPayload.length) {
    console.log(`[cliniko] clinikoUpdateCustomFields(${patientId}) no changes (${Date.now() - started}ms)`);
    return;
  }

  await clinikoFetch(`/patients/${patientId}`, {
    method: "PATCH",
    body: JSON.stringify({
      custom_fields: {
        sections: [
          {
            token: customFieldSectionToken,
            fields: fieldPayload,
          },
        ],
      },
    }),
  });
  console.log(`[cliniko] clinikoUpdateCustomFields(${patientId}) done (${Date.now() - started}ms)`);
}

export function splitParentName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  const lastName = parts.pop()!;
  return { firstName: parts.join(" "), lastName };
}

export function formatClinikoAddress(address: ClinikoAddress): string {
  const street = address.line1.trim();
  const locality = [address.city, address.state, address.post_code].map((part) => part.trim()).filter(Boolean);
  return [street, locality.join(" ")].filter(Boolean).join(", ");
}

// ─── Patient attachments (report files) ───────────────────────────
export async function clinikoUploadPatientAttachment(
  patientId: string,
  filename: string,
  content: string | Buffer,
  contentType: string,
  description = ""
): Promise<{ id: string }> {
  console.log("[cliniko] upload input", { filename, contentType, contentKind: typeof content, isBuffer: Buffer.isBuffer(content), byteLen: typeof content === "string" ? content.length : content?.length, head: typeof content === "string" ? content.slice(0,16) : Buffer.from(content.slice(0,8)).toString("hex") });
  const presignRes = await clinikoFetch(`/patients/${patientId}/attachment_presigned_post`);
  const presign = (await presignRes.json()) as { url: string; fields: Record<string, string> };
  console.log("[cliniko] presign", JSON.stringify(presign, null, 2));

  const form = new FormData();
  for (const [k, v] of Object.entries(presign.fields)) form.append(k, v);
  form.append("file", new Blob([typeof content === "string" ? content : new Uint8Array(content)], { type: contentType }), filename);

  const s3Res = await fetch(presign.url, { method: "POST", body: form });
  if (!s3Res.ok && s3Res.status !== 201 && s3Res.status !== 204) {
    throw new Error(`S3 upload failed (${s3Res.status})`);
  }

  const resolvedKey = presign.fields.key.replace("${filename}", encodeURIComponent(filename));
  const uploadUrl = `${presign.url.replace(/\/$/, "")}/${resolvedKey}`;
  const createRes = await clinikoFetch(`/patient_attachments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patient_id: patientId, filename, description, upload_url: uploadUrl }),
  });
  const created = (await createRes.json()) as { id: string | number };
  return { id: String(created.id) };
}

export async function clinikoGetLatestStateAttachment(
  patientId: string
): Promise<{ id: string; filename: string; contentUrl: string } | null> {
  const res = await clinikoFetch(
    `/patients/${patientId}/patient_attachments?per_page=50&sort=created_at:desc`
  );
  const body = (await res.json()) as {
    patient_attachments?: Array<{
      id: string | number;
      filename?: string;
      processing_completed?: boolean;
      content?: { links?: { self?: string } };
    }>;
  };
  const match = (body.patient_attachments ?? []).find(
    (a) => a.processing_completed && a.filename?.startsWith("texlex-state-")
  );
  if (!match) return null;
  return {
    id: String(match.id),
    filename: match.filename ?? "",
    contentUrl: match.content?.links?.self ?? "",
  };
}
