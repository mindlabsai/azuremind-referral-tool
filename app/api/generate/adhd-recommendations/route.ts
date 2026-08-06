import { NextRequest } from "next/server";
import {
  ADHD_RECOMMENDATIONS_SYSTEM_PROMPT,
  buildAdhdRecommendationsUserPrompt,
  type AdhdRecommendationsVariables,
} from "@/lib/prompts/adhd-recommendations-template";
import { createTexlexStreamResponseWithVoiceCritic } from "@/lib/voice/texlex-stream-with-voice-critic";

export const runtime = "nodejs";
export const maxDuration = 120;

const ADHD_RECOMMENDATIONS_MAX_OUTPUT_TOKENS = 4096;

type AdhdRecommendationsRequestBody = AdhdRecommendationsVariables & {
  patientDetails?: Record<string, unknown>;
  diagnosticConclusion?: string;
  ratingsAssigned?: Record<string, unknown>;
  ageYears?: number;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AdhdRecommendationsRequestBody;

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

    const vars: AdhdRecommendationsVariables = {
      clientName: typeof body.clientName === "string" ? body.clientName : "",
      pronouns: typeof body.pronouns === "string" ? body.pronouns : "",
      chronologicalAge: typeof body.chronologicalAge === "string" ? body.chronologicalAge : "",
      yearLevel: typeof body.yearLevel === "string" ? body.yearLevel : "",
      referringPractitioner:
        typeof body.referringPractitioner === "string" ? body.referringPractitioner : "",
      referringPractitionerType:
        typeof body.referringPractitionerType === "string" ? body.referringPractitionerType : "",
      school: typeof body.school === "string" ? body.school : "",
      rawNotes: body.rawNotes,
      formulation: typeof body.formulation === "string" ? body.formulation : "",
      engineContext: typeof body.engineContext === "string" ? body.engineContext : "",
    };

    const userPrompt = buildAdhdRecommendationsUserPrompt(vars);
    const patientDetails =
      body.patientDetails && typeof body.patientDetails === "object" ? body.patientDetails : {};
    const ratingsAssigned =
      body.ratingsAssigned && typeof body.ratingsAssigned === "object" ? body.ratingsAssigned : {};
    const diagnosticConclusion =
      typeof body.diagnosticConclusion === "string" && body.diagnosticConclusion.trim()
        ? body.diagnosticConclusion.trim()
        : "ADHD assessment — diagnostic conclusion not finalised in engine";

    return createTexlexStreamResponseWithVoiceCritic({
      req,
      logLabel: "ADHD Recommendations",
      criticSectionType: "recommendations",
      maxTokens: ADHD_RECOMMENDATIONS_MAX_OUTPUT_TOKENS,
      systemPrompt: ADHD_RECOMMENDATIONS_SYSTEM_PROMPT,
      userPrompt,
      caseContext: {
        patientDetails,
        rawNotes: body.rawNotes,
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
}
