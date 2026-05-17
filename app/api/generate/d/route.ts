import { D_SYSTEM_PROMPT, buildDUserPrompt, type DPromptVariables } from "@/lib/prompts/d-template";
import { createCriterionGeneratePostHandler } from "@/lib/api/texlex-criterion-generate-route";

export const runtime = "nodejs";
export const maxDuration = 120;

function bodyToDPromptVariables(body: Record<string, unknown>): DPromptVariables {
  return {
    diagnosticConclusion:
      typeof body.diagnosticConclusion === "string" ? body.diagnosticConclusion : "",
    clientName: typeof body.clientName === "string" ? body.clientName : "",
    chronologicalAge: typeof body.chronologicalAge === "string" ? body.chronologicalAge : "",
    pronouns: typeof body.pronouns === "string" ? body.pronouns : "",
    functionalImpactSummary:
      typeof body.functionalImpactSummary === "string" ? body.functionalImpactSummary : "",
  };
}

export const POST = createCriterionGeneratePostHandler({
  criterionCode: "D",
  systemPrompt: D_SYSTEM_PROMPT,
  buildUserPrompt: (body) => buildDUserPrompt(bodyToDPromptVariables(body)),
});
