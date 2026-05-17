import { C_SYSTEM_PROMPT, buildCUserPrompt, type CPromptVariables } from "@/lib/prompts/c-template";
import { createCriterionGeneratePostHandler } from "@/lib/api/texlex-criterion-generate-route";

export const runtime = "nodejs";
export const maxDuration = 120;

function bodyToCPromptVariables(body: Record<string, unknown>): CPromptVariables {
  return {
    diagnosticConclusion:
      typeof body.diagnosticConclusion === "string" ? body.diagnosticConclusion : "",
    clientName: typeof body.clientName === "string" ? body.clientName : "",
    chronologicalAge: typeof body.chronologicalAge === "string" ? body.chronologicalAge : "",
    pronouns: typeof body.pronouns === "string" ? body.pronouns : "",
    background: typeof body.background === "string" ? body.background : "",
  };
}

export const POST = createCriterionGeneratePostHandler({
  criterionCode: "C",
  systemPrompt: C_SYSTEM_PROMPT,
  buildUserPrompt: (body) => buildCUserPrompt(bodyToCPromptVariables(body)),
});
