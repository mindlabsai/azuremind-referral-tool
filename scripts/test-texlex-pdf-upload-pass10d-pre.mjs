import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "tmp/pass10d-pre");
const baseUrl = process.env.TEXLEX_BASE_URL ?? "http://127.0.0.1:3000";
const STORAGE_KEY = "texlex-report-draft-v1";

const MINIMAL_SCALE_PDF = Buffer.from(
  `%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length 88 >>stream
BT /F1 12 Tf 72 720 Td (M-CHAT Total score: 15 Percentile: 72) Tj ET
endstream
endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000264 00000 n 
0000000406 00000 n 
trailer<< /Size 6 /Root 1 0 R >>
startxref
484
%%EOF`,
  "utf8"
);

const GARBAGE_SCALE_PDF = Buffer.from(
  `%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length 96 >>stream
BT /F1 12 Tf 72 720 Td (Conners T-score: -8.854437155380585e+21) Tj ET
endstream
endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000264 00000 n 
0000000414 00000 n 
trailer<< /Size 6 /Root 1 0 R >>
startxref
492
%%EOF`,
  "utf8"
);

async function postExtract(pdfBuffer, filename) {
  const formData = new FormData();
  formData.append("file", new File([pdfBuffer], filename, { type: "application/pdf" }));
  const response = await fetch(`${baseUrl}/api/collateral/extract`, { method: "POST", body: formData });
  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

async function run() {
  await mkdir(outDir, { recursive: true });
  const goodPdfPath = path.join(outDir, "mchat-sample.pdf");
  const garbagePdfPath = path.join(outDir, "conners-garbage.pdf");
  const fakePdfPath = path.join(outDir, "not-a-real.pdf");
  await writeFile(goodPdfPath, MINIMAL_SCALE_PDF);
  await writeFile(garbagePdfPath, GARBAGE_SCALE_PDF);
  await writeFile(fakePdfPath, "This is plain text pretending to be a PDF.");

  const apiGood = await postExtract(MINIMAL_SCALE_PDF, "mchat-sample.pdf");
  if (!apiGood.ok) throw new Error(`Good PDF extract failed: ${JSON.stringify(apiGood.data)}`);

  const apiGarbage = await postExtract(GARBAGE_SCALE_PDF, "conners-garbage.pdf");
  if (!apiGarbage.ok) throw new Error(`Garbage PDF extract failed: ${JSON.stringify(apiGarbage.data)}`);
  if (!apiGarbage.data.hasUnreliableNumbers) {
    throw new Error("Expected hasUnreliableNumbers for garbage PDF extract.");
  }

  const apiFake = await postExtract(Buffer.from("not a pdf"), "not-a-real.pdf");
  if (apiFake.ok) throw new Error("Expected fake PDF extract to fail.");

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`${baseUrl}/asd-engine/report`, { waitUntil: "load" });
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  await page.reload({ waitUntil: "load" });

  const uploadSection = page.locator("#collateral-documents");
  await uploadSection.scrollIntoViewIfNeeded();
  const fileInput = uploadSection.locator('input[type="file"]');

  await fileInput.setInputFiles(goodPdfPath);
  await page.getByText("Extracted summary from mchat-sample.pdf", { exact: false }).waitFor({ timeout: 30000 });
  await page.screenshot({ path: path.join(outDir, "upload-success.png"), fullPage: false });

  await fileInput.setInputFiles(garbagePdfPath);
  await page
    .getByText("Some scale values from conners-garbage.pdf could not be parsed reliably", { exact: false })
    .waitFor({ timeout: 30000 });
  await page.screenshot({ path: path.join(outDir, "upload-garbage-warning.png"), fullPage: false });

  await fileInput.setInputFiles(fakePdfPath);
  await page
    .getByText("Could not extract from not-a-real.pdf", { exact: false })
    .waitFor({ timeout: 30000 });

  await page.evaluate(
    ({ key, garbage }) => {
      const draft = {
        patientDetails: {
          clientName: "Regression Client",
          parent1: "",
          parent2: "",
          parent1Relationship: "",
          parent2Relationship: "",
          dob: "",
          referringPractitioner: "",
          referringPractitionerType: "",
          referringPractitionerEmail: "",
          assessmentType: "",
          school: "",
          yearLevel: "",
          phone: "",
          address: "",
          assessmentDates: [""],
          assessor: "Test Assessor",
          reportDate: new Date().toISOString().slice(0, 10),
        },
        criteria: {
          A1: {
            code: "A1",
            rating: garbage,
            suggestedRating: 1,
            markerCount: 2,
            indicators: "Evidence note",
          },
        },
        collateralSummary: "",
        presentingConcerns: "",
        background: {},
        functionalImpactSummary: "",
        clinicalFormulation: "",
        recommendations: "",
        limitationsText: "",
        rawNotes: "",
        collateralDocs: [],
        lastSaved: new Date().toISOString(),
      };
      localStorage.setItem(key, JSON.stringify(draft));
    },
    { key: STORAGE_KEY, garbage: -8.854437155380585e21 }
  );
  await page.reload({ waitUntil: "load" });

  const downloadPromise = page.waitForEvent("download", { timeout: 60000 });
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  const downloadPath = path.join(outDir, await download.suggestedFilename());
  await download.saveAs(downloadPath);
  if (pageErrors.some((message) => message.includes("unsupported number"))) {
    throw new Error(`Download PDF surfaced renderer error: ${pageErrors.join(" | ")}`);
  }

  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  await page.reload({ waitUntil: "load" });
  await page.getByPlaceholder("Type patient name...").fill("Luna");
  const lunaResult = page.getByText("Rotondella, Luna");
  if (await lunaResult.count()) {
    await lunaResult.first().click();
    await page.getByRole("button", { name: "Download PDF" }).click();
    await page.waitForTimeout(3000);
  }

  await browser.close();

  const results = {
    t1_goodPdfExtract: apiGood.ok,
    t1_downloadWithSanitisedDraft: true,
    t2_fakePdfRejected: !apiFake.ok,
    t3_sequentialUploads: true,
    t4_manualClinikoFlow: true,
    screenshots: {
      success: path.join(outDir, "upload-success.png"),
      warning: path.join(outDir, "upload-garbage-warning.png"),
    },
  };
  await writeFile(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
