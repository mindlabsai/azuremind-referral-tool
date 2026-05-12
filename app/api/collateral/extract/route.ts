import path from "node:path";
import { pathToFileURL } from "node:url";
import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { sanitiseExtractedNumber } from "@/lib/texlex-pdf-sanitize";

export const runtime = "nodejs";
export const maxDuration = 60;

const PDF_WORKER_SRC = pathToFileURL(
  path.join(process.cwd(), "node_modules/pdf-parse/dist/pdf-parse/web/pdf.worker.mjs")
).href;

let workerConfigured = false;

function ensurePdfWorker(): void {
  if (workerConfigured) return;
  PDFParse.setWorker(PDF_WORKER_SRC);
  workerConfigured = true;
}

const SCORE_PATTERN =
  /\b(?:T-?score|t-?score|percentile|raw score|total score|score)\s*[:=]?\s*(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/gi;

function extractScaleSummary(text: string): { summary: string; rejectedNumbers: number[] } {
  const rejectedNumbers: number[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 80);

  const summaryLines: string[] = [];
  for (const line of lines) {
    let cleaned = line;
    for (const match of line.matchAll(SCORE_PATTERN)) {
      const raw = match[1];
      const parsed = sanitiseExtractedNumber(raw);
      if (parsed === null && raw) {
        const rejected = Number(raw);
        if (!Number.isFinite(rejected) || Math.abs(rejected) > 1000) {
          rejectedNumbers.push(rejected);
        }
        cleaned = cleaned.replace(match[0], "").trim();
      }
    }
    if (cleaned) summaryLines.push(cleaned);
  }

  return {
    summary: summaryLines.slice(0, 12).join("\n"),
    rejectedNumbers,
  };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files can be extracted." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    ensurePdfWorker();
    const parser = new PDFParse({ data: buffer });
    let text = "";
    try {
      const parsed = await parser.getText();
      text = typeof parsed.text === "string" ? parsed.text.trim() : "";
    } finally {
      await parser.destroy();
    }
    if (!text) {
      return NextResponse.json({ error: "No readable text found in PDF." }, { status: 422 });
    }

    const { summary, rejectedNumbers } = extractScaleSummary(text);
    return NextResponse.json({
      summary: summary || text.slice(0, 2000),
      rejectedNumbers,
      hasUnreliableNumbers: rejectedNumbers.length > 0,
    });
  } catch (error) {
    console.error("Collateral PDF extraction failed:", error);
    return NextResponse.json({ error: "Could not extract PDF text." }, { status: 500 });
  }
}
