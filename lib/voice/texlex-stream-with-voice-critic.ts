import type { NextRequest } from "next/server";
import { anthropic } from "@/lib/anthropic-client";
import {
  runVoiceCriticPostStep,
  VOICE_CRITIC_PASS1_MODEL,
  type VoiceCriticCaseContext,
} from "@/lib/voice/texlex-voice-critic";

type StreamConfig = {
  req: NextRequest;
  logLabel: string;
  criticSectionType: string;
  pass1Model?: string;
  maxTokens: number;
  systemPrompt: string;
  userPrompt: string;
  caseContext: VoiceCriticCaseContext;
};

export function createTexlexStreamResponseWithVoiceCritic(config: StreamConfig): Response {
  const pass1Model = config.pass1Model ?? VOICE_CRITIC_PASS1_MODEL;

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      let pass1Draft = "";
      try {
        const stream = await anthropic.messages.create({
          model: pass1Model,
          max_tokens: config.maxTokens,
          stream: true,
          system: [
            {
              type: "text",
              text: config.systemPrompt,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [{ role: "user", content: config.userPrompt }],
        });

        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            pass1Draft += event.delta.text;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ delta: event.delta.text })}\n\n`)
            );
          }
          if (event.type === "message_delta" && event.delta.stop_reason) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ done: true, stop_reason: event.delta.stop_reason })}\n\n`
              )
            );
          }
        }

        const {
          finalContent,
          criticApplied,
          fallbackToDraft,
          criticDisabled,
          model,
        } = await runVoiceCriticPostStep(
          config.req,
          config.logLabel,
          config.criticSectionType,
          pass1Draft,
          config.caseContext,
          pass1Model
        );

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              content: finalContent,
              replaceContent: finalContent !== pass1Draft,
              criticApplied,
              fallbackToDraft,
              criticDisabled,
              model,
              truncationWarning: null,
            })}\n\n`
          )
        );
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Stream error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
