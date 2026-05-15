import type { NextRequest } from "next/server";
import { anthropic, MODELS } from "@/lib/anthropic-client";
import {
  createCollateralPass1Message,
  type CollateralDocumentProcessingStatus,
  type CollateralPdfDocumentInput,
} from "@/lib/collateral/collateral-pdf-message";
import {
  runVoiceCriticPostStep,
  VOICE_CRITIC_PASS1_MODEL,
  type VoiceCriticCaseContext,
} from "@/lib/voice/texlex-voice-critic";

export type CollateralSummaryStreamInput = {
  req: NextRequest;
  systemPrompt: string;
  userPromptText: string;
  caseContext: VoiceCriticCaseContext;
  pdfs: CollateralPdfDocumentInput[];
  unsupportedDocuments: Array<{ id: string; filename: string; mimeType: string }>;
  pendingDocuments: Array<{ id: string; filename: string }>;
  maxTokens?: number;
};

export function createCollateralSummaryStreamResponse(
  input: CollateralSummaryStreamInput
): Response {
  const pass1Model = VOICE_CRITIC_PASS1_MODEL;
  const maxTokens = input.maxTokens ?? 4096;
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      let pass1Draft = "";
      const documentProcessing: CollateralDocumentProcessingStatus[] = [
        ...input.unsupportedDocuments.map((d) => ({
          id: d.id,
          filename: d.filename,
          status: "unsupported" as const,
          detail: "Format not yet supported for AI summarisation",
        })),
        ...input.pendingDocuments.map((d) => ({
          id: d.id,
          filename: d.filename,
          status: "pending" as const,
          detail: "PDF not ready or not uploaded with readable content",
        })),
      ];

      try {
        if (input.pdfs.length === 0) {
          const stream = await anthropic.messages.create({
            model: pass1Model,
            max_tokens: maxTokens,
            stream: true,
            system: [
              {
                type: "text",
                text: input.systemPrompt,
                cache_control: { type: "ephemeral" },
              },
            ],
            messages: [{ role: "user", content: input.userPromptText }],
          });
          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              pass1Draft += event.delta.text;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ delta: event.delta.text })}\n\n`)
              );
            }
          }
        } else {
          const { message, processedPdfs, failedPdfs } = await createCollateralPass1Message(
            anthropic,
            {
              model: pass1Model,
              maxTokens,
              systemPrompt: input.systemPrompt,
              userPromptText: input.userPromptText,
              pdfs: input.pdfs,
            }
          );

          for (const pdf of processedPdfs) {
            documentProcessing.push({
              id: pdf.id,
              filename: pdf.filename,
              status: "processed",
            });
          }
          for (const f of failedPdfs) {
            documentProcessing.push({
              id: f.id,
              filename: f.filename,
              status: "failed",
              detail: f.detail,
            });
          }

          pass1Draft =
            message.content
              .filter((block): block is Anthropic.TextBlock => block.type === "text")
              .map((block) => block.text)
              .join("") ?? "";

          if (pass1Draft) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ delta: pass1Draft })}\n\n`)
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
          input.req,
          "Collateral summary",
          "collateral_summary",
          pass1Draft,
          input.caseContext,
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
              documentProcessing,
            })}\n\n`
          )
        );
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Stream error";
        console.error("[Texlex] Collateral summary generation failed:", err);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              error: message,
              documentProcessing,
            })}\n\n`
          )
        );
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
