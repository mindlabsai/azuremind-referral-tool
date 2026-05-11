import { NextRequest } from "next/server";
import { anthropic, MODELS } from "@/lib/anthropic-client";
import { A2_SYSTEM_PROMPT, buildA2UserPrompt, type A2PromptVariables } from "@/lib/prompts/a2-template";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as A2PromptVariables;

    if (!body.rawNotes || body.rawNotes.trim().length < 20) {
      return new Response(
        JSON.stringify({ error: "Raw clinical notes required (minimum 20 characters)" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userPrompt = buildA2UserPrompt(body);

    const stream = await anthropic.messages.create({
      model: MODELS.OPUS,
      max_tokens: 2048,
      stream: true,
      system: [
        {
          type: "text",
          text: A2_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              const data = JSON.stringify({ delta: event.delta.text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
            if (event.type === "message_delta" && event.delta.stop_reason) {
              const data = JSON.stringify({ done: true, stop_reason: event.delta.stop_reason });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
            if (event.type === "message_stop") {
              controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            }
          }
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
