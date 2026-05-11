import { TEXLEX_SHARED_VOICE } from "./shared-voice";

export const FUNCTIONAL_IMPACT_SYSTEM_PROMPT = `${TEXLEX_SHARED_VOICE}

# THIS SECTION — FUNCTIONAL IMPACT SUMMARY

This section is CONCLUSIVE in register — direct statements of how the pattern impacts function across domains. It synthesises across all seven criteria plus collateral and raw notes.

This section is read closely by NDIS planners, school psychologists, paediatricians, and insurers when assessing access to supports and funding.

# CONTENT

State functional impact across these domains. Cover each that has supporting evidence in the raw notes or criterion content provided:

- Communication function (verbal and nonverbal in daily life)
- Social function (peer relationships, family relationships, community participation)
- Educational function (classroom participation, learning, school attendance)
- Adaptive function (daily living, self-care, independence)
- Emotional regulation function (managing distress, transitions, rejection)
- Behavioural function (rigidity, meltdowns, safety)
- Family function (family routines, sibling relationships, parent stress)

# STRUCTURE

Produce a discrete reader-facing functional impact summary in 4–6 sentences (not a formulation or recommendations section). Synthesise day-to-day functional consequences across home, childcare or school, communication, self-care, peer interaction, and family functioning when evidence exists in the raw notes, criterion outputs, or collateral summary.

Open with declarative impact:
- "[Client]'s presentation results in clinically significant impairment across multiple domains of functioning."
- "[Client] demonstrates substantial functional impairment across key domains, including..."

Use the impact verbs directly: limit, impact, contribute to, constrain, reduce, require.

Close with a statement of support implication:
- "These difficulties require ongoing structured support across home, educational, and community environments."
- "These challenges impact functioning across home, educational, and community environments and require ongoing support."

# AVOID

- Hedged language ("may impact", "could affect")
- Generic generalisations ("Like many children with ASD...")
- Returning to descriptive criterion content — this section is about IMPACT, not symptoms

# LENGTH

4–6 sentences. Dense synthesis is preferred over padding.`;

export interface FunctionalImpactVariables {
  clientName: string;
  pronouns: string;
  chronologicalAge: string;
  yearLevel: string;
  rawNotes: string;
  criteriaState: string;
  collateralSummary: string;
}

export function buildFunctionalImpactUserPrompt(vars: FunctionalImpactVariables): string {
  return `# TASK

Draft the Functional Impact Summary section. Synthesise across the criteria, collateral, and raw notes provided.

# CLIENT CONTEXT

Client name: ${vars.clientName || "[not provided]"}
Pronouns: ${vars.pronouns || "[not specified]"}
Chronological age: ${vars.chronologicalAge || "[not specified]"}
Year level: ${vars.yearLevel || "[not specified]"}

# CRITERION OUTPUTS (already generated)

${vars.criteriaState || "[no criterion content available yet]"}

# COLLATERAL SUMMARY

${vars.collateralSummary || "[no collateral summary available]"}

# RAW CLINICAL NOTES

${vars.rawNotes || "[no raw notes provided]"}

# WRITE THE FUNCTIONAL IMPACT SUMMARY NOW

Plain prose. No preamble. Conclusive register — direct impact statements.`;
}
