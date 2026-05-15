import { NextRequest } from "next/server";
import { createCollateralSummaryStreamResponse } from "@/lib/collateral/collateral-summary-stream";
import type { CollateralPdfDocumentInput } from "@/lib/collateral/collateral-pdf-message";
import {
  COLLATERAL_SUMMARY_SYSTEM_PROMPT,
  buildCollateralSummaryUserPrompt,
  type CollateralSummaryVariables,
} from "@/lib/prompts/collateral-summary-template";
import { resolveTexlexDiagnosticConclusion } from "@/lib/texlex-diagnostic-conclusion";

export const runtime = "nodejs";
export const maxDuration = 120;

const COLLATERAL_SUMMARY_MAX_OUTPUT_TOKENS = 4096;

type CollateralPdfDocumentBody = {
  id: string;
  filename: string;
  category?: string;
  data: string;
};

type CollateralSummaryRequestBody = CollateralSummaryVariables & {
  patientDetails?: Record<string, unknown>;
  ratingsAssigned?: Record<string, unknown>;
  collateralPdfDocuments?: CollateralPdfDocumentBody[];
  unsupportedCollateralDocuments?: Array<{ id: string; filename: string; mimeType: string }>;
  pendingCollateralDocuments?: Array<{ id: string; filename: string }>;
};

function normalisePdfDocuments(raw: unknown): CollateralPdfDocumentInput[] {
  if (!Array.isArray(raw)) return [];
  const out: CollateralPdfDocumentInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const data = typeof o.data === "string" ? o.data.trim() : "";
    const id = typeof o.id === "string" ? o.id : "";
    const filename = typeof o.filename === "string" ? o.filename : "Collateral PDF";
    if (!data || !id) continue;
    out.push({
      id,
      filename,
      category: typeof o.category === "string" ? o.category : undefined,
      data,
    });
  }
  return out;
}

function normaliseDocRefs(
  raw: unknown
): Array<{ id: string; filename: string; mimeType?: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ id: string; filename: string; mimeType?: string }> = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const filename = typeof o.filename === "string" ? o.filename : "Document";
    if (!id) continue;
    out.push({
      id,
      filename,
      mimeType: typeof o.mimeType === "string" ? o.mimeType : undefined,
    });
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CollateralSummaryRequestBody;

    const pdfs = normalisePdfDocuments(body.collateralPdfDocuments);
    const rawNotes = body.rawNotes?.trim() ?? "";
    const collateralContent = body.collateralContent?.trim() ?? "";
    const hasReadyPdfs = pdfs.length > 0;
    const hasEnoughText =
      rawNotes.length >= 20 || collateralContent.length >= 20;

    if (!hasEnoughText && !hasReadyPdfs) {
      return new Response(
        JSON.stringify({
          error:
            "Raw clinical notes, collateral manifest, or at least one ready PDF required (minimum 20 characters of text context, or PDF documents attached).",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const conclusion = resolveTexlexDiagnosticConclusion(body.diagnosticConclusion);
    const vars: CollateralSummaryVariables = {
      clientName: body.clientName ?? "",
      pronouns: body.pronouns ?? "",
      chronologicalAge: body.chronologicalAge ?? "",
      yearLevel: body.yearLevel ?? "",
      rawNotes: body.rawNotes ?? "",
      collateralContent: body.collateralContent ?? "",
      diagnosticConclusion: conclusion,
    };

    const userPromptText = buildCollateralSummaryUserPrompt(vars);
    const patientDetails =
      body.patientDetails && typeof body.patientDetails === "object" ? body.patientDetails : {};
    const ratingsAssigned =
      body.ratingsAssigned && typeof body.ratingsAssigned === "object" ? body.ratingsAssigned : {};

    const unsupported = normaliseDocRefs(body.unsupportedCollateralDocuments).map((d) => ({
      id: d.id,
      filename: d.filename,
      mimeType: d.mimeType ?? "application/octet-stream",
    }));
    const pending = normaliseDocRefs(body.pendingCollateralDocuments).map((d) => ({
      id: d.id,
      filename: d.filename,
    }));

    return createCollateralSummaryStreamResponse({
      req,
      systemPrompt: COLLATERAL_SUMMARY_SYSTEM_PROMPT,
      userPromptText,
      pdfs,
      unsupportedDocuments: unsupported,
      pendingDocuments: pending,
      caseContext: {
        patientDetails,
        rawNotes: body.rawNotes ?? "",
        diagnosticConclusion: conclusion,
        ratingsAssigned,
      },
      maxTokens: COLLATERAL_SUMMARY_MAX_OUTPUT_TOKENS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
