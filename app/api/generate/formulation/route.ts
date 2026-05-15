import { NextRequest } from "next/server";
import { anthropic, MODELS } from "@/lib/anthropic-client";
import {
  FORMULATION_SYSTEM_PROMPT,
  buildFormulationUserPrompt,
  buildLockedFormulationOpening,
  type FormulationVariables,
} from "@/lib/prompts/formulation-template";
import { resolveTexlexDiagnosticConclusion } from "@/lib/texlex-diagnostic-conclusion";
import { assessFormulationCompleteness } from "@/lib/texlex-formulation-completeness";

/** PASS 10w-3: long clinical formulation (multi-paragraph); keep isolated from other generators' budgets. */
const FORMULATION_MAX_OUTPUT_TOKENS = 4096;

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<FormulationVariables>;

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

    const conclusion = resolveTexlexDiagnosticConclusion(body.diagnosticConclusion);
    let locked =
      typeof body.lockedFormulationOpening === "string" ? body.lockedFormulationOpening.trim() : "";
    if (!locked) {
      locked = buildLockedFormulationOpening({
        conclusion,
        clientName: body.clientName ?? "",
        criteria: {},
        overallLevel:
          typeof body.overallLevel === "number" && Number.isFinite(body.overallLevel)
            ? body.overallLevel
            : null,
      });
    }

    const vars: FormulationVariables = {
      clientName: body.clientName ?? "",
      pronouns: body.pronouns ?? "",
      chronologicalAge: body.chronologicalAge ?? "",
      yearLevel: body.yearLevel ?? "",
      referringPractitioner: body.referringPractitioner ?? "",
      referringPractitionerType: body.referringPractitionerType ?? "",
      school: typeof body.school === "string" ? body.school : "",
      rawNotes: body.rawNotes ?? "",
      criteriaState: body.criteriaState ?? "",
      collateralSummary: body.collateralSummary ?? "",
      functionalImpactSummary: body.functionalImpactSummary ?? "",
      diagnosticConclusion: conclusion,
      lockedFormulationOpening: locked,
    };

    const userPrompt = buildFormulationUserPrompt(vars);

    const stream = await anthropic.messages.create({
      model: MODELS.OPUS,
      max_tokens: FORMULATION_MAX_OUTPUT_TOKENS,
      stream: true,
      system: [
        {
          type: "text",
          text: FORMULATION_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let assembled = "";
        let stopReason: string | undefined;
        try {
          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              assembled += event.delta.text;
              const data = JSON.stringify({ delta: event.delta.text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
            if (event.type === "message_delta" && event.delta.stop_reason) {
              stopReason = event.delta.stop_reason;
              const data = JSON.stringify({ done: true, stop_reason: event.delta.stop_reason });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
            // Do not send [DONE] here — wait until after completeness check so clients can read truncation_warning first.
          }
          const { truncation_warning } = assessFormulationCompleteness(assembled, stopReason);
          if (truncation_warning) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ truncation_warning })}\n\n`)
            );
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
