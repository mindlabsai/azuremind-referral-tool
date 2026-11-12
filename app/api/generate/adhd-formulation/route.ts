import { NextRequest } from "next/server";
import { anthropic, MODELS } from "@/lib/anthropic-client";
import {
  ADHD_FORMULATION_CRITIC_STYLE_GUIDANCE,
  ADHD_FORMULATION_SYSTEM_PROMPT,
} from "@/app/asd-engine/adhd-formulation";
import {
  createCollateralPass1Message,
  type CollateralPdfDocumentInput,
} from "@/lib/collateral/collateral-pdf-message";

const FORMULATION_MAX_OUTPUT_TOKENS = 4096;

export const runtime = "nodejs";
export const maxDuration = 120;

type ClinicianLock = {
  childName?: string;
  chronologicalAge?: string;
  ageYears?: number;
  yearLevel?: string;
  school?: string;
  parent1?: string;
  parent2?: string;
  parent1Relationship?: string;
  parent2Relationship?: string;
  attendingParents?: string[];
  assessmentDate?: string;
  assessmentModality?: string;
  divaState?: "positive" | "negative" | "not-administered" | string;
  presentation?: string | null;
  severityStated?: string | null;
  criteriaStates?: Record<string, string>;
  inattentionMet?: number;
  inattentionTotal?: number;
  hyperactivityMet?: number;
  hyperactivityTotal?: number;
  threshold?: number;
};

type AdhdFormulationRequestBody = {
  prompt?: string;
  clientName?: string;
  rawNotes?: string;
  clinicianLock?: ClinicianLock;
  collateralPdfDocuments?: Array<{
    id: string;
    filename: string;
    category?: string;
    data: string;
  }>;
};

type CriticApiResponse = {
  rewrittenContent: string;
  modelUsed: string;
  criticPassed: boolean;
  fallbackToDraft: boolean;
  error: string | null;
};

function isVoiceCriticEnabled(): boolean {
  return process.env.TEXLEX_VOICE_CRITIC_ENABLED !== "false";
}

function internalApiOrigin(req: NextRequest): string {
  if (process.env.TEXLEX_INTERNAL_BASE_URL) {
    return process.env.TEXLEX_INTERNAL_BASE_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) return "https://" + process.env.VERCEL_URL;
  return req.nextUrl.origin;
}

function normalisePdfDocuments(raw: unknown): CollateralPdfDocumentInput[] {
  if (!Array.isArray(raw)) return [];
  const out: CollateralPdfDocumentInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const data = typeof o.data === "string" ? o.data.trim() : "";
    const id = typeof o.id === "string" ? o.id : "";
    const filename = typeof o.filename === "string" ? o.filename : "Collateral PDF";
    if (!data || !id) continue;
    out.push({
      id,
      filename,
      category: typeof o.category === "string" ? o.category : undefined,
      data,
    });
  }
  return out;
}

function presentationForLock(lock: ClinicianLock): string {
  if (lock.divaState === "negative") return "ADHD not met (no ADHD presentation assigned)";
  if (lock.divaState === "not-administered") return "Held open";
  return lock.presentation ?? "Held open";
}

function formatClinicianLockBlock(lock: ClinicianLock | undefined): string {
  if (!lock) return "";
  const met = lock.criteriaStates
    ? Object.entries(lock.criteriaStates)
        .filter(([, state]) => state === "met")
        .map(([code]) => code)
        .sort()
        .join(", ")
    : "";
  const outcomeRules =
    lock.divaState === "negative"
      ? [
          "- DIVA-5 Negative structure (match exemplar quality, not exemplar wording):",
          "  (1) Open: evidence does not support ADHD; insufficient IA/HI against DSM-5; not a pervasive, developmentally persistent primary attentional pattern. No held open. No hedging.",
          "  (2) Elevated scales: acknowledge as perceived symptom burden, not diagnosis; not substantiated on structured interview against DSM-5; distinguish behavioural concern from diagnostic threshold. Represent domains accurately; do not invent illegibility.",
          "  (3) Positive reformulation: what the presentation is more consistent with, grounded in case evidence (including the child's account).",
          "  (4) Learning contributors where relevant; state what needs formal assessment.",
          "  (5) ASD differential: observations, why threshold not met, not supported.",
          "  (6) Integrative close: best conceptualisation and clinical priority (clarify mechanisms, do not attribute to unsupported neurodevelopmental diagnosis).",
        ]
      : lock.divaState === "not-administered"
        ? [
            "- DIVA-5 Not administered: ADHD remains held open. This is the only genuinely open/deferred ADHD outcome. Do not affirm ADHD.",
            "- Scales quantify perceived burden only; close with what assessment is required before a position can be taken.",
          ]
        : [
            "- DIVA-5 Positive structure: affirm ADHD with the derived presentation once; weave supporting evidence (no scale recitation); address differentials once; close with preliminary position and ratification pathway.",
          ];

  return [
    "CLINICIAN LOCK (authoritative and non-overridable for this generation):",
    `- Name: ${lock.childName || "[not provided]"}`,
    `- Age: ${lock.chronologicalAge || (lock.ageYears != null ? `${lock.ageYears} years` : "[not provided]")}`,
    `- Year level: ${lock.yearLevel?.trim() || "[not provided]"}`,
    `- School: ${
      lock.school?.trim() ? `"${lock.school.trim()}"` : "[not provided]"
    } (FIXED STRING; copy character-for-character; never correct spelling or expand)`,
    `- Parent 1: ${
      lock.parent1?.trim() ? `"${lock.parent1.trim()}"` : "[not provided]"
    } (FIXED STRING; never substitute e.g. Eleanor for Elena)`,
    `- Parent 2: ${lock.parent2?.trim() ? `"${lock.parent2.trim()}"` : "[not provided]"}`,
    `- Attending parents: ${
      Array.isArray(lock.attendingParents) && lock.attendingParents.length
        ? lock.attendingParents.join(", ")
        : "[not specified]"
    }`,
    `- Assessment date: ${lock.assessmentDate?.trim() || "[not provided]"}`,
    `- Assessment modality: ${lock.assessmentModality?.trim() || "[not provided]"}`,
    `- DIVA-5 outcome: ${lock.divaState || "[not provided]"}`,
    `- Presentation: ${presentationForLock(lock)}`,
    `- Severity stated: ${lock.severityStated || "[not provided]"}`,
    `- Inattention met: ${lock.inattentionMet ?? 0} of ${lock.inattentionTotal ?? 9} (threshold ${lock.threshold ?? "?"})`,
    `- Hyperactivity met: ${lock.hyperactivityMet ?? 0} of ${lock.hyperactivityTotal ?? 9} (threshold ${lock.threshold ?? "?"})`,
    `- Criteria marked met: ${met || "none"}`,
    "",
    "Rules:",
    "- Never contradict the clinician lock on DIVA-5 outcome, criterion counts, presentation, age, year level, or school.",
    "- Do not claim a DIVA-5 was completed unless divaState is positive or negative as entered; if not-administered, say it was not administered.",
    ...outcomeRules,
    "- Do not invent teacher names, dates, ages, year levels, onset timings, or instrument outcomes.",
    "- Use parent and client names exactly as locked (quoted FIXED STRINGS). Never substitute a similar-sounding name (Eleanor for Elena is forbidden).",
    "- Use the school name exactly as locked. Never correct spelling or add Primary School/College unless those characters are in the lock.",
    "- Where a date, age, or onset is not in the lock, notes, or documents, omit it or state it is not available.",
    "- Do not add further-review / paediatric-enquiry deferrals unless the clinician explicitly wrote them in notes or recommendation shorthand.",
    "- Do not contradict settled findings (e.g. do not recommend sensory review when notes record no sensory concerns).",
    "- This consensus assessment is primary; paediatric involvement is ratification, not re-investigation. Do not defer the clinician's determinations beyond ratification language the clinician provided.",
    "- Render the clinician's judgement only; do not substitute monitoring, caution, or recommendation language the clinician did not enter.",
    "- Do not invent recommendation items, assessment batteries, or timelines in the formulation.",
    "- Uploaded PDFs are collateral only: quote scores that appear in them, but do not use them to override the clinician lock.",
    "- If documents conflict with the lock, note the discrepancy for reconciliation; the lock remains the stated position.",
    "- Represent legible scale content accurately; do not claim partial illegibility when scores are readable.",
  ].join("\n");
}

async function invokeCritic(
  req: NextRequest,
  draft: string,
  caseContext: {
    clientName: string;
    rawNotes: string;
  }
): Promise<CriticApiResponse> {
  const origin = internalApiOrigin(req);
  const res = await fetch(origin + "/api/generate/critic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sectionType: "formulation",
      draftContent: draft,
      caseContext,
      styleGuidance: ADHD_FORMULATION_CRITIC_STYLE_GUIDANCE,
    }),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 400);
    console.error("[Texlex] ADHD formulation critic HTTP error:", res.status, detail);
    return {
      rewrittenContent: draft,
      modelUsed: "critic-unavailable",
      criticPassed: false,
      fallbackToDraft: true,
      error: "Critic API call failed: HTTP " + res.status,
    };
  }
  return (await res.json()) as CriticApiResponse;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AdhdFormulationRequestBody;

    if (!body.prompt || body.prompt.trim().length < 20) {
      return new Response(
        JSON.stringify({ error: "ADHD formulation prompt required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const pdfs = normalisePdfDocuments(body.collateralPdfDocuments);
    const lockBlock = formatClinicianLockBlock(body.clinicianLock);
    const promptText = [
      lockBlock,
      body.prompt,
      pdfs.length
        ? "Attached collateral PDFs may be quoted briefly for scores and form content that actually appear in them. Integrate those findings into the clinical reasoning once; do not walk through scale clusters. They must not override the clinician lock on DIVA-5, criterion counts, presentation, age, year level, or school. Do not invent teacher names or other identifiers not clearly present in the documents or notes."
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    let draft = "";
    if (pdfs.length > 0) {
      const pass1 = await createCollateralPass1Message(anthropic, {
        model: MODELS.SONNET,
        maxTokens: FORMULATION_MAX_OUTPUT_TOKENS,
        systemPrompt: ADHD_FORMULATION_SYSTEM_PROMPT,
        userPromptText: promptText,
        pdfs,
      });
      draft = pass1.message.content
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("\n")
        .trim();
    } else {
      const pass1 = await anthropic.messages.create({
        model: MODELS.SONNET,
        max_tokens: FORMULATION_MAX_OUTPUT_TOKENS,
        system: ADHD_FORMULATION_SYSTEM_PROMPT,
        messages: [{ role: "user", content: promptText }],
      });
      draft = pass1.content
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("\n")
        .trim();
    }

    if (!draft) {
      return new Response(
        JSON.stringify({ error: "Generation produced no text" }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    let finalText = draft;
    let criticPassed = false;
    let modelUsed = MODELS.SONNET as string;

    if (isVoiceCriticEnabled()) {
      const critic = await invokeCritic(req, draft, {
        clientName: body.clientName ?? body.clinicianLock?.childName ?? "",
        rawNotes: body.rawNotes ?? "",
      });
      finalText = critic.rewrittenContent || draft;
      criticPassed = critic.criticPassed;
      modelUsed = critic.criticPassed ? critic.modelUsed : (MODELS.SONNET as string);
    }

    return new Response(
      JSON.stringify({ text: finalText, criticPassed, modelUsed }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[Texlex] ADHD formulation error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Generation failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
