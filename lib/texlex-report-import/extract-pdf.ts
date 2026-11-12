import path from "node:path";
import { pathToFileURL } from "node:url";
import { PDFParse } from "pdf-parse";

const PDF_WORKER_SRC = pathToFileURL(
  path.join(process.cwd(), "node_modules/pdf-parse/dist/pdf-parse/web/pdf.worker.mjs")
).href;

let workerConfigured = false;

function ensurePdfWorker(): void {
  if (workerConfigured) return;
  PDFParse.setWorker(PDF_WORKER_SRC);
  workerConfigured = true;
}

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  ensurePdfWorker();
  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    return typeof parsed.text === "string" ? parsed.text.trim() : "";
  } finally {
    await parser.destroy();
  }
}
