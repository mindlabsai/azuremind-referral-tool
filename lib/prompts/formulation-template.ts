import { clientFirstName } from "@/app/asd-engine/report/pdf/utils";
import type { TexlexDiagnosticConclusion } from "@/lib/texlex-diagnostic-conclusion";
import { CLINICAL_RECENCY_GATE_FORMULATION } from "./clinical-recency-referrer-blocks";
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
  1: "requiring support",
  2: "requiring substantial support",
  3: "requiring very substantial support",
};

function levelPhrase(level: number): string {
  if (level === 1 || level === 2 || level === 3) return LEVEL_SUPPORT_PHRASE[level];
  throw new Error(
    `buildLockedFormulationOpening: invalid level value ${level}. Expected 1, 2, or 3.`
  );
}

export class FormulationLevelMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FormulationLevelMissingError";
  }
}

export function buildLockedFormulationOpening(args: {
  conclusion: TexlexDiagnosticConclusion;
  clientName: string;
  criteria: Record<string, FormulationCriterionSnapshot>;
  levelA: number | null;
  levelB: number | null;
  determinable: boolean;
}): string {
  const name = clientFirstName(args.clientName.trim()) || "The client";
  const fullName = args.clientName.trim() || name;

  if (args.conclusion === "meets") {
    if (!args.determinable || args.levelA == null || args.levelB == null) {
      throw new FormulationLevelMissingError(
        "Cannot build 'meets' formulation opening without determined Level A and Level B. " +
          "Complete criterion ratings before generating the clinical formulation."
      );
    }
    const levelA = args.levelA;
    const levelB = args.levelB;
    const phraseA = levelPhrase(levelA);
    const phraseB = levelPhrase(levelB);

    if (levelA === levelB) {
      return `${fullName} meets DSM-5-TR criteria for Autism Spectrum Disorder, Level ${levelA} across both diagnostic domains: social communication and social interaction (${phraseA}), and restricted and repetitive patterns of behaviour, interests, or activities (${phraseB}).`;
    }
    return `${fullName} meets DSM-5-TR criteria for Autism Spectrum Disorder, with a domain-specific support profile: social communication and social interaction at Level ${levelA} (${phraseA}), and restricted and repetitive patterns of behaviour, interests, or activities at Level ${levelB} (${phraseB}).`;
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

CONCLUSIVE register for the diagnostic determination: this section MAKES the diagnostic claim rather than merely describing evidence. But conclusive does not mean uniformly certain, the strength of each claim must match the strength of its evidence (see the diction and calibration guidance below). State what is established plainly; mark what is uncertain plainly.

# CONTENT

Required components in order (integrated narrative — not a second evidence tour):

1. Opening diagnostic conclusion — the very first sentence of the section
- When a CLINICAL LOCK opening is supplied, reproduce it verbatim as sentence 1. Do NOT restate, paraphrase, or invent severity levels elsewhere in the section. Severity language outside the locked opening is an error.
- For ruled-out: "Findings do not support a diagnosis of Autism Spectrum Disorder. [Client]'s presentation is better characterised by [alternative formulation]."

2. Developmental course and present-day mechanism — short synthesis
- When the profile emerged and its stability; how current demands (school year, peers, sensory environment) interact with the profile. Do NOT re-narrate Criterion A/B evidence — those sections already hold it. At most one or two emblematic clinical anchors total.

3. Psychosocial weighing and co-occurring conditions (as evidenced)
- Family/transition/perinatal factors as load on the profile or excluded as cause; co-occurring conditions from notes with specialist review where needed.

4. Pathway statement — conclusion-dependent, one or two sentences
- If MEETS: preliminary outcome of the consensus-based pathway; formal confirmation through Developmental Paediatric review is next. Do not write that the diagnosis is confirmed, established, or proven. Do NOT name the referring practitioner.
- If DOES NOT MEET: clinical conclusion + continued developmental review in general terms where appropriate.
- If inconclusive: further clarification through the appropriate developmental review pathway.

5. Closing — strengths and protective factors woven in 2–3 sentences (not a long block)
- Capacities to build on, existing supports, prognosis with coordinated intervention.

# STRUCTURE

3–5 paragraphs total. 250–400 words. Dense synthesis over length. Sentences ideally 30 words or fewer. At most ONE cross-informant convergence statement and ONE pervasiveness/settings statement in the whole section. No stacked intensifiers.

# SEVERITY LANGUAGE BAN

Never state or imply DSM support levels (Level 1/2/3, "requiring support/substantial/very substantial support") outside the locked opening sentence. The locked opening already carries domain-specific levels.

# PARAGRAPH FORMAT (REQUIRED FOR PDF LAYOUT)

Separate **every** logical paragraph with a **blank line** (an empty line between blocks — press Enter twice so there is a visible gap in plain text).

Use this clinical pivot order (merge related points to stay within 3–5 paragraphs):

1. Paragraph 1 — Diagnostic conclusion (locked opening when provided) + brief assessment context.
2. Paragraph 2 — Developmental course / present-day mechanism (no criterion re-tour).
3. Paragraph 3 — Psychosocial weighing, differentials, co-occurring conditions as relevant.
4. Paragraph 4 — Pathway statement (merge with close if needed).
5. Paragraph 5 — Strengths-based close (2–3 sentences).

# FORMULATION REASONING

The formulation explains WHY the evidence supports the diagnostic conclusion the engine has determined. It is not a summary of symptoms, a restatement of DSM criteria, or a checklist of behaviours.

Do not use the diagnostic label as its own explanation.
Avoid: "Adeela has difficulty with friendships because of autism."
Prefer: "Parent report, teacher information, and assessment observation each describe difficulty establishing and maintaining peer relationships; taken together these support social communication differences consistent with the diagnostic conclusion."

Integrate across sources rather than discussing each separately. Describe the patterns that emerge across observation, collateral, and findings, and explain how they form a coherent clinical picture. Where the material supports it, consider alternative explanations. The granular evidence already appears in the criterion and functional impact sections; here you synthesise it upward, you do not re-narrate it, and you introduce no new facts during synthesis.

Note on diagnostic register: stating that the client MEETS DSM-5-TR criteria is correct and intended (this is the psychologist's role and matches the locked opening). Do NOT write that the diagnosis is "confirmed", "established", or "proven"; formal diagnostic confirmation rests with the developmental paediatrician within the consensus pathway.


# HOW A SENIOR ASSESSOR WRITES THIS (VOICE, CALIBRATION, DICTION)

A sound formulation reads as the work of a senior clinician writing to a respected colleague: integrated, economical, calibrated.

CALIBRATED CERTAINTY (the central discipline). Match every claim to the strength of its evidence, and let the verb carry the calibration. Observed or convergent across sources: "demonstrates", "presents with", "is evident", "is documented", "converges". Inferred or single-source: "suggests", "indicates", "is consistent with", "points to", "is best understood as". Genuinely uncertain: "cannot be reliably established", "remains unclear", "is not clearly evidenced", "warrants further consideration". Never use a high-certainty verb on low-certainty evidence. Treating an uncertainty as resolved to make the picture cleaner is a serious failure; the limits of the evidence are themselves clinical information, and a formulation is more authoritative, not less, for marking precisely what it does and does not establish.

BOUND TO THE RATINGS. The criterion ratings and narratives are the clinician's determinations and are authoritative. Synthesise them; never override, strengthen, or contradict them. If a criterion is rated uncertain or its narrative hedges, the formulation MUST carry that same uncertainty and must not resolve it. This engine supports the clinician's judgement; it does not substitute its own.

CLINICAL THREAD. Build the formulation around one central clinical understanding of this child that the whole piece serves, not a criterion-by-criterion tally, so the reader leaves with a picture, not an inventory.

WEIGHTING AND INTEGRATION. Show how the evidence coheres: which strand is most robust, where sources converge, where they tension. A flat or divergent collateral finding is integrated and explained, not omitted or explained away.

DICTION. Alternate register deliberately: the precise clinical term to carry the diagnostic claim, plain grounded English to give the picture and the human texture. One clinical term plus a concrete observed example lands harder than two abstractions. Use the established lexicon (reciprocity, initiation, stereotypy, dysregulation, circumscribed, pervasive, sustained, concretely processed, poorly sustained) where it compresses and sharpens; drop to plain English where the elevated term would only inflate.

AVOID: double-hedging ("may possibly suggest"); empty intensifiers ("very", "really", "quite"); therapeutic cliche and machine-isms ("journey", "navigate her world", "tapestry", "thrive", "delve", "it is important to note", "showcase", "holistic"); diagnostic overstatement ("confirmed", "established", "proven" for a determination that is preliminary or pending paediatric review); nominalisation overload (prefer "she did not initiate" to "there was an absence of initiation behaviour").

DEFENSIBILITY TEST. Every word should be defensible against the evidence and against a reader who may be a paediatrician, an NDIS delegate, or a tribunal. If you could not defend the exact word, choose a more calibrated one.

# CRITICAL RULES

- This is the ONLY section where diagnostic conclusions appear
- Use direct declarative language for the diagnostic determination and for findings the evidence supports. This does NOT mean forcing certainty onto genuinely uncertain criteria: where a criterion is rated uncertain or its narrative hedges (for example onset that "cannot be reliably determined"), carry that uncertainty forward in calibrated language and do not resolve it to sound more conclusive. Conclusive on what the evidence establishes; calibrated on what it does not.
- Always cite the consensus pathway framework — this is what makes Texlex defensible (psychologist assesses; specialist confirmation as clinically appropriate)
- When developmental paediatric confirmation applies in this pathway, state it explicitly — without mislabelling the referring practitioner
- Close with the strengths-based 2–3 sentences described above
- For ruled-out cases, do NOT pad with deficit description — describe what was observed and clearly state the alternative formulation
- When the user message includes a CLINICAL LOCK with a mandatory opening sentence, reproduce that sentence verbatim as the first sentence of your output. It overrides any conflicting inference from criterion narratives. Do not contradict it later in the section
- Do not restate severity levels after the locked opening`;

/** Pass-1 output budget — keep room for locked opening without inviting essay length. */
export const FORMULATION_MAX_OUTPUT_TOKENS = 1800;

export const FORMULATION_WORD_TARGET = { min: 250, max: 400 } as const;

/** Passed to the voice critic as styleGuidance — compress-or-keep only. */
export const FORMULATION_CRITIC_RULES = `FORMULATION LENGTH / COMPRESSION LOCK:
You may KEEP or SHORTEN the draft. You may NEVER lengthen it: output must be <= the draft's word count and <= ${FORMULATION_WORD_TARGET.max} words.
Do not add new facts, praise sentences, or restated criterion evidence.
Fix: sentences over ~30 words, repeated convergence or pervasiveness statements, stacked intensifiers, filler ("it is noteworthy that"), and any severity-level language outside the first (locked) sentence — delete those level phrases from body prose.
If the draft already complies, return it unchanged.`;

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
  /** DSM-5-TR Criterion A level of support (1/2/3). Required when conclusion is "meets". */
  levelA?: number | null;
  /** DSM-5-TR Criterion B level of support (1/2/3). Required when conclusion is "meets". */
  levelB?: number | null;
  /** Whether the engine determined both A and B levels. Required when conclusion is "meets". */
  determinable?: boolean;
}

export function buildFormulationUserPrompt(vars: FormulationVariables): string {
  const locked = vars.lockedFormulationOpening?.trim();
  const lockBlock = locked
    ? `CLINICAL LOCK — MANDATORY OPENING (verbatim first sentence)\n\nThe first sentence of your output MUST be exactly the following (character-for-character, including punctuation and spacing). Do not paraphrase.\n\n${locked}\n\nAfter this sentence, continue with a concise integrated formulation (developmental course, mechanism, psychosocial weighing, pathway, strengths close). Do NOT re-tour Criterion A/B evidence. Do NOT restate severity levels anywhere after this locked sentence. Do not mention the referring practitioner.\n\n---\n\n`
    : "";

  const freeOpeningInstruction = locked
    ? ""
    : `STRUCTURE INSTRUCTION: The very first sentence of your output must state the diagnostic conclusion clearly. When levels apply, state domain-specific support levels once in that opening sentence only; do not repeat level language later.

Do NOT begin with methodology or process language. The reader must know the diagnosis from the first sentence of this section.

`;

  return `${lockBlock}${freeOpeningInstruction}Diagnostic conclusion setting (clinician): ${vars.diagnosticConclusion}

# TASK

Draft the Clinical Formulation and Consensus Opinion section (250–400 words, 3–5 paragraphs).

# CLIENT CONTEXT

Client name: ${vars.clientName || "[not provided]"}
Pronouns: ${vars.pronouns || "[not specified]"}
Chronological age: ${vars.chronologicalAge || "[not specified]"}
Year level: ${vars.yearLevel || "[not specified]"}
Current school / early childhood setting (from intake): ${vars.school?.trim() || "[not specified]"}

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

# WRITE THE CLINICAL FORMULATION AND CONSENSUS OPINION NOW

Plain prose. No preamble. Conclusive register — this is where diagnostic statements are made.`;
}
