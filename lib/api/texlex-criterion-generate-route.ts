import { NextRequest } from "next/server";
import { createTexlexStreamResponseWithVoiceCritic } from "@/lib/voice/texlex-stream-with-voice-critic";
import { criticSectionTypeForCriterion } from "@/lib/voice/texlex-voice-critic";

const CRITERION_MAX_OUTPUT_TOKENS = 2048;

type CriterionGenerateConfig = {
  criterionCode: string;
  systemPrompt: string;
  buildUserPrompt: (body: CriterionRequestBody) => string;
};

type CriterionRequestBody = Record<string, unknown> & {
  rawNotes?: string;
  patientDetails?: Record<string, unknown>;
  diagnosticConclusion?: string;
  ratingsAssigned?: Record<string, unknown>;
};

export function createCriterionGeneratePostHandler(config: CriterionGenerateConfig) {
  return async function POST(req: NextRequest) {
    try {
      const body = (await req.json()) as CriterionRequestBody;

      if (!body.rawNotes || String(body.rawNotes).trim().length < 20) {
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

      const userPrompt = config.buildUserPrompt(body);
      const patientDetails =
        body.patientDetails && typeof body.patientDetails === "object" ? body.patientDetails : {};
      const ratingsAssigned =
        body.ratingsAssigned && typeof body.ratingsAssigned === "object"
          ? body.ratingsAssigned
          : {};
      const diagnosticConclusion =
        typeof body.diagnosticConclusion === "string" ? body.diagnosticConclusion : "";

      return createTexlexStreamResponseWithVoiceCritic({
        req,
        logLabel: `Criterion ${config.criterionCode}`,
        criticSectionType: criticSectionTypeForCriterion(config.criterionCode),
        maxTokens: CRITERION_MAX_OUTPUT_TOKENS,
        systemPrompt: config.systemPrompt,
        userPrompt,
        caseContext: {
          patientDetails,
          rawNotes: String(body.rawNotes),
          diagnosticConclusion,
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
  };
}
