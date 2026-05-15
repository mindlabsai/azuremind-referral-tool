import { B1_SYSTEM_PROMPT, buildB1UserPrompt, type B1PromptVariables } from "@/lib/prompts/b1-template";
import { createCriterionGeneratePostHandler } from "@/lib/api/texlex-criterion-generate-route";

export const runtime = "nodejs";
export const maxDuration = 120;

export const POST = createCriterionGeneratePostHandler({
  criterionCode: "B1",
  systemPrompt: B1_SYSTEM_PROMPT,
  buildUserPrompt: (body) => buildB1UserPrompt(body as unknown as B1PromptVariables),
});
