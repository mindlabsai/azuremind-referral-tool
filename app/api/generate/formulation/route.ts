import { NextRequest } from "next/server";
import { anthropic, MODELS } from "@/lib/anthropic-client";
import {
  FORMULATION_SYSTEM_PROMPT,
  FORMULATION_MAX_OUTPUT_TOKENS,
  FORMULATION_CRITIC_RULES,
  buildFormulationUserPrompt,
  buildLockedFormulationOpening,
  type FormulationVariables,
} from "@/lib/prompts/formulation-template";
import { resolveTexlexDiagnosticConclusion } from "@/lib/texlex-diagnostic-conclusion";
import { assessFormulationCompleteness } from "@/lib/texlex-formulation-completeness";

const FORMULATION_PASS1_MODEL = MODELS.SONNET;
const FORMULATION_CRITIC_MODEL = "claude-opus-4-7";

export const runtime = "nodejs";
export const maxDuration = 120;

type CriticApiResponse = {
  rewrittenContent: string;
  modelUsed: string;
  criticPassed: boolean;
  fallbackToDraft: boolean;
  error: string | null;
};

type FormulationRequestBody = Partial<FormulationVariables> & {
  patientDetails?: Record<string, unknown>;
  ratingsAssigned?: Record<string, unknown>;
};

function isVoiceCriticEnabled(): boolean {
  return process.env.TEXLEX_VOICE_CRITIC_ENABLED !== "false";
}

function internalApiOrigin(req: NextRequest): string {
  if (process.env.TEXLEX_INTERNAL_BASE_URL) return process.env.TEXLEX_INTERNAL_BASE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return req.nextUrl.origin;
}

async function invokeFormulationCritic(
  req: NextRequest,
  pass1Draft: string,
  caseContext: {
    patientDetails: Record<string, unknown>;
    rawNotes: string;
    diagnosticConclusion: string;
    ratingsAssigned: Record<string, unknown>;
  }
): Promise<CriticApiResponse> {
  const origin = internalApiOrigin(req);
  const res = await fetch(`${origin}/api/generate/critic`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sectionType: "formulation",
      draftContent: pass1Draft,
      caseContext,
      styleGuidance: FORMULATION_CRITIC_RULES,
    }),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 400);
    console.error("[Texlex] Formulation critic HTTP error:", res.status, detail);
    return {
      rewrittenContent: pass1Draft,
      modelUsed: FORMULATION_CRITIC_MODEL,
      criticPassed: false,
      fallbackToDraft: true,
      error: `Critic API call failed: HTTP ${res.status}`,
    };
  }
  return (await res.json()) as CriticApiResponse;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as FormulationRequestBody;

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
    const reqLevelA =
      typeof body.levelA === "number" && Number.isFinite(body.levelA) ? body.levelA : null;
    const reqLevelB =
      typeof body.levelB === "number" && Number.isFinite(body.levelB) ? body.levelB : null;
    const reqDeterminable =
      typeof body.determinable === "boolean"
        ? body.determinable
        : reqLevelA != null && reqLevelB != null;

    if (conclusion === "meets" && (!reqDeterminable || reqLevelA == null || reqLevelB == null)) {
      return new Response(
        JSON.stringify({
          error:
            "Cannot generate formulation: diagnostic conclusion is 'meets' but Level A and/or Level B are not confirmed. Confirm severity levels with clinical rationale before generating.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let locked =
      typeof body.lockedFormulationOpening === "string" ? body.lockedFormulationOpening.trim() : "";
    if (!locked) {
      locked = buildLockedFormulationOpening({
        conclusion,
        clientName: body.clientName ?? "",
        criteria: {},
        levelA: reqLevelA,
        levelB: reqLevelB,
        determinable: reqDeterminable,
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
    const patientDetails =
      body.patientDetails && typeof body.patientDetails === "object" ? body.patientDetails : {};
    const ratingsAssigned =
      body.ratingsAssigned && typeof body.ratingsAssigned === "object" ? body.ratingsAssigned : {};

    const stream = await anthropic.messages.create({
      model: FORMULATION_PASS1_MODEL,
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
        let pass1Draft = "";
        let stopReason: string | undefined;
        try {
          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              pass1Draft += event.delta.text;
              const data = JSON.stringify({ delta: event.delta.text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
            if (event.type === "message_delta" && event.delta.stop_reason) {
              stopReason = event.delta.stop_reason;
              const data = JSON.stringify({ done: true, stop_reason: event.delta.stop_reason });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }

          let finalContent = pass1Draft;
          let criticApplied = false;
          let fallbackToDraft = false;
          let criticDisabled = false;
          let model: string = FORMULATION_PASS1_MODEL;

          if (!isVoiceCriticEnabled()) {
            criticDisabled = true;
            console.info("[Texlex] Formulation voice critic disabled (TEXLEX_VOICE_CRITIC_ENABLED=false)");
          } else {
            console.info("[Texlex] Formulation Pass 1 complete; invoking voice critic (Opus)…");
            const critic = await invokeFormulationCritic(req, pass1Draft, {
              patientDetails,
              rawNotes: vars.rawNotes,
              diagnosticConclusion: conclusion,
              ratingsAssigned,
            });
            if (critic.criticPassed && !critic.fallbackToDraft) {
              finalContent = critic.rewrittenContent;
              criticApplied = true;
              model = FORMULATION_CRITIC_MODEL;
              console.info("[Texlex] Formulation voice critic applied successfully.");
            } else {
              fallbackToDraft = true;
              console.warn(
                "[Texlex] Formulation voice critic fallback to Pass 1 draft:",
                critic.error ?? "criticPassed=false or fallbackToDraft=true"
              );
            }
          }

          const { truncation_warning: truncationWarning } = assessFormulationCompleteness(
            finalContent,
            stopReason
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
                truncationWarning: truncationWarning ?? null,
              })}\n\n`
            )
          );
          if (truncationWarning) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ truncation_warning: truncationWarning })}\n\n`)
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
