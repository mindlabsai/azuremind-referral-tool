import { NextRequest } from "next/server";
import {
  importTexlexReportFromPdf,
  importTexlexReportFromText,
} from "@/lib/texlex-report-import/import-report";
import type { TexlexEngineId } from "@/lib/texlex-report-state";

export const runtime = "nodejs";
export const maxDuration = 120;

function isEngine(value: unknown): value is TexlexEngineId {
  return value === "adhd" || value === "asd";
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const engineRaw = form.get("engine");
      const engine = typeof engineRaw === "string" ? engineRaw : null;
      if (!isEngine(engine)) {
        return Response.json({ success: false, error: "engine must be adhd or asd" }, { status: 400 });
      }
      const file = form.get("file");
      const pasted = form.get("text");
      if (file instanceof File) {
        const okType =
          file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        if (!okType) {
          return Response.json({ success: false, error: "Only PDF files are supported." }, { status: 400 });
        }
        if (file.size > 20 * 1024 * 1024) {
          return Response.json({ success: false, error: "PDF must be under 20MB." }, { status: 400 });
        }
        const buffer = Buffer.from(await file.arrayBuffer());
        const result = await importTexlexReportFromPdf(engine, buffer);
        return Response.json(result, { status: result.success ? 200 : 422 });
      }
      if (typeof pasted === "string" && pasted.trim()) {
        const result = await importTexlexReportFromText(engine, pasted);
        return Response.json(result, { status: result.success ? 200 : 422 });
      }
      return Response.json(
        { success: false, error: "Provide a PDF file or pasted report text." },
        { status: 400 }
      );
    }

    const body = (await req.json()) as { engine?: string; text?: string };
    if (!isEngine(body.engine)) {
      return Response.json({ success: false, error: "engine must be adhd or asd" }, { status: 400 });
    }
    if (typeof body.text !== "string" || !body.text.trim()) {
      return Response.json({ success: false, error: "text is required" }, { status: 400 });
    }
    const result = await importTexlexReportFromText(body.engine, body.text);
    return Response.json(result, { status: result.success ? 200 : 422 });
  } catch (e) {
    return Response.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
