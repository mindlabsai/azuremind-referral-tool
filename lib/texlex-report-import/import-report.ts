import type { TexlexEngineId } from "@/lib/texlex-report-state";
import { extractTextFromPdfBuffer } from "./extract-pdf";
import { splitTexlexReportByHeadings } from "./heading-split";
import { mapReportWithLlm } from "./llm-map";
import { normalizeImportedReportText } from "./normalize";
import type { ImportReportResult, TexlexImportedReport } from "./types";

function needsLlm(result: TexlexImportedReport): boolean {
  if (result.confidence === "low") return true;
  if (result.filledSectionLabels.length < 3) return true;
  // ASD without any criteria often needs help
  if (result.engine === "asd" && !result.sections.criteria) return true;
  return false;
}

export async function importTexlexReportFromText(
  engine: TexlexEngineId,
  rawText: string
): Promise<ImportReportResult> {
  const text = normalizeImportedReportText(rawText);
  if (text.length < 80) {
    return { success: false, error: "Report text is too short to import." };
  }

  const heading = splitTexlexReportByHeadings(text, engine);

  try {
    if (!needsLlm(heading)) {
      return { success: true, import: heading };
    }
    const hybrid = await mapReportWithLlm(engine, text, heading);
    if (hybrid.filledSectionLabels.length === 0) {
      return {
        success: false,
        error: "Could not map any report sections. Try pasting the full report text.",
      };
    }
    return { success: true, import: hybrid };
  } catch (err) {
    // If LLM fails but heading split found content, still return heading result
    if (heading.filledSectionLabels.length > 0) {
      return {
        success: true,
        import: {
          ...heading,
          warnings: [
            ...heading.warnings,
            `AI gap-fill failed (${err instanceof Error ? err.message : String(err)}). Using heading split only — review carefully.`,
          ],
        },
      };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Import failed",
    };
  }
}

export async function importTexlexReportFromPdf(
  engine: TexlexEngineId,
  buffer: Buffer
): Promise<ImportReportResult> {
  let text = "";
  try {
    text = await extractTextFromPdfBuffer(buffer);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "PDF text extraction failed",
    };
  }
  if (!text.trim()) {
    return {
      success: false,
      error: "No readable text found in this PDF. It may be a scanned image — paste the text instead.",
    };
  }
  return importTexlexReportFromText(engine, text);
}
