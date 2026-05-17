import { E_SYSTEM_PROMPT, buildEUserPrompt, type EPromptVariables } from "@/lib/prompts/e-template";
import { createCriterionGeneratePostHandler } from "@/lib/api/texlex-criterion-generate-route";

export const runtime = "nodejs";
export const maxDuration = 120;

function bodyToEPromptVariables(body: Record<string, unknown>): EPromptVariables {
  return {
    diagnosticConclusion:
      typeof body.diagnosticConclusion === "string" ? body.diagnosticConclusion : "",
    clientName: typeof body.clientName === "string" ? body.clientName : "",
    chronologicalAge: typeof body.chronologicalAge === "string" ? body.chronologicalAge : "",
    pronouns: typeof body.pronouns === "string" ? body.pronouns : "",
  };
}

export const POST = createCriterionGeneratePostHandler({
  criterionCode: "E",
  systemPrompt: E_SYSTEM_PROMPT,
  buildUserPrompt: (body) => buildEUserPrompt(bodyToEPromptVariables(body)),
});
