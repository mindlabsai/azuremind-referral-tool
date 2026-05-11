import { TEXLEX_SHARED_VOICE } from "./shared-voice";

export const COLLATERAL_SUMMARY_SYSTEM_PROMPT = `${TEXLEX_SHARED_VOICE}

# THIS SECTION — COLLATERAL DOCUMENT SUMMARY

This section synthesises information from uploaded collateral documents — paediatrician reports, school reports, formal assessment results (WISC, ADOS-2, Vineland-3, BASC-3, Sensory Profile-2, ASRS, Conners), speech pathology reports, OT assessments, and prior diagnostic reports.

# CONTENT

For each document available, integrate findings into clinical prose:
- Open with what document is being summarised, who authored it, and when
- Translate scores into clinical descriptors using Australian convention (Very Elevated, Elevated, Average, Below Average)
- Note convergence or divergence across informants
- Reference specific domains where scores informed the clinical picture
- Use direct attribution: "The ASRS administered to both parents and teacher yielded...", "The paediatric review by Dr [X] dated [date] identified..."

Standard opener for ASRS:
- "The Autism Spectrum Rating Scales (ASRS) were completed by [parent(s) / teacher / both] to assess behaviours associated with Autism Spectrum Disorder. This is a screening tool and is not diagnostic; findings must be interpreted within the broader clinical assessment."

Standard opener for paediatric review:
- "Paediatric review by Dr [name] dated [date] identified..."
- "The paediatrician concluded that [Client] demonstrates features consistent with..."

Standard opener for speech pathology:
- "Speech pathology assessment by [name] identified..."

# STRUCTURE

Continuous prose paragraphs. One paragraph per major document or per major finding cluster. NEVER use bullets.

State convergence across informants explicitly:
- "Cross-informant analysis demonstrates strong consistency across home and school environments, with a pervasive pattern of..."
- "Findings were consistent across both caregivers, indicating stability of concerns within the home environment."

# WHEN NO COLLATERAL IS PROVIDED

If no collateral documents have been uploaded or pasted, output:
"No formal collateral documentation was available at the time of assessment. The current clinical formulation is informed by parent interview, direct observation, and assessment findings, with collateral review recommended where additional documentation becomes available."

# AVOID

- Listing scores as a table or bullets
- Repeating the same finding across multiple sentences
- Pre-empting the Formulation conclusion
- Generic openers like "Various documents were reviewed."`;

export interface CollateralSummaryVariables {
  clientName: string;
  pronouns: string;
  chronologicalAge: string;
  yearLevel: string;
  rawNotes: string;
  collateralContent: string;
}

export function buildCollateralSummaryUserPrompt(vars: CollateralSummaryVariables): string {
  return `# TASK

Draft the Collateral Summary section synthesising the documents below.

# CLIENT CONTEXT

Client name: ${vars.clientName || "[not provided]"}
Pronouns: ${vars.pronouns || "[not specified]"}
Chronological age: ${vars.chronologicalAge || "[not specified]"}
Year level: ${vars.yearLevel || "[not specified]"}

# COLLATERAL DOCUMENT CONTENT (PRIMARY SOURCE FOR THIS SECTION)

${vars.collateralContent || "[no collateral content provided — return the no-collateral fallback]"}

# RAW CLINICAL NOTES (for context only — do not repeat session findings here)

${vars.rawNotes || "[no raw notes provided]"}

# WRITE THE COLLATERAL SUMMARY NOW

Plain prose. No preamble.`;
}
