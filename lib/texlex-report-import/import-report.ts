import type { TexlexEngineId } from "@/lib/texlex-report-state";
import { extractTextFromPdfBuffer } from "./extract-pdf";
import { splitTexlexReportByHeadings } from "./heading-split";
import { mapReportWithLlm } from "./llm-map";
import { normalizeImportedReportText } from "./normalize";
import { finalizeImportedReport } from "./scrub-content";
import type { ImportReportResult, TexlexImportedReport } from "./types";

function needsLlm(result: TexlexImportedReport): boolean {
  if (result.confidence === "low") return true;
  if (result.filledSectionLabels.length < 3) return true;
  if (result.engine === "asd" && !result.sections.criteria) return true;
  if (result.engine === "asd") {
    const crit = result.sections.criteria ?? {};
    const count = Object.keys(crit).length;
    const rated = Object.values(crit).filter((c) => c && c.rating !== null).length;
    if (count < 8) return true;
    if (rated < 6) return true;
    if (!result.patientDetails.clientName) return true;
  }
  if (result.warnings.some((w) => /junk|not detected|not all asd criteria/i.test(w))) return true;
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
  if (text.length > 400_000) {
    return {
      success: false,
      error: "Report text is too long to import safely. Try a smaller PDF.",
    };
  }

  let heading: TexlexImportedReport;
  try {
    heading = finalizeImportedReport(splitTexlexReportByHeadings(text, engine));
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Could not read report sections.",
    };
  }

  try {
    if (!needsLlm(heading)) {
      return { success: true, import: heading };
    }
    const hybrid = finalizeImportedReport(await mapReportWithLlm(engine, text, heading));
    if (hybrid.filledSectionLabels.length === 0 && heading.filledSectionLabels.length === 0) {
      return {
        success: false,
        error: "Could not map any report sections. Try pasting the full report text.",
      };
    }
    // Prefer hybrid if it found anything; otherwise keep heading-only result.
    const chosen =
      hybrid.filledSectionLabels.length >= heading.filledSectionLabels.length ? hybrid : heading;
    return {
      success: true,
      import: {
        ...chosen,
        diagnosticConclusion:
          chosen.diagnosticConclusion ?? heading.diagnosticConclusion ?? null,
        warnings:
          chosen === heading && hybrid.filledSectionLabels.length < heading.filledSectionLabels.length
            ? [
                ...heading.warnings,
                "AI gap-fill did not improve coverage — using heading split only.",
              ]
            : chosen.warnings,
      },
    };
  } catch (err) {
    if (heading.filledSectionLabels.length > 0) {
      return {
        success: true,
        import: {
          ...heading,
          warnings: [
            ...heading.warnings,
            "AI gap-fill was unavailable. Using heading split only — review carefully.",
          ],
        },
      };
    }
    return {
      success: false,
      error: "Import failed. Try pasting the report text instead of the PDF.",
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
