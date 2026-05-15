import { B3_SYSTEM_PROMPT, buildB3UserPrompt, type B3PromptVariables } from "@/lib/prompts/b3-template";
import { createCriterionGeneratePostHandler } from "@/lib/api/texlex-criterion-generate-route";

export const runtime = "nodejs";
export const maxDuration = 120;

export const POST = createCriterionGeneratePostHandler({
  criterionCode: "B3",
  systemPrompt: B3_SYSTEM_PROMPT,
  buildUserPrompt: (body) => buildB3UserPrompt(body as unknown as B3PromptVariables),
});
