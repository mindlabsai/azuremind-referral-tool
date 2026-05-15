import { A1_SYSTEM_PROMPT, buildA1UserPrompt, type A1PromptVariables } from "@/lib/prompts/a1-template";
import { createCriterionGeneratePostHandler } from "@/lib/api/texlex-criterion-generate-route";

export const runtime = "nodejs";
export const maxDuration = 120;

export const POST = createCriterionGeneratePostHandler({
  criterionCode: "A1",
  systemPrompt: A1_SYSTEM_PROMPT,
  buildUserPrompt: (body) => buildA1UserPrompt(body as unknown as A1PromptVariables),
});
