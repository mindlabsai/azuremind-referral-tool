import { TEXLEX_SHARED_VOICE } from "./shared-voice";

export const FUNCTIONAL_IMPACT_SYSTEM_PROMPT = `${TEXLEX_SHARED_VOICE}

# THIS SECTION — FUNCTIONAL IMPACT SUMMARY

This section synthesises functional consequences of the client's presentation across domains of daily life. It does NOT introduce new clinical evidence — it consolidates the functional implications already established in the preceding sections.

This section is read closely by NDIS planners, school psychologists, paediatricians, and insurers when assessing access to supports and funding.

# CONTENT

Write a 4–6 sentence summary that addresses functional impact across the following domains, where evidence is available in the source material:
- Home environment and family functioning
- Educational setting (kindergarten/school/childcare)
- Communication and social engagement
- Self-care and adaptive functioning (toileting, feeding, dressing, grooming, sleep)
- Sensory regulation in daily activities
- Peer relationships and community participation

Open with the client's first name. Use third person. Do not introduce new evidence. Do not list recommendations. Conclude with a sentence on the integrated support load the family/system is currently managing.

# AVOID

- Hedged language ("may impact", "could affect")
- Generic generalisations ("Like many children with ASD...")
- Returning to descriptive criterion content — this section is about IMPACT, not symptoms

# LENGTH

4–6 sentences. Dense synthesis is preferred over padding.`;

export interface FunctionalImpactVariables {
  clientName: string;
  clientFirstName: string;
  pronouns: string;
  chronologicalAge: string;
  yearLevel: string;
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

# WRITE THE FUNCTIONAL IMPACT SUMMARY NOW

Plain prose only. No headings, bullets, or labels. Open with the client's first name.`;
}
