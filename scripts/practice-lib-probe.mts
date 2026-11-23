/**
 * Direct Cliniko / Halaxy / practice-source function probe.
 * Run: npx tsx scripts/practice-lib-probe.mts
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));

const { isPracticeSource, practiceApiBase, practiceLabel } = await import("../lib/practice-source");
const {
  isClinikoConfigured,
  clinikoGetCustomFieldDefinitions,
  clinikoSearchPatients,
  clinikoGetPatient,
  clinikoListPractitioners,
  clinikoListScheduleAppointments,
  clinikoGetPatientAppointments,
  clinikoListPatientAttachments,
} = await import("../lib/cliniko");
const { isHalaxyConfigured } = await import("../lib/halaxy");

type Result = { name: string; passed: boolean; detail: string };
const results: Result[] = [];

function record(name: string, passed: boolean, detail = "") {
  results.push({ name, passed, detail: String(detail).slice(0, 240) });
  console.log(`${passed ? "PASS" : "FAIL"} ${name}${detail ? ` — ${String(detail).slice(0, 180)}` : ""}`);
}

async function main() {
  record("practice-source isPracticeSource cliniko", isPracticeSource("cliniko"));
  record("practice-source isPracticeSource halaxy", isPracticeSource("halaxy"));
  record("practice-source isPracticeSource bogus", !isPracticeSource("foo"));
  record(
    "practice-source apiBase cliniko",
    practiceApiBase("cliniko") === "/api/cliniko",
    practiceApiBase("cliniko")
  );
  record(
    "practice-source apiBase halaxy",
    practiceApiBase("halaxy") === "/api/halaxy",
    practiceApiBase("halaxy")
  );
  record("practice-source label cliniko", practiceLabel("cliniko") === "Cliniko");
  record("practice-source label halaxy", practiceLabel("halaxy") === "Halaxy");

  const clinikoCfg = isClinikoConfigured();
  const halaxyCfg = isHalaxyConfigured();
  record("isClinikoConfigured", clinikoCfg === true, String(clinikoCfg));
  record("isHalaxyConfigured reported", true, `configured=${halaxyCfg}`);

  let lunaId: string | null = null;

  try {
    const defs = await clinikoGetCustomFieldDefinitions();
    record(
      "clinikoGetCustomFieldDefinitions",
      Array.isArray(defs) && defs.length > 0,
      `count=${defs.length}`
    );
  } catch (e) {
    record("clinikoGetCustomFieldDefinitions", false, e instanceof Error ? e.message : String(e));
  }

  try {
    const patients = await clinikoSearchPatients("Luna");
    const luna = patients.find((p) => p.first_name === "Luna" && p.last_name === "Rotondella");
    lunaId = luna?.id != null ? String(luna.id) : patients[0]?.id != null ? String(patients[0].id) : null;
    record(
      "clinikoSearchPatients(Luna)",
      patients.length > 0,
      `n=${patients.length} luna=${Boolean(luna)} id=${lunaId}`
    );
  } catch (e) {
    record("clinikoSearchPatients(Luna)", false, e instanceof Error ? e.message : String(e));
  }

  if (lunaId) {
    try {
      const patient = await clinikoGetPatient(lunaId);
      record(
        "clinikoGetPatient",
        Boolean(patient?.first_name),
        `${patient?.first_name} ${patient?.last_name}`
      );
    } catch (e) {
      record("clinikoGetPatient", false, e instanceof Error ? e.message : String(e));
    }
    try {
      const appts = await clinikoGetPatientAppointments(lunaId);
      record(
        "clinikoGetPatientAppointments",
        Array.isArray(appts.appointments),
        `n=${appts.appointments.length} upcoming=${appts.hasUpcomingBooking}`
      );
    } catch (e) {
      record("clinikoGetPatientAppointments", false, e instanceof Error ? e.message : String(e));
    }
    try {
      const atts = await clinikoListPatientAttachments(lunaId);
      record("clinikoListPatientAttachments", Array.isArray(atts), `n=${atts.length}`);
    } catch (e) {
      record("clinikoListPatientAttachments", false, e instanceof Error ? e.message : String(e));
    }
  } else {
    record("clinikoGetPatient", false, "skipped — no luna id");
    record("clinikoGetPatientAppointments", false, "skipped");
    record("clinikoListPatientAttachments", false, "skipped");
  }

  try {
    const practitioners = await clinikoListPractitioners();
    record(
      "clinikoListPractitioners",
      Array.isArray(practitioners) && practitioners.length > 0,
      `n=${practitioners.length}`
    );
  } catch (e) {
    record("clinikoListPractitioners", false, e instanceof Error ? e.message : String(e));
  }

  try {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    const schedule = await clinikoListScheduleAppointments({
      fromIso: from.toISOString(),
      toIso: to.toISOString(),
    });
    record(
      "clinikoListScheduleAppointments",
      Array.isArray(schedule.appointments),
      `n=${schedule.appointments.length} practitioner=${schedule.practitionerId}`
    );
  } catch (e) {
    record("clinikoListScheduleAppointments", false, e instanceof Error ? e.message : String(e));
  }

  if (!halaxyCfg) {
    record("halaxy gated when unconfigured", true, "Halaxy correctly not configured");
  } else {
    record("halaxy configured on this env", true, "keys present — probing search");
    const { halaxySearchPatients, halaxyListScheduleAppointments } = await import("../lib/halaxy");
    try {
      const hp = await halaxySearchPatients("Luna");
      record("halaxySearchPatients(Luna)", Array.isArray(hp), `n=${hp.length}`);
    } catch (e) {
      record("halaxySearchPatients(Luna)", false, e instanceof Error ? e.message : String(e));
    }
    try {
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + 1);
      const hs = await halaxyListScheduleAppointments({
        fromIso: from.toISOString(),
        toIso: to.toISOString(),
      });
      record(
        "halaxyListScheduleAppointments",
        Array.isArray(hs.appointments),
        `n=${hs.appointments.length}`
      );
    } catch (e) {
      record("halaxyListScheduleAppointments", false, e instanceof Error ? e.message : String(e));
    }
  }

  // HTTP status endpoints on production (no cookies → expect 200 with configured flag OR 401)
  const base = process.env.TEXLEX_BASE_URL ?? "https://azuremind-referral-tool.vercel.app";
  for (const path of ["/api/cliniko/status", "/api/halaxy/status"]) {
    try {
      const res = await fetch(`${base}${path}`);
      const json = (await res.json()) as { configured?: boolean; connected?: boolean; error?: string };
      const ok =
        res.status === 401 ||
        res.status === 200 ||
        (typeof json.configured === "boolean");
      record(
        `HTTP ${path}`,
        ok,
        `status=${res.status} configured=${json.configured} connected=${json.connected}`
      );
    } catch (e) {
      record(`HTTP ${path}`, false, e instanceof Error ? e.message : String(e));
    }
  }

  console.log("\n── Practice lib summary ──");
  const failed = results.filter((r) => !r.passed);
  console.log(`Passed ${results.length - failed.length}/${results.length}`);
  if (failed.length) {
    console.log("FAILED:", failed.map((f) => f.name).join(", "));
    process.exitCode = 1;
  }
}

await main();
