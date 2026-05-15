import { B4_SYSTEM_PROMPT, buildB4UserPrompt, type B4PromptVariables } from "@/lib/prompts/b4-template";
import { createCriterionGeneratePostHandler } from "@/lib/api/texlex-criterion-generate-route";

export const runtime = "nodejs";
export const maxDuration = 120;

export const POST = createCriterionGeneratePostHandler({
  criterionCode: "B4",
  systemPrompt: B4_SYSTEM_PROMPT,
  buildUserPrompt: (body) => buildB4UserPrompt(body as unknown as B4PromptVariables),
});
