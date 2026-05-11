import Anthropic from "@anthropic-ai/sdk";

export const MODELS = {
  OPUS: process.env.ANTHROPIC_OPUS_MODEL ?? "claude-opus-4-7",
} as const;

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? undefined,
});
