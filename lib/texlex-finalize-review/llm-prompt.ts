import { TEXLEX_NO_FABRICATION_RULE } from "@/lib/prompts/factual-integrity";

export const FINALIZE_REVIEW_SYSTEM_PROMPT = `You are a Texlex Finalize Review auditor for ASD clinical reports.

YOUR ONLY JOB: find MAJOR inconsistencies among the supplied sections and demographics. Output structured findings only.

ABSOLUTE RULES:
1. Do NOT add new clinical information, observations, diagnoses, differentials, recommendations, or severity judgements.
2. Do NOT rewrite the report. Do NOT invent fixes that introduce new facts.
3. Flag only contradictions between texts that are already present.
4. Every finding MUST include an evidenceExcerpt copied from the supplied section text.
5. Only emit kinds: major_inconsistency OR differential_consistency.
6. Skip style, tone, length, and minor wording issues.
7. If nothing major is wrong, return {"findings":[]}.

${TEXLEX_NO_FABRICATION_RULE}

Differential consistency means: a differential / co-occurring condition / ID-GDD weighing is affirmed in one place and contradicted or erased in another — cite both sides. Do not propose a new differential.

Return ONLY valid JSON of the form:
{
  "findings": [
    {
      "kind": "major_inconsistency" | "differential_consistency",
      "severity": "major" | "blocking",
      "sectionId": "<one of the provided section ids>",
      "title": "short title",
      "detail": "what conflicts with what (no new clinical claims)",
      "evidenceExcerpt": "exact quote from the section",
      "suggestedEdit": "minimal alignment instruction only (no new clinical facts)"
    }
  ]
}`;

export function buildFinalizeReviewUserPrompt(args: {
  demographicsLock: string;
  diagnosticConclusion: string;
  confirmedLevelA: number | null;
  confirmedLevelB: number | null;
  assessmentModality: string;
  expectedFormulationOpening: string;
  ratingsAssigned: Record<string, number | null>;
  sectionsBlock: string;
}): string {
  return `# DEMOGRAPHICS LOCK (source of truth for names / pronouns / modality)

${args.demographicsLock}

# DIAGNOSTIC LOCK
Conclusion: ${args.diagnosticConclusion}
Confirmed Level A: ${args.confirmedLevelA ?? "n/a"}
Confirmed Level B: ${args.confirmedLevelB ?? "n/a"}
Assessment modality: ${args.assessmentModality || "unset"}

# EXPECTED FORMULATION OPENING (locked)
${args.expectedFormulationOpening || "[none]"}

# CRITERION RATINGS (clinician)
${JSON.stringify(args.ratingsAssigned, null, 2)}

# REPORT SECTIONS
${args.sectionsBlock}

# TASK
Return JSON findings for major inconsistencies and differential consistency only. No new clinical content.`;
}
