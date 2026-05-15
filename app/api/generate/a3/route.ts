import { A3_SYSTEM_PROMPT, buildA3UserPrompt, type A3PromptVariables } from "@/lib/prompts/a3-template";
import { createCriterionGeneratePostHandler } from "@/lib/api/texlex-criterion-generate-route";

export const runtime = "nodejs";
export const maxDuration = 120;

export const POST = createCriterionGeneratePostHandler({
  criterionCode: "A3",
  systemPrompt: A3_SYSTEM_PROMPT,
  buildUserPrompt: (body) => buildA3UserPrompt(body as unknown as A3PromptVariables),
});
