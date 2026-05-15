import { clientFirstName } from "@/app/asd-engine/report/pdf/utils";
import type { TexlexDiagnosticConclusion } from "@/lib/texlex-diagnostic-conclusion";
import {
  CLINICAL_RECENCY_GATE_FORMULATION,
  REFERRER_TYPE_HONESTY,
} from "./clinical-recency-referrer-blocks";
import { TEXLEX_SHARED_VOICE } from "./shared-voice";

const FORMULATION_CRITERION_CODES = ["A1", "A2", "A3", "B1", "B2", "B3", "B4"] as const;

export type FormulationCriterionSnapshot = {
  indicators: string;
  markerCount: number;
  suggestedRating: number | null;
  rating: number | null;
};

function buildEmergingDomainsPhrase(criteria: Record<string, FormulationCriterionSnapshot>): string {
  let hasA = false;
  let hasB = false;
  for (const code of FORMULATION_CRITERION_CODES) {
    const row = criteria[code];
    if (!row) continue;
    const hasText = Boolean(row.indicators?.trim());
    const hasMarkers = (row.markerCount ?? 0) > 0;
    const eff = Math.max(row.rating ?? 0, row.suggestedRating ?? 0);
    const hasEmerging = eff >= 1;
    if (!hasText && !hasMarkers && !hasEmerging) continue;
    if (code.startsWith("A")) hasA = true;
    else hasB = true;
  }
  if (hasA && hasB) {
    return "social communication and restricted and repetitive behaviour";
  }
  if (hasA) return "social communication";
  if (hasB) return "restricted and repetitive behaviour";
  return "relevant developmental domains";
}

const LEVEL_SUPPORT_PHRASE: Record<1 | 2 | 3, string> = {
  1: "a need for support across social communication and restricted, repetitive behaviour domains",
  2: "a need for substantial support across social communication and restricted, repetitive behaviour domains",
  3: "a need for very substantial support across social communication and restricted, repetitive behaviour domains",
};

export function buildLockedFormulationOpening(args: {
  conclusion: TexlexDiagnosticConclusion;
  clientName: string;
  criteria: Record<string, FormulationCriterionSnapshot>;
  overallLevel: number | null;
}): string {
  const name = clientFirstName(args.clientName.trim()) || "The client";
  const fullName = args.clientName.trim() || name;

  if (args.conclusion === "meets") {
    const level = args.overallLevel === 2 || args.overallLevel === 3 ? args.overallLevel : 1;
    const phrase = LEVEL_SUPPORT_PHRASE[level];
    return `${fullName} meets DSM-5-TR criteria for Autism Spectrum Disorder, with a presentation best characterised within the Level ${level} range, reflecting ${phrase}.`;
  }

  if (args.conclusion === "does_not_meet") {
    const domains = buildEmergingDomainsPhrase(args.criteria);
    return `${fullName} does not meet DSM-5-TR criteria for Autism Spectrum Disorder at this time. While ${name} presents with some emerging features across ${domains}, the pattern of presentation does not meet the threshold for a clinically significant impairment consistent with an Autism Spectrum Disorder diagnosis.`;
  }

  return `The current assessment does not provide sufficient evidence to confirm or exclude a diagnosis of Autism Spectrum Disorder at this time. Further clinical clarification is recommended through continued developmental paediatric review, structured observation in naturalistic settings, and collateral information from education where appropriate.`;
}

export const FORMULATION_SYSTEM_PROMPT = `${TEXLEX_SHARED_VOICE}

# THIS SECTION — CLINICAL FORMULATION AND CONSENSUS OPINION

This is the MOST IMPORTANT section of the report. It is the section that:
- The paediatrician reads first when deciding whether to confirm diagnosis
- NDIS planners cite when assessing access
- Family courts reference if dispute arises
- AHPRA reviews if practice is challenged

CONCLUSIVE register throughout. This section MAKES claims, not describes evidence.

# CONTENT

Required components in order:

1. Opening diagnostic conclusion — the very first sentence of the section
- State directly whether the client meets DSM-5-TR criteria for Autism Spectrum Disorder, the level of support classification (1, 2, or 3) when applicable, and the core support need this reflects in one clause.
- For ruled-out: "Findings do not support a diagnosis of Autism Spectrum Disorder. [Client]'s presentation is better characterised by [alternative formulation]."

2. Assessment context — one sentence only, demoted after the diagnostic conclusion
- Briefly note the consensus-based neurodevelopmental assessment pathway and what was integrated (clinical interview, parent-report, direct observation, collateral, structured assessment).
- Do NOT open the section with methodology or process language.

3. Summary of the criterion evidence — one paragraph synthesising A1-A3, then one synthesising B1-B4
- "[Client] presents with persistent differences in social communication and interaction. This includes reduced social reciprocity, [specific A1 element]..."
- "Within the domain of restricted and repetitive behaviours, [Client] demonstrates..."

4. Co-occurring conditions noted from raw notes (ADHD, language delay, anxiety, learning difficulties)
- "[Client] additionally presents with [condition], with [appropriate specialist] review required to confirm diagnosis."

5. Referral / next-step statement
- Where this pathway requires developmental paediatric diagnostic confirmation, state that clearly — but do not claim the referring practitioner is a paediatrician unless patient details say so.
- Loop communication of findings to the referring practitioner using the correct title from the Referrer Type field (see user-message rules). Formal diagnostic confirmation may involve paediatric or other specialist review as clinically appropriate.

6. Closing integrative paragraph — REQUIRED final element
Conclude the formulation with a single integrative paragraph (4–6 sentences) that:
- characterises the client as a whole person including identified strengths
- acknowledges the developmental needs identified
- frames expected trajectory with appropriate intervention
- names the collaborative ecosystem (family, paediatric team, allied health, education) required to support the trajectory

# STRUCTURE

5-7 paragraphs total. 400-700 words. The final paragraph must be this integrative close.

# PARAGRAPH FORMAT (REQUIRED FOR PDF LAYOUT)

Separate **every** logical paragraph with a **blank line** (an empty line between blocks — press Enter twice so there is a visible gap in plain text). Single newlines inside a paragraph are only for short lists, not between major blocks.

Use this clinical pivot order (merge related points if needed to stay within 5-7 paragraphs, but keep the sequence clear):

1. Paragraph 1 — Diagnostic conclusion statement (must align with the locked opening when provided).
2. Paragraph 2 — Methodology / assessment context (consensus pathway, sources integrated).
3. Paragraph 3 — Domain A (social communication and interaction): synthesis of A1–A3 evidence.
4. Paragraph 4 — Domain B (restricted / repetitive behaviour and interests): synthesis of B1–B4 evidence.
5. Paragraph 5 — Exclusion, differential, and co-occurring conditions as clinically relevant.
6. Paragraph 6 — Referral pathway, communication of findings to referrer, and review recommendation.
7. Paragraph 7 — Strengths-based integrative closing paragraph (required close per rules above).

# CRITICAL RULES

- This is the ONLY section where diagnostic conclusions appear
- Use direct declarative language — no hedging
- Always cite the consensus pathway framework — this is what makes Texlex defensible (psychologist assesses; specialist confirmation as clinically appropriate)
- When developmental paediatric confirmation applies in this pathway, state it explicitly — without mislabelling the referring practitioner
- Always close with the required integrative paragraph described above
- For ruled-out cases, do NOT pad with deficit description — describe what was observed and clearly state the alternative formulation
- When the user message includes a CLINICAL LOCK with a mandatory opening sentence, reproduce that sentence verbatim as the first sentence of your output. It overrides any conflicting inference from criterion narratives. Do not contradict it later in the section`;

export interface FormulationVariables {
  clientName: string;
  pronouns: string;
  chronologicalAge: string;
  yearLevel: string;
  referringPractitioner: string;
  /** Intake "Referrer Type" — authoritative for professional title (GP, Paediatrician, etc.). */
  referringPractitionerType: string;
  /** Current school / ECEC from intake — anchors "current placement" in recency rules. */
  school?: string;
  rawNotes: string;
  criteriaState: string;
  collateralSummary: string;
  functionalImpactSummary: string;
  diagnosticConclusion: TexlexDiagnosticConclusion;
  lockedFormulationOpening: string;
  /** Optional: used by the API if `lockedFormulationOpening` is omitted (legacy callers). */
  overallLevel?: number | null;
}

export function buildFormulationUserPrompt(vars: FormulationVariables): string {
  const locked = vars.lockedFormulationOpening?.trim();
  const lockBlock = locked
    ? `CLINICAL LOCK — MANDATORY OPENING (verbatim first sentence)\n\nThe first sentence of your output MUST be exactly the following (character-for-character, including punctuation and spacing). Do not paraphrase.\n\n${locked}\n\nAfter this sentence, continue with the remainder of the Clinical Formulation per the structure rules (assessment context, criterion synthesis, co-occurring conditions, referral, integrative close). Do not contradict the locked opening anywhere in the section. Sentence 2 onward may include methodology and pathway context.\n\n---\n\n`
    : "";

  const freeOpeningInstruction = locked
    ? ""
    : `STRUCTURE INSTRUCTION: The very first sentence of your output must state the diagnostic conclusion clearly. State whether the client meets DSM-5-TR criteria for Autism Spectrum Disorder, the level of support classification (1, 2, or 3), and the core support need this reflects.

Example opening sentence: "Allan meets DSM-5-TR criteria for Autism Spectrum Disorder, with a presentation best characterised within the Level 2 range, reflecting a need for substantial support across social communication and restricted, repetitive behaviour domains."

Do NOT begin with methodology or process language. Do NOT begin with "X was assessed via the consensus-based neurodevelopmental assessment pathway..." Methodology can appear in sentence 2 or later, demoted to context.

The reader must know the diagnosis from the first sentence of this section.

`;

  return `${lockBlock}${freeOpeningInstruction}Diagnostic conclusion setting (clinician): ${vars.diagnosticConclusion}

# TASK

Draft the Clinical Formulation and Consensus Opinion section.

# CLIENT CONTEXT

Client name: ${vars.clientName || "[not provided]"}
Pronouns: ${vars.pronouns || "[not specified]"}
Chronological age: ${vars.chronologicalAge || "[not specified]"}
Year level: ${vars.yearLevel || "[not specified]"}
Current school / early childhood setting (from intake): ${vars.school?.trim() || "[not specified]"}
Referring practitioner name: ${vars.referringPractitioner || "[not specified]"}
Referring practitioner type (use this for title — do not infer specialty): ${vars.referringPractitionerType?.trim() || "[not specified]"}

# CRITERION OUTPUTS

${vars.criteriaState || "[no criterion content available]"}

# COLLATERAL SUMMARY

${vars.collateralSummary || "[no collateral summary available]"}

# FUNCTIONAL IMPACT SUMMARY

${vars.functionalImpactSummary || "[no functional impact summary available]"}

# RAW CLINICAL NOTES

${vars.rawNotes || "[no raw notes provided]"}

# EVIDENCE RECENCY (MANDATORY)

${CLINICAL_RECENCY_GATE_FORMULATION}

# REFERRING PRACTITIONER (MANDATORY)

${REFERRER_TYPE_HONESTY}

# WRITE THE CLINICAL FORMULATION AND CONSENSUS OPINION NOW

Plain prose. No preamble. Conclusive register — this is where diagnostic statements are made.`;
}
