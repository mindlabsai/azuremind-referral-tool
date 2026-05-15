import { A2_SYSTEM_PROMPT, buildA2UserPrompt, type A2PromptVariables } from "@/lib/prompts/a2-template";
import { createCriterionGeneratePostHandler } from "@/lib/api/texlex-criterion-generate-route";

export const runtime = "nodejs";
export const maxDuration = 120;

export const POST = createCriterionGeneratePostHandler({
  criterionCode: "A2",
  systemPrompt: A2_SYSTEM_PROMPT,
  buildUserPrompt: (body) => buildA2UserPrompt(body as unknown as A2PromptVariables),
});
