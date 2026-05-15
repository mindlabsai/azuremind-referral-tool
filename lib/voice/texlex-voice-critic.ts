import type { NextRequest } from "next/server";
import { MODELS } from "@/lib/anthropic-client";

export const VOICE_CRITIC_MODEL = "claude-opus-4-7";
export const VOICE_CRITIC_PASS1_MODEL = MODELS.SONNET;

export type VoiceCriticApiResponse = {
  rewrittenContent: string;
  modelUsed: string;
  criticPassed: boolean;
  fallbackToDraft: boolean;
  error: string | null;
};

export type VoiceCriticCaseContext = {
  patientDetails?: Record<string, unknown>;
  rawNotes?: string | Record<string, unknown>;
  diagnosticConclusion?: string;
  ratingsAssigned?: Record<string, unknown>;
};

export type VoiceCriticStreamMeta = {
  criticApplied: boolean;
  fallbackToDraft: boolean;
  criticDisabled: boolean;
  model: string;
  truncationWarning?: string | null;
};

export function isVoiceCriticEnabled(): boolean {
  return process.env.TEXLEX_VOICE_CRITIC_ENABLED !== "false";
}

export function internalApiOrigin(req: NextRequest): string {
  if (process.env.TEXLEX_INTERNAL_BASE_URL) return process.env.TEXLEX_INTERNAL_BASE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return req.nextUrl.origin;
}

export async function invokeVoiceCritic(
  req: NextRequest,
  logLabel: string,
  sectionType: string,
  pass1Draft: string,
  caseContext: VoiceCriticCaseContext
): Promise<VoiceCriticApiResponse> {
  const origin = internalApiOrigin(req);
  const res = await fetch(`${origin}/api/generate/critic`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sectionType,
      draftContent: pass1Draft,
      caseContext,
    }),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 400);
    console.error(`[Texlex] ${logLabel} critic HTTP error:`, res.status, detail);
    return {
      rewrittenContent: pass1Draft,
      modelUsed: VOICE_CRITIC_MODEL,
      criticPassed: false,
      fallbackToDraft: true,
      error: `Critic API call failed: HTTP ${res.status}`,
    };
  }
  return (await res.json()) as VoiceCriticApiResponse;
}

export async function runVoiceCriticPostStep(
  req: NextRequest,
  logLabel: string,
  sectionType: string,
  pass1Draft: string,
  caseContext: VoiceCriticCaseContext,
  pass1Model: string = VOICE_CRITIC_PASS1_MODEL
): Promise<VoiceCriticStreamMeta & { finalContent: string }> {
  let finalContent = pass1Draft;
  let criticApplied = false;
  let fallbackToDraft = false;
  let criticDisabled = false;
  let model = pass1Model;

  if (!isVoiceCriticEnabled()) {
    criticDisabled = true;
    console.info(`[Texlex] ${logLabel} voice critic disabled (TEXLEX_VOICE_CRITIC_ENABLED=false)`);
    return { finalContent, criticApplied, fallbackToDraft, criticDisabled, model };
  }

  console.info(`[Texlex] ${logLabel} Pass 1 complete; invoking voice critic (Opus)…`);
  const critic = await invokeVoiceCritic(req, logLabel, sectionType, pass1Draft, caseContext);
  if (critic.criticPassed && !critic.fallbackToDraft) {
    finalContent = critic.rewrittenContent;
    criticApplied = true;
    model = VOICE_CRITIC_MODEL;
    console.info(`[Texlex] ${logLabel} voice critic applied successfully.`);
  } else {
    fallbackToDraft = true;
    console.warn(
      `[Texlex] ${logLabel} voice critic fallback to Pass 1 draft:`,
      critic.error ?? "criticPassed=false or fallbackToDraft=true"
    );
  }

  return { finalContent, criticApplied, fallbackToDraft, criticDisabled, model };
}

export function criticSectionTypeForCriterion(code: string): string {
  return `criterion_${code.toLowerCase()}`;
}
