import type Anthropic from "@anthropic-ai/sdk";

export type CollateralPdfDocumentInput = {
  id: string;
  filename: string;
  category?: string;
  data: string;
};

export type CollateralDocumentProcessingStatus = {
  id: string;
  filename: string;
  status: "processed" | "failed" | "unsupported" | "pending";
  detail?: string;
};

function stripBase64Whitespace(data: string): string {
  return data.replace(/\s+/g, "");
}

export function buildCollateralUserMessageContent(
  pdfs: CollateralPdfDocumentInput[],
  userPromptText: string
): Anthropic.MessageParam["content"] {
  const blocks: Anthropic.ContentBlockParam[] = [];

  for (const pdf of pdfs) {
    const header = pdf.category
      ? `Collateral PDF: ${pdf.filename} (category: ${pdf.category})`
      : `Collateral PDF: ${pdf.filename}`;
    blocks.push({ type: "text", text: header });
    blocks.push({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: stripBase64Whitespace(pdf.data),
      },
    });
  }

  blocks.push({ type: "text", text: userPromptText });
  return blocks;
}

function isRetryablePdfError(err: unknown): boolean {
  if (!(err instanceof Error)) return true;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("document") ||
    msg.includes("pdf") ||
    msg.includes("invalid") ||
    msg.includes("400") ||
    msg.includes("could not process")
  );
}

export async function createCollateralPass1Message(
  client: Anthropic,
  options: {
    model: string;
    maxTokens: number;
    systemPrompt: string;
    userPromptText: string;
    pdfs: CollateralPdfDocumentInput[];
  }
): Promise<{
  message: Anthropic.Message;
  processedPdfs: CollateralPdfDocumentInput[];
  failedPdfs: Array<{ id: string; filename: string; detail: string }>;
}> {
  const { model, maxTokens, systemPrompt, userPromptText, pdfs } = options;
  let remaining = [...pdfs];
  const failedPdfs: Array<{ id: string; filename: string; detail: string }> = [];

  while (remaining.length > 0) {
    const content = buildCollateralUserMessageContent(remaining, userPromptText);
    try {
      const message = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: [
          {
            type: "text",
            text: systemPrompt,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content }],
      });
      const processed = pdfs.filter(
        (p) => !failedPdfs.some((f) => f.id === p.id)
      );
      return { message, processedPdfs: processed, failedPdfs };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      if (!isRetryablePdfError(err) || remaining.length === 0) {
        throw err;
      }
      const dropped = remaining.pop()!;
      failedPdfs.push({ id: dropped.id, filename: dropped.filename, detail });
      console.warn(
        `[Texlex] Collateral PDF skipped (${dropped.filename}):`,
        detail
      );
    }
  }

  throw new Error("All collateral PDFs failed to process.");
}
