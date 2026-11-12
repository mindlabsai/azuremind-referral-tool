import { NextRequest } from "next/server";
import {
  readReferralFromPdf,
  readReferralFromText,
} from "@/lib/referral-reader/extract";

export const runtime = "nodejs";
export const maxDuration = 90;

const MAX_PDF_BYTES = 15 * 1024 * 1024;
const MAX_PASTE_CHARS = 200_000;

function clientError(message: string, status: number) {
  return Response.json({ success: false, error: message }, { status });
}

function safeFailMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/ANTHROPIC|api key|ECONN|ETIMEDOUT|fetch failed|pdf-parse|ENOENT/i.test(raw)) {
    return "Could not read that referral. Try again, or paste the text.";
  }
  if (raw.length > 180) return "Referral reader failed. Try a smaller PDF or paste the text.";
  return raw || "Referral reader failed.";
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      const pasted = form.get("text");

      if (file instanceof File) {
        const okType =
          file.type === "application/pdf" ||
          file.type === "application/x-pdf" ||
          file.name.toLowerCase().endsWith(".pdf");
        if (!okType) return clientError("Only PDF files are supported.", 400);
        if (file.size <= 0) return clientError("The PDF file is empty.", 400);
        if (file.size > MAX_PDF_BYTES) return clientError("PDF must be under 15MB.", 400);
        const buffer = Buffer.from(await file.arrayBuffer());
        const result = await readReferralFromPdf(buffer);
        if (!result.success) return clientError(result.error || "Read failed.", 422);
        return Response.json(result);
      }

      if (typeof pasted === "string" && pasted.trim()) {
        if (pasted.length > MAX_PASTE_CHARS) {
          return clientError("Pasted text is too long. Upload the PDF instead.", 400);
        }
        const result = await readReferralFromText(pasted);
        if (!result.success) return clientError(result.error || "Read failed.", 422);
        return Response.json(result);
      }

      return clientError("Upload a referral PDF or paste the referral text.", 400);
    }

    const body = (await req.json()) as { text?: string };
    if (typeof body.text === "string" && body.text.trim()) {
      if (body.text.length > MAX_PASTE_CHARS) {
        return clientError("Pasted text is too long.", 400);
      }
      const result = await readReferralFromText(body.text);
      if (!result.success) return clientError(result.error || "Read failed.", 422);
      return Response.json(result);
    }

    return clientError("Upload a referral PDF or paste the referral text.", 400);
  } catch (e) {
    console.error("[referral-reader]", e);
    return clientError(safeFailMessage(e), 500);
  }
}
