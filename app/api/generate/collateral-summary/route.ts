import { NextRequest } from "next/server";
import {
  COLLATERAL_SUMMARY_SYSTEM_PROMPT,
  buildCollateralSummaryUserPrompt,
  type CollateralSummaryVariables,
} from "@/lib/prompts/collateral-summary-template";
import { resolveTexlexDiagnosticConclusion } from "@/lib/texlex-diagnostic-conclusion";
import { createTexlexStreamResponseWithVoiceCritic } from "@/lib/voice/texlex-stream-with-voice-critic";

export const runtime = "nodejs";
export const maxDuration = 120;

const COLLATERAL_SUMMARY_MAX_OUTPUT_TOKENS = 4096;

type CollateralSummaryRequestBody = CollateralSummaryVariables & {
  patientDetails?: Record<string, unknown>;
  ratingsAssigned?: Record<string, unknown>;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CollateralSummaryRequestBody;

    if (!body.rawNotes || body.rawNotes.trim().length < 20) {
      return new Response(
        JSON.stringify({ error: "Raw clinical notes required (minimum 20 characters)" }),
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

    const userPrompt = buildCollateralSummaryUserPrompt(vars);
    const patientDetails =
      body.patientDetails && typeof body.patientDetails === "object" ? body.patientDetails : {};
    const ratingsAssigned =
      body.ratingsAssigned && typeof body.ratingsAssigned === "object" ? body.ratingsAssigned : {};

    return createTexlexStreamResponseWithVoiceCritic({
      req,
      logLabel: "Collateral summary",
      criticSectionType: "collateral_summary",
      maxTokens: COLLATERAL_SUMMARY_MAX_OUTPUT_TOKENS,
      systemPrompt: COLLATERAL_SUMMARY_SYSTEM_PROMPT,
      userPrompt,
      caseContext: {
        patientDetails,
        rawNotes: body.rawNotes,
        diagnosticConclusion: conclusion,
        ratingsAssigned,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
