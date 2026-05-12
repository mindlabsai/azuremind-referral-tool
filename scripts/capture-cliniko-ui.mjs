import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "tmp/pass10d");
const baseUrl = process.env.TEXLEX_BASE_URL ?? "http://127.0.0.1:3000";

async function run() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  page.on("console", (message) => console.log("PAGE:", message.text()));
  page.on("pageerror", (error) => console.log("PAGEERR:", error.message));
  await page.goto(`${baseUrl}/asd-engine/report`, { waitUntil: "load" });
  await page.locator("#patient-details").scrollIntoViewIfNeeded();
  await page.getByPlaceholder("Type patient name...").waitFor({ state: "visible", timeout: 120000 });
  await page.screenshot({ path: path.join(outDir, "load-from-cliniko-card.png"), fullPage: false });
  await page.getByPlaceholder("Type patient name...").fill("Luna");
  await page.waitForTimeout(500);
  await page.waitForSelector("text=Rotondella, Luna", { timeout: 15000 });
  await page.screenshot({ path: path.join(outDir, "luna-search-results.png"), fullPage: false });
  await browser.close();
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
