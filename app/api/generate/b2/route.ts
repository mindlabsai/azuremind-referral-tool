import { B2_SYSTEM_PROMPT, buildB2UserPrompt, type B2PromptVariables } from "@/lib/prompts/b2-template";
import { createCriterionGeneratePostHandler } from "@/lib/api/texlex-criterion-generate-route";

export const runtime = "nodejs";
export const maxDuration = 120;

export const POST = createCriterionGeneratePostHandler({
  criterionCode: "B2",
  systemPrompt: B2_SYSTEM_PROMPT,
  buildUserPrompt: (body) => buildB2UserPrompt(body as unknown as B2PromptVariables),
});
