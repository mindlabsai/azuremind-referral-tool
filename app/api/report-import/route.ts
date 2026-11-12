import { NextRequest } from "next/server";
import {
  importTexlexReportFromPdf,
  importTexlexReportFromText,
} from "@/lib/texlex-report-import/import-report";
import type { TexlexEngineId } from "@/lib/texlex-report-state";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_PASTE_CHARS = 400_000;

function isEngine(value: unknown): value is TexlexEngineId {
  return value === "adhd" || value === "asd";
}

function clientError(message: string, status: number) {
  return Response.json({ success: false, error: message }, { status });
}

function safeFailMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  // Avoid leaking stack paths / provider internals to the browser.
  if (/ANTHROPIC|api key|ECONN|ETIMEDOUT|fetch failed|pdf-parse|ENOENT/i.test(raw)) {
    return "Import could not be completed. Try again, or paste the report text instead.";
  }
  if (raw.length > 180) return "Import failed. Please try a smaller PDF or paste the text.";
  return raw || "Import failed.";
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const engineRaw = form.get("engine");
      const engine = typeof engineRaw === "string" ? engineRaw : null;
      if (!isEngine(engine)) {
        return clientError("engine must be adhd or asd", 400);
      }

      const file = form.get("file");
      const pasted = form.get("text");

      if (file instanceof File) {
        const okType =
          file.type === "application/pdf" ||
          file.type === "application/x-pdf" ||
          file.name.toLowerCase().endsWith(".pdf");
        if (!okType) {
          return clientError("Only PDF files are supported.", 400);
        }
        if (file.size <= 0) {
          return clientError("The PDF file is empty.", 400);
        }
        if (file.size > MAX_PDF_BYTES) {
          return clientError("PDF must be under 20MB.", 400);
        }
        const buffer = Buffer.from(await file.arrayBuffer());
        const result = await importTexlexReportFromPdf(engine, buffer);
        if (!result.success) {
          return clientError(result.error || "Import failed.", 422);
        }
        return Response.json(result);
      }

      if (typeof pasted === "string" && pasted.trim()) {
        if (pasted.length > MAX_PASTE_CHARS) {
          return clientError("Pasted text is too long. Upload the PDF instead.", 400);
        }
        const result = await importTexlexReportFromText(engine, pasted);
        if (!result.success) {
          return clientError(result.error || "Import failed.", 422);
        }
        return Response.json(result);
      }

      return clientError("Provide a PDF file or pasted report text.", 400);
    }

    let body: { engine?: string; text?: string };
    try {
      body = (await req.json()) as { engine?: string; text?: string };
    } catch {
      return clientError("Invalid JSON body.", 400);
    }

    if (!isEngine(body.engine)) {
      return clientError("engine must be adhd or asd", 400);
    }
    if (typeof body.text !== "string" || !body.text.trim()) {
      return clientError("text is required", 400);
    }
    if (body.text.length > MAX_PASTE_CHARS) {
      return clientError("Pasted text is too long. Upload the PDF instead.", 400);
    }

    const result = await importTexlexReportFromText(body.engine, body.text);
    if (!result.success) {
      return clientError(result.error || "Import failed.", 422);
    }
    return Response.json(result);
  } catch (e) {
    console.error("[report-import]", e);
    return clientError(safeFailMessage(e), 500);
  }
}
