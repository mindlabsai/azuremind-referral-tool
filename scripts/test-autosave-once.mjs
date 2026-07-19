import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3000/asd-engine/report";
const CLIENT = "AutoSave Test Child";
const NOTES = `autosave-probe-${Date.now()}`;
const STORAGE_KEY = "texlex-draft-manual-autosave-test-child";
const DEBOUNCE_MS = 2500;

const results = [];

function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

try {
  await page.goto(BASE, { waitUntil: "networkidle" });

  await page.evaluate((key) => {
    localStorage.removeItem(key);
    localStorage.removeItem("texlex-report-draft-v1");
  }, STORAGE_KEY);

  await page.getByPlaceholder("Paste or type assessment notes…").fill("notes-without-name");
  await page.waitForTimeout(DEBOUNCE_MS);
  const noNameKey = await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith("texlex-draft-manual-"));
    return keys.length;
  });
  record(
    "No client name → no manual draft key",
    noNameKey === 0,
    `manual draft keys in localStorage: ${noNameKey}`
  );

  await page.locator('label:has-text("Client Name") input').fill(CLIENT);
  await page.getByPlaceholder("Paste or type assessment notes…").fill(NOTES);
  await page.waitForTimeout(DEBOUNCE_MS);

  const saved = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return { parseError: true };
    }
  }, STORAGE_KEY);

  record(
    "Client name set → draft written to localStorage",
    Boolean(saved),
    saved ? `key=${STORAGE_KEY}` : "no entry found"
  );

  if (saved) {
    record(
      "Saved payload contains edited rawNotes",
      saved.rawNotes === NOTES,
      `rawNotes=${JSON.stringify(saved.rawNotes)}`
    );
    record(
      "Saved payload has lastSaved timestamp",
      typeof saved.lastSaved === "string" && !Number.isNaN(Date.parse(saved.lastSaved)),
      `lastSaved=${saved.lastSaved}`
    );
    record(
      "Saved payload contains client name",
      saved.patientDetails?.clientName === CLIENT,
      `clientName=${saved.patientDetails?.clientName}`
    );
  }

  const statusText = await page.locator("header").getByText(/Saved|Editing|Save failed/i).first().textContent();
  record(
    "Header shows saved status after debounce",
    /Saved/i.test(statusText ?? ""),
    `status="${statusText?.trim()}"`
  );

  await page.reload({ waitUntil: "networkidle" });
  const resumeVisible = await page.getByRole("dialog", { name: "Resume draft" }).isVisible().catch(() => false);
  const resumeText = resumeVisible
    ? await page.getByRole("dialog", { name: "Resume draft" }).innerText()
    : "";
  record(
    "Reload shows resume-draft prompt",
    resumeVisible && /Resume previous draft/i.test(resumeText),
    resumeVisible ? "prompt visible" : "prompt not shown"
  );

  let reportStatePosts = 0;
  await page.route("**/api/report-state", async (route) => {
    if (route.request().method() === "POST") reportStatePosts += 1;
    await route.continue();
  });
  await page.getByPlaceholder("Paste or type assessment notes…").fill(NOTES + "-edited");
  await page.waitForTimeout(DEBOUNCE_MS);
  record(
    "Auto-save does not POST to /api/report-state",
    reportStatePosts === 0,
    `POST count during auto-save window: ${reportStatePosts}`
  );
} catch (err) {
  record("Test harness", false, err instanceof Error ? err.message : String(err));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass);
console.log("\n--- SUMMARY ---");
console.log(`${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("Failures:");
  for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
  process.exit(1);
}
