import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "tmp/pass10h");
const baseUrl = process.env.TEXLEX_BASE_URL ?? "http://127.0.0.1:3000";

async function run() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${baseUrl}/asd-engine/report`, { waitUntil: "load" });
  await page.getByRole("button", { name: "New Report" }).waitFor({ state: "visible", timeout: 60000 });
  await page.screenshot({ path: path.join(outDir, "new-report-button-header.png") });
  await page.getByRole("button", { name: "New Report" }).click();
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 10000 });
  await page.screenshot({ path: path.join(outDir, "new-report-confirm-modal.png") });
  await browser.close();
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
