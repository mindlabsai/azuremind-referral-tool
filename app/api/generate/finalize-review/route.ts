import { NextRequest } from "next/server";
import { anthropic, MODELS } from "@/lib/anthropic-client";
import { formatDemographicsLock } from "@/lib/prompts/factual-integrity";
import { runAhpraAuditChecks } from "@/lib/texlex-finalize-review/ahpra-audit-checks";
import { runDeterministicReview } from "@/lib/texlex-finalize-review/deterministic";
import { formatSectionsBlock } from "@/lib/texlex-finalize-review/assemble-corpus";
import {
  buildFinalizeReviewUserPrompt,
  finalizeReviewSystemPrompt,
  finalizeReviewSystemPromptV2,
  type FinalizeReviewPathway,
} from "@/lib/texlex-finalize-review/llm-prompt";
import {
  draftClinicalAlternatives,
  withLockedAlternativePreview,
} from "@/lib/texlex-finalize-review/clinical-alternatives";
import { parseLlmFinalizeFindings } from "@/lib/texlex-finalize-review/parse-llm-findings";
import { describeSourceCoverage } from "@/lib/texlex-finalize-review/universal/coverage";
import { dedupeFindings } from "@/lib/texlex-finalize-review/universal/dedupe";
import { reviewDisplay } from "@/lib/texlex-finalize-review/universal/display";
import { isUniversalReviewV2Enabled } from "@/lib/texlex-finalize-review/universal/flag";
import { markerPackForPathway } from "@/lib/texlex-finalize-review/universal/markers";
import { explicitSourceFindings } from "@/lib/texlex-finalize-review/universal/explicit";
import { applyUniversalPolicy, includeLegacyAhpraChecks } from "@/lib/texlex-finalize-review/universal/policy";
import {
  computeReviewSummary,
  newReviewId,
  type ReviewRun,
  type ReviewSectionInput,
} from "@/lib/texlex-finalize-review/types";

export const runtime = "nodejs";
export const maxDuration = 120;

type FinalizeReviewBody = {
  pathway?: FinalizeReviewPathway;
  patientDetails?: {
    clientName?: string;
    pronouns?: string;
    parent1?: string;
    parent2?: string;
    school?: string;
    dob?: string;
    yearLevel?: string;
    assessmentModality?: "" | "in-clinic" | "virtual";
    virtualCareReason?: string;
    assessmentDates?: string[];
    reportDate?: string;
  };
  diagnosticConclusion?: string;
  confirmedLevelA?: number | null;
  confirmedLevelB?: number | null;
  expectedFormulationOpening?: string;
  ratingsAssigned?: Record<string, number | null>;
  sections?: ReviewSectionInput[];
  /** Clinician raw notes and section notes. Used to reframe implicit session observation. */
  sourceNotes?: string;
  options?: { skipLlm?: boolean };
};

function isLlmEnabled(): boolean {
  return process.env.TEXLEX_FINALIZE_LLM_ENABLED !== "false";
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as FinalizeReviewBody;
    const pathway: FinalizeReviewPathway = body.pathway === "adhd" ? "adhd" : "asd";
    const sections = Array.isArray(body.sections) ? body.sections : [];
    const pd = body.patientDetails ?? {};
    const runId = newReviewId("run");
    const createdAt = new Date().toISOString();
    const modality =
      pd.assessmentModality === "in-clinic" || pd.assessmentModality === "virtual"
        ? pd.assessmentModality
        : "";

    const snapshot = {
      diagnosticConclusion: body.diagnosticConclusion ?? "inconclusive",
      confirmedLevelA:
        typeof body.confirmedLevelA === "number" ? body.confirmedLevelA : null,
      confirmedLevelB:
        typeof body.confirmedLevelB === "number" ? body.confirmedLevelB : null,
      assessmentModality: modality as "" | "in-clinic" | "virtual",
      clientName: typeof pd.clientName === "string" ? pd.clientName : "",
      pronouns: typeof pd.pronouns === "string" ? pd.pronouns : "",
    };

    const school = typeof pd.school === "string" ? pd.school : "";
    const universalV2 = isUniversalReviewV2Enabled();
    const pack = markerPackForPathway(pathway);
    const deterministicBase = runDeterministicReview({
      runId,
      clientName: snapshot.clientName,
      pronouns: snapshot.pronouns,
      parent1: typeof pd.parent1 === "string" ? pd.parent1 : "",
      parent2: typeof pd.parent2 === "string" ? pd.parent2 : "",
      school,
      assessmentModality: snapshot.assessmentModality,
      diagnosticConclusion: snapshot.diagnosticConclusion,
      confirmedLevelA: snapshot.confirmedLevelA,
      confirmedLevelB: snapshot.confirmedLevelB,
      expectedFormulationOpening: body.expectedFormulationOpening ?? "",
      assessmentDates: Array.isArray(pd.assessmentDates)
        ? pd.assessmentDates.filter((date): date is string => typeof date === "string")
        : [],
      reportDate: typeof pd.reportDate === "string" ? pd.reportDate : "",
      sections,
    });

    const ahpraFindings = includeLegacyAhpraChecks(pathway, universalV2)
        ? runAhpraAuditChecks({
            runId,
            assessmentModality: snapshot.assessmentModality,
            diagnosticConclusion: snapshot.diagnosticConclusion,
            school,
            sections,
          })
        : [];

    const deterministic = universalV2
      ? applyUniversalPolicy([
          ...deterministicBase,
          ...ahpraFindings,
          ...explicitSourceFindings({
            runId,
            sections,
            sourceNotes: typeof body.sourceNotes === "string" ? body.sourceNotes : "",
            diagnosticConclusion: snapshot.diagnosticConclusion,
          }),
        ])
      : [...deterministicBase, ...ahpraFindings];

    let llmFindings: ReturnType<typeof parseLlmFinalizeFindings> = [];
    let modelUsed: string | null = null;
    let llmSkipped = Boolean(body.options?.skipLlm) || !isLlmEnabled();
    let error: string | null = null;

    if (!llmSkipped) {
      if (!process.env.ANTHROPIC_API_KEY) {
        llmSkipped = true;
        error = "ANTHROPIC_API_KEY missing — deterministic findings only.";
      } else {
        try {
          const demographicsLock = formatDemographicsLock({
            clientName: pd.clientName,
            parent1: pd.parent1,
            parent2: pd.parent2,
            pronouns: pd.pronouns,
            dob: pd.dob,
            yearLevel: pd.yearLevel,
            school: pd.school,
            assessmentModality: modality || undefined,
            assessmentDate: Array.isArray(pd.assessmentDates)
              ? pd.assessmentDates.filter(Boolean).join(", ")
              : undefined,
            reportDate: typeof pd.reportDate === "string" ? pd.reportDate : undefined,
          });
          const userPrompt = buildFinalizeReviewUserPrompt({
            demographicsLock,
            diagnosticConclusion: snapshot.diagnosticConclusion,
            confirmedLevelA: snapshot.confirmedLevelA,
            confirmedLevelB: snapshot.confirmedLevelB,
            assessmentModality: modality || "unset",
            expectedFormulationOpening: body.expectedFormulationOpening ?? "",
            ratingsAssigned: body.ratingsAssigned ?? {},
            sectionsBlock: formatSectionsBlock(sections),
            pathway,
          });

          const message = await anthropic.messages.create({
            model: MODELS.OPUS,
            max_tokens: 4096,
            system: universalV2 ? finalizeReviewSystemPromptV2(pathway) : finalizeReviewSystemPrompt(pathway),
            messages: [{ role: "user", content: userPrompt }],
          });
          modelUsed = MODELS.OPUS;
          const text = message.content
            .filter((b) => b.type === "text")
            .map((b) => b.text)
            .join("\n");
          llmFindings = parseLlmFinalizeFindings(text, runId);
        } catch (e) {
          error = e instanceof Error ? e.message : "Finalize review LLM failed";
          llmSkipped = true;
        }
      }
    }

    let findings = [...deterministic, ...llmFindings].map(withLockedAlternativePreview);
    if (
      !universalV2 &&
      process.env.ANTHROPIC_API_KEY &&
      findings.some((finding) => !finding.applyHint)
    ) {
      try {
        const demographicsLock = formatDemographicsLock({
          clientName: pd.clientName,
          parent1: pd.parent1,
          parent2: pd.parent2,
          pronouns: pd.pronouns,
          dob: pd.dob,
          yearLevel: pd.yearLevel,
          school: pd.school,
          assessmentModality: modality || undefined,
          assessmentDate: Array.isArray(pd.assessmentDates)
            ? pd.assessmentDates.filter(Boolean).join(", ")
            : undefined,
          reportDate: typeof pd.reportDate === "string" ? pd.reportDate : undefined,
        });
        findings = await draftClinicalAlternatives({
          findings,
          sections,
          demographicsLock,
          sourceNotes: typeof body.sourceNotes === "string" ? body.sourceNotes : "",
          skipObservationReframe: universalV2,
        });
        modelUsed = modelUsed ?? MODELS.OPUS;
      } catch (alternativeError) {
        error =
          error ??
          (alternativeError instanceof Error
            ? alternativeError.message
            : "Clinical alternatives could not be drafted.");
      }
    }
    if (universalV2) {
      findings = dedupeFindings(findings).map((finding) => ({
        ...finding,
        markerPack: pack.id,
      }));
    }
    const coverage = describeSourceCoverage({
      sections,
      sourceNotes: typeof body.sourceNotes === "string" ? body.sourceNotes : "",
    });
    const run: ReviewRun = {
      id: runId,
      createdAt,
      completedAt: new Date().toISOString(),
      status: "complete",
      modelUsed,
      llmSkipped,
      error,
      snapshot,
      findings,
      summary: computeReviewSummary(findings),
      ...(universalV2
        ? {
            universalReviewV2: true,
            markerPack: pack.id,
            sourceCoverage: coverage.text,
            display: reviewDisplay(findings),
          }
        : {}),
    };

    return Response.json({
      run,
      deterministicCount: deterministic.length,
      llmCount: llmFindings.length,
      error,
    });
  } catch (e) {
    console.error("[Texlex] Finalize review error:", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Finalize review failed" },
      { status: 500 }
    );
  }
}
