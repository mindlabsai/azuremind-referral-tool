import { TEXLEX_NO_FABRICATION_RULE } from "@/lib/prompts/factual-integrity";

export type FinalizeReviewPathway = "asd" | "adhd";

const ASD_AUDIT_KINDS =
  "major_inconsistency | differential_consistency | observation_source | differential_coverage | cognitive_overclaim | collateral_gap | modality_limits | limitations_honesty | severity_support";

const ADHD_AUDIT_KINDS = "major_inconsistency | differential_consistency";

export function finalizeReviewSystemPrompt(pathway: FinalizeReviewPathway = "asd"): string {
  const reportKind =
    pathway === "adhd" ? "ADHD clinical reports" : "ASD clinical reports";
  const kinds = pathway === "adhd" ? ADHD_AUDIT_KINDS : ASD_AUDIT_KINDS;
  const asdExtra =
    pathway === "asd"
      ? `
AHPRA-ORIENTED SCANS (ASD only — still no new clinical content):
- observation_source: criterion or formulation prose that blurs or omits clinical observation vs parent/carer report when both are implied.
- differential_coverage: meets/inconclusive report with no weighing of plausible differentials (ADHD, anxiety, language disorder, trauma, ID/GDD, etc.) anywhere in formulation or Criterion E — flag the gap; do NOT invent differentials.
- cognitive_overclaim: IQ / cognitive ability / adaptive functioning claims without a formal-assessment hedge or named battery already in the text.
- collateral_gap: school/teacher/allied health context implied but collateral absence not documented.
- modality_limits: virtual modality without telehealth observation-limit language in Limitations.
- limitations_honesty: concluded report with empty or purely generic limitations that ignore case-specific constraints already evident in the draft.
- severity_support: severity/Level language not grounded by functional-impact evidence already present.
`
      : "";

  return `You are a Texlex Finalize Review auditor for ${reportKind}.

YOUR ONLY JOB: find MAJOR inconsistencies and (for ASD) AHPRA-relevant documentation gaps among the supplied sections and demographics. Output structured findings only.

ABSOLUTE RULES:
1. Do NOT add new clinical information, observations, diagnoses, differentials, recommendations, or severity judgements.
2. Do NOT rewrite the report. Do NOT invent fixes that introduce new facts.
3. Flag only contradictions between texts that are already present, or clear missing documentation labels/hedges that the draft itself makes necessary.
4. Every finding MUST include an evidenceExcerpt copied from the supplied section text (or null only when the section is empty and emptiness is the issue — prefer a short quote when text exists).
5. Only emit kinds: ${kinds}.
6. Skip style, tone, length, and minor wording issues.
7. If nothing major is wrong, return {"findings":[]}.

${TEXLEX_NO_FABRICATION_RULE}

Differential consistency means: a differential / co-occurring condition / ID-GDD weighing is affirmed in one place and contradicted or erased in another — cite both sides. Do not propose a new differential.
${asdExtra}
Return ONLY valid JSON of the form:
{
  "findings": [
    {
      "kind": "<allowed kind>",
      "severity": "major" | "blocking",
      "sectionId": "<one of the provided section ids>",
      "title": "short title",
      "detail": "what conflicts or is missing as documentation (no new clinical claims)",
      "evidenceExcerpt": "exact quote from the section",
      "suggestedEdit": "minimal alignment / labelling instruction only (no new clinical facts)"
    }
  ]
}`;
}

/** @deprecated Use finalizeReviewSystemPrompt(pathway) */
export const FINALIZE_REVIEW_SYSTEM_PROMPT = finalizeReviewSystemPrompt("asd");

export function buildFinalizeReviewUserPrompt(args: {
  demographicsLock: string;
  diagnosticConclusion: string;
  confirmedLevelA: number | null;
  confirmedLevelB: number | null;
  assessmentModality: string;
  expectedFormulationOpening: string;
  ratingsAssigned: Record<string, number | null>;
  sectionsBlock: string;
  pathway?: FinalizeReviewPathway;
}): string {
  const pathway = args.pathway ?? "asd";
  const lockExtra =
    pathway === "adhd"
      ? `Pathway: ADHD
Severity / presentation note: ${args.diagnosticConclusion || "n/a"}
Assessment modality: ${args.assessmentModality || "unset"}`
      : `Conclusion: ${args.diagnosticConclusion}
Confirmed Level A: ${args.confirmedLevelA ?? "n/a"}
Confirmed Level B: ${args.confirmedLevelB ?? "n/a"}
Assessment modality: ${args.assessmentModality || "unset"}

# EXPECTED FORMULATION OPENING (locked)
${args.expectedFormulationOpening || "[none]"}

# CRITERION RATINGS (clinician)
${JSON.stringify(args.ratingsAssigned, null, 2)}`;

  const task =
    pathway === "asd"
      ? `# TASK
Return JSON findings for major inconsistencies, differential consistency, and AHPRA documentation gaps (observation vs parent report, broader differentials, cognitive overclaim hedges, collateral gaps, modality/limitations honesty, severity vs functional impact). No new clinical content.
The date of report must be on or after every date of assessment. Flag a section that states a different date of assessment or date of report than the demographics lock.`
      : `# TASK
Return JSON findings for major inconsistencies and differential consistency only. No new clinical content.
The date of report must be on or after every date of assessment. Flag a section that states a different date of assessment or date of report than the demographics lock.`;

  return `# DEMOGRAPHICS LOCK (source of truth for names / pronouns / modality)

${args.demographicsLock}

# DIAGNOSTIC LOCK
${lockExtra}

# REPORT SECTIONS
${args.sectionsBlock}

${task}`;
}
