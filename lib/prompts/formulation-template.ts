import { TEXLEX_SHARED_VOICE } from "./shared-voice";

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
- "[Client] additionally presents with [condition], with [paediatrician / psychiatrist] review required to confirm diagnosis."

5. Referral / next-step statement
- "Formal diagnostic confirmation is recommended via paediatric review, with referral to Dr [name] to finalise the diagnostic outcome for clinical and administrative purposes."
- "[Client] will require review by a Developmental Paediatrician to finalise the Autism Spectrum Disorder consensus outcome."

6. Closing integrative paragraph — REQUIRED final element
Conclude the formulation with a single integrative paragraph (4–6 sentences) that:
- characterises the client as a whole person including identified strengths
- acknowledges the developmental needs identified
- frames expected trajectory with appropriate intervention
- names the collaborative ecosystem (family, paediatric team, allied health, education) required to support the trajectory

# STRUCTURE

5-7 paragraphs total. 400-700 words. The final paragraph must be this integrative close.

# CRITICAL RULES

- This is the ONLY section where diagnostic conclusions appear
- Use direct declarative language — no hedging
- Always cite the consensus pathway framework — this is what makes Texlex defensible (psychologist assesses, paediatrician confirms)
- Always state the paediatrician referral requirement explicitly
- Always close with the required integrative paragraph described above
- For ruled-out cases, do NOT pad with deficit description — describe what was observed and clearly state the alternative formulation`;

export interface FormulationVariables {
  clientName: string;
  pronouns: string;
  chronologicalAge: string;
  yearLevel: string;
  referringPractitioner: string;
  rawNotes: string;
  criteriaState: string;
  collateralSummary: string;
  functionalImpactSummary: string;
}

export function buildFormulationUserPrompt(vars: FormulationVariables): string {
  return `STRUCTURE INSTRUCTION: The very first sentence of your output must state the diagnostic conclusion clearly. State whether the client meets DSM-5-TR criteria for Autism Spectrum Disorder, the level of support classification (1, 2, or 3), and the core support need this reflects.

Example opening sentence: "Allan meets DSM-5-TR criteria for Autism Spectrum Disorder, with a presentation best characterised within the Level 2 range, reflecting a need for substantial support across social communication and restricted, repetitive behaviour domains."

Do NOT begin with methodology or process language. Do NOT begin with "X was assessed via the consensus-based neurodevelopmental assessment pathway..." Methodology can appear in sentence 2 or later, demoted to context.

The reader must know the diagnosis from the first sentence of this section.

# TASK

Draft the Clinical Formulation and Consensus Opinion section.

# CLIENT CONTEXT

Client name: ${vars.clientName || "[not provided]"}
Pronouns: ${vars.pronouns || "[not specified]"}
Chronological age: ${vars.chronologicalAge || "[not specified]"}
Year level: ${vars.yearLevel || "[not specified]"}
Referring paediatrician: ${vars.referringPractitioner || "[paediatrician name not specified — use 'a collaborating Developmental Paediatrician' or 'Dr [name]' if name appears in raw notes]"}

# CRITERION OUTPUTS

${vars.criteriaState || "[no criterion content available]"}

# COLLATERAL SUMMARY

${vars.collateralSummary || "[no collateral summary available]"}

# FUNCTIONAL IMPACT SUMMARY

${vars.functionalImpactSummary || "[no functional impact summary available]"}

# RAW CLINICAL NOTES

${vars.rawNotes || "[no raw notes provided]"}

# WRITE THE CLINICAL FORMULATION AND CONSENSUS OPINION NOW

Plain prose. No preamble. Conclusive register — this is where diagnostic statements are made.`;
}
