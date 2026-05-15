import { NextRequest } from "next/server";
import {
  FUNCTIONAL_IMPACT_SYSTEM_PROMPT,
  buildFunctionalImpactUserPrompt,
  type FunctionalImpactVariables,
} from "@/lib/prompts/functional-impact-template";
import { resolveTexlexDiagnosticConclusion } from "@/lib/texlex-diagnostic-conclusion";
import { createTexlexStreamResponseWithVoiceCritic } from "@/lib/voice/texlex-stream-with-voice-critic";

export const runtime = "nodejs";
export const maxDuration = 120;

const FUNCTIONAL_IMPACT_MAX_OUTPUT_TOKENS = 4096;

type FunctionalImpactRequestBody = FunctionalImpactVariables & {
  patientDetails?: Record<string, unknown>;
  diagnosticConclusion?: string;
  ratingsAssigned?: Record<string, unknown>;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as FunctionalImpactRequestBody;

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

    const userPrompt = buildFunctionalImpactUserPrompt(body);
    const conclusion = resolveTexlexDiagnosticConclusion(body.diagnosticConclusion);
    const patientDetails =
      body.patientDetails && typeof body.patientDetails === "object" ? body.patientDetails : {};
    const ratingsAssigned =
      body.ratingsAssigned && typeof body.ratingsAssigned === "object" ? body.ratingsAssigned : {};

    return createTexlexStreamResponseWithVoiceCritic({
      req,
      logLabel: "Functional Impact",
      criticSectionType: "functional_impact",
      maxTokens: FUNCTIONAL_IMPACT_MAX_OUTPUT_TOKENS,
      systemPrompt: FUNCTIONAL_IMPACT_SYSTEM_PROMPT,
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
