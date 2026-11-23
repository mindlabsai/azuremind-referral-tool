import { NextRequest } from "next/server";
import { anthropic, MODELS } from "@/lib/anthropic-client";
import { buildCollateralUserMessageContent } from "@/lib/collateral/collateral-pdf-message";
import {
  SLD_SECTION_IDS,
  SLD_SECTION_SYSTEM_PROMPT,
  buildSldSectionPrompt,
  type SldAreaMark,
  type SldDivaState,
  type SldSectionId,
  type SldSectionRequest,
} from "@/lib/prompts/sld-section";

export const runtime = "nodejs";
export const maxDuration = 120;

type PdfBody = {
  filename?: string;
  role?: string;
  data?: string;
};

function isSection(value: unknown): value is SldSectionId {
  return typeof value === "string" && (SLD_SECTION_IDS as readonly string[]).includes(value);
}

function isMark(value: unknown): value is SldAreaMark {
  return value === "indicated" || value === "not-indicated" || value === "unset";
}

function isDiva(value: unknown): value is SldDivaState {
  return value === "positive" || value === "negative" || value === "not-administered";
}

function normalisePdfs(raw: unknown): Array<{ filename: string; role: "wiat" | "vanderbilt"; data: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ filename: string; role: "wiat" | "vanderbilt"; data: string }> = [];
  for (const item of raw as PdfBody[]) {
    const data = typeof item?.data === "string" ? item.data.trim() : "";
    const role = item?.role === "vanderbilt" ? "vanderbilt" : item?.role === "wiat" ? "wiat" : null;
    const filename = typeof item?.filename === "string" ? item.filename.trim() : "";
    if (!data || !role || !filename) continue;
    out.push({ filename, role, data });
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<SldSectionRequest> & { pdfs?: unknown };
    if (!isSection(body.section)) {
      return new Response(JSON.stringify({ error: "Unknown SLD section" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const rawNotes = typeof body.rawNotes === "string" ? body.rawNotes : "";
    const pdfs = normalisePdfs(body.pdfs);
    if (rawNotes.trim().length < 20 && pdfs.length === 0) {
      return new Response(
        JSON.stringify({ error: "Add raw notes or attach the WIAT report before generating." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const areas = body.areas;
    const request: SldSectionRequest = {
      section: body.section,
      clientName: typeof body.clientName === "string" ? body.clientName : "",
      dob: typeof body.dob === "string" ? body.dob : "",
      rawNotes,
      adhdInScope: Boolean(body.adhdInScope),
      divaState: isDiva(body.divaState) ? body.divaState : "not-administered",
      criteriaStates:
        body.criteriaStates && typeof body.criteriaStates === "object" ? body.criteriaStates : {},
      inattentionMet: Number(body.inattentionMet) || 0,
      inattentionTotal: Number(body.inattentionTotal) || 9,
      hyperactivityMet: Number(body.hyperactivityMet) || 0,
      hyperactivityTotal: Number(body.hyperactivityTotal) || 9,
      threshold: typeof body.threshold === "number" ? body.threshold : null,
      presentation: typeof body.presentation === "string" ? body.presentation : null,
      areas: {
        reading: isMark(areas?.reading) ? areas.reading : "unset",
        writtenExpression: isMark(areas?.writtenExpression) ? areas.writtenExpression : "unset",
        mathematics: isMark(areas?.mathematics) ? areas.mathematics : "unset",
      },
      severity: typeof body.severity === "string" ? body.severity : "",
      documents: pdfs.map((pdf) => ({ filename: pdf.filename, role: pdf.role })),
    };

    const userPrompt = buildSldSectionPrompt(request);
    const content = buildCollateralUserMessageContent(
      pdfs.map((pdf, index) => ({
        id: `${pdf.role}-${index}`,
        filename: pdf.filename,
        category: pdf.role === "wiat" ? "Academic achievement (WIAT)" : "ADHD rating scale (Vanderbilt)",
        data: pdf.data,
      })),
      userPrompt
    );

    const stream = await anthropic.messages.create({
      model: MODELS.OPUS,
      max_tokens: body.section === "Formulation" ? 4096 : 2500,
      stream: true,
      system: [
        {
          type: "text",
          text: SLD_SECTION_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content }],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ delta: event.delta.text })}\n\n`)
              );
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
