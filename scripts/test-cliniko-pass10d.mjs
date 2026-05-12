import { config } from "dotenv";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

config({ path: ".env.local" });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "tmp/pass10d");
const baseUrl = process.env.TEXLEX_BASE_URL ?? "http://127.0.0.1:3000";
const lunaId = "1948278472174470958";

const results = [];

function record(name, passed, detail = "") {
  results.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { response, json };
}

async function run() {
  await mkdir(outDir, { recursive: true });

  const status = await fetchJson(`${baseUrl}/api/cliniko/status`);
  record("status endpoint", status.response.ok, JSON.stringify(status.json));

  const search = await fetchJson(`${baseUrl}/api/cliniko/patients/search?q=${encodeURIComponent("Luna")}`);
  const luna = (search.json?.patients ?? []).find(
    (patient) => patient.last_name === "Rotondella" && patient.first_name === "Luna"
  );
  record("search Luna", Boolean(luna), luna ? `${luna.last_name}, ${luna.first_name}` : "not found");

  const patient = await fetchJson(`${baseUrl}/api/cliniko/patients/${lunaId}`);
  record("load Luna patient", patient.response.ok, patient.json?.patient?.label ?? patient.json?.error);

  const sync = await fetchJson(`${baseUrl}/api/cliniko/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      patientId: lunaId,
      baseline: {
        standard: {
          clientName: patient.json?.patient ? `${patient.json.patient.first_name} ${patient.json.patient.last_name}` : "",
          dob: patient.json?.patient?.date_of_birth ?? "",
          phone: patient.json?.patient?.phone_numbers?.[0]?.number ?? "",
          address: "",
        },
        custom: patient.json?.customFields ?? {},
      },
      patientDetails: {
        clientName: patient.json?.patient ? `${patient.json.patient.first_name} ${patient.json.patient.last_name}` : "",
        parent1: "",
        parent2: "",
        parent1Relationship: "father",
        parent2Relationship: "",
        dob: patient.json?.patient?.date_of_birth ?? "",
        referringPractitioner: "",
        referringPractitionerType: "",
        referringPractitionerEmail: "",
        assessmentType: "",
        school: "Treeby Primary",
        yearLevel: "",
        phone: patient.json?.patient?.phone_numbers?.[0]?.number ?? "",
        address: "",
      },
    }),
  });
  record("write-back sync", sync.response.ok, JSON.stringify(sync.json));

  const reload = await fetchJson(`${baseUrl}/api/cliniko/patients/${lunaId}`);
  const custom = reload.json?.customFields ?? {};
  record(
    "reload custom fields",
    custom.parent1Relationship === "father" && custom.schoolName === "Treeby Primary",
    JSON.stringify({ parent1Relationship: custom.parent1Relationship, schoolName: custom.schoolName })
  );

  await writeFile(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
  const failed = results.filter((item) => !item.passed);
  if (failed.length) process.exitCode = 1;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
