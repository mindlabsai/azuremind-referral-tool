import {
  CLINICAL_RECENCY_GATE_FUNCTIONAL_IMPACT,
} from "./clinical-recency-referrer-blocks";
import { TEXLEX_SHARED_VOICE } from "./shared-voice";

export const FUNCTIONAL_IMPACT_SYSTEM_PROMPT = `${TEXLEX_SHARED_VOICE}

# THIS SECTION — FUNCTIONAL IMPACT SUMMARY

This section synthesises functional consequences of the client's presentation across domains of daily life. It does NOT introduce new clinical evidence — it consolidates the functional implications already established in the preceding sections.

This section is read closely by NDIS planners, school psychologists, paediatricians, and insurers when assessing access to supports and funding.

# CONTENT

Write a short functional-capacity summary for NDIS and school readers in one integrated voice — not two essays. Cover only domains the evidence supports; omit unsupported domains silently. Prefer merging related impacts into dense paragraphs over one paragraph per domain.

Domains to consider (include only when evidenced):
- Communication; social participation; learning / classroom access; self-management / regulation; self-care / daily living; community access

For each included impact, state what the client cannot do independently (or can only do with sustained support) relative to same-age expectation, and name the setting consequence (home, current school, community) briefly. Use NDIS-readable capacity language where evidenced (substantially reduced capacity; sustained rather than episodic support). Do not invent impairments for funding strength.

Do not name screening instruments or quote scores here. Do not assign adaptive scores or age-equivalents. Open with the client's first name. Third person. No recommendations list.

# EVIDENCE RECENCY (MANDATORY)

${CLINICAL_RECENCY_GATE_FUNCTIONAL_IMPACT}

# AVOID

- Hedged language ("may impact", "could affect")
- Generic generalisations ("Like many children with ASD...")
- Returning to descriptive criterion content — this section is about IMPACT, not symptoms

# LENGTH

Two to three short paragraphs (about 150–280 words). Every sentence states a real functional consequence. No padding, no domain-by-domain essay.

# PARAGRAPH FORMAT (PDF)

When the summary naturally falls into two or more blocks (for example home and school versus community and participation), separate blocks with a **blank line** (empty line between blocks) so the printed report shows distinct paragraphs.`;


export interface FunctionalImpactVariables {
  clientName: string;
  clientFirstName: string;
  pronouns: string;
  chronologicalAge: string;
  yearLevel: string;
  /** Current school / ECEC from intake — anchors current placement. */
  school?: string;
  rawNotes: string;
  presentingConcerns: string;
  backgroundText: string;
  criteriaState: string;
  collateralSummary: string;
  clinicalFormulation: string;
}

export function buildFunctionalImpactUserPrompt(vars: FunctionalImpactVariables): string {
  return `# TASK

You are writing the Functional Impact Summary section of a consensus-based neurodevelopmental assessment report in the voice defined by shared-voice.ts.

This section synthesises functional consequences of the client's presentation across domains of daily life. It does NOT introduce new clinical evidence — it consolidates the functional implications already established in the preceding sections.

# CLIENT CONTEXT

Client name: ${vars.clientName || "[not provided]"}
Client first name: ${vars.clientFirstName || "[not provided]"}
Pronouns: ${vars.pronouns || "[not specified]"}
Chronological age: ${vars.chronologicalAge || "[not specified]"}
Year level: ${vars.yearLevel || "[not specified]"}
Current school / early childhood setting (from intake): ${vars.school?.trim() || "[not specified]"}

# SOURCE MATERIAL

## Presenting concerns

${vars.presentingConcerns || "[no presenting concerns available]"}

## Background sections

${vars.backgroundText || "[no background sections available]"}

## Collateral summary

${vars.collateralSummary || "[no collateral summary available]"}

## DSM-5-TR criterion narratives (A1, A2, A3, B1, B2, B3, B4)

${vars.criteriaState || "[no criterion narratives available yet]"}

## Clinical formulation

${vars.clinicalFormulation || "[no clinical formulation available yet]"}

# RAW CLINICAL NOTES

${vars.rawNotes || "[no raw notes provided]"}

# RECENCY (RESTATE — MANDATORY)

${CLINICAL_RECENCY_GATE_FUNCTIONAL_IMPACT}

# WRITE THE FUNCTIONAL IMPACT SUMMARY NOW

Plain prose only. No headings, bullets, or labels. Open with the client's first name.`;
}
