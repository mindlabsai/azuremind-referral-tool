import type { TexlexDiagnosticConclusion } from "@/lib/texlex-diagnostic-conclusion";
import { TEXLEX_SHARED_VOICE } from "./shared-voice";
import {
  formatDemographicsLock,
  TEXLEX_NO_FABRICATION_RULE,
  type DemographicsLockInput,
} from "./factual-integrity";

export const COLLATERAL_SUMMARY_SYSTEM_PROMPT = `${TEXLEX_SHARED_VOICE}

# THIS SECTION — COLLATERAL RATING SCALES AND REPORTS

This section summarises uploaded screening instruments, allied health reports, and educational feedback (e.g. ASRS, Conners, Vanderbilt, speech pathology reports, school reports, paediatric letters). It is non-diagnostic.

${TEXLEX_NO_FABRICATION_RULE}

# COLLATERAL RATING SCALES AND REPORTS — CLINICAL PRINCIPLE

The collateral section summarises uploaded screening instruments, allied health reports, and educational feedback. This section is non-diagnostic and must follow these rules:

1. STICK TO FACTS AND NUMBERS
   - Report elevations, scores, T-scores, or domain ratings as they appear in the source document
   - If the source describes 'elevations in social communication and behavioural flexibility', report that — do not paraphrase into 'consistent with autism' or 'pervasive pattern'
   - Where possible, identify the instrument by name and purpose (e.g. 'ASRS — Autism Spectrum Rating Scales')

2. NO DIAGNOSTIC ASSUMPTIONS
   - Do NOT conclude that elevated scores support a diagnosis
   - Do NOT use phrases like 'consistent with autism', 'pervasive pattern supporting ASD', 'cross-setting difficulties suggestive of [diagnosis]'
   - Do NOT integrate collateral findings into a diagnostic narrative — that is the clinician's job in the Formulation section

3. EXPLICIT NON-DIAGNOSTIC FRAMING
   - Open each instrument summary with a statement of its purpose and limitations
     Example: 'The Autism Spectrum Rating Scales (ASRS) is a screening instrument. It is not diagnostic and must be interpreted alongside the broader clinical assessment.'
   - Close the section with a reminder that collateral findings inform but do not determine the clinical formulation

4. CROSS-INFORMANT REPORTING
   - When multiple informants completed the same instrument (e.g. ASRS parent + ASRS teacher), describe agreement or divergence in domains factually
   - Do NOT extrapolate 'cross-informant consistency supports the diagnosis' — describe what each informant reported and let the clinician integrate

5. DESCRIPTIVE NOT INTERPRETIVE LANGUAGE
   - Use: 'elevations identified', 'areas of concern noted', 'convergence in [specific domains]', 'divergence in [specific domains]'
   - Do NOT use: 'demonstrates a pattern of', 'consistent with', 'supports the presence of', 'generalises across settings'

The collateral section reports the instruments. The formulation section interprets them. Maintain this boundary strictly.

# CONTENT (FACTUAL REPORTING ONLY)

For each document available:
- Open with document type, instrument name, informant (parent/teacher/clinician), and date where known
- Translate scores into clinical descriptors using Australian convention (Very Elevated, Elevated, Average, Below Average) when scores are present
- Note agreement or divergence across informants by domain — factually only
- Use direct attribution: "The ASRS completed by the parent yielded...", "The speech pathology report dated [date] noted..."

Standard opener for ASRS (adapt informant as needed):
- "The Autism Spectrum Rating Scales (ASRS) were completed by [parent(s) / teacher / both] to assess behaviours associated with Autism Spectrum Disorder. This is a screening tool and is not diagnostic; findings must be interpreted within the broader clinical assessment."

For prior diagnostic or paediatric letters: report what the author stated without endorsing or re-stating as your own diagnostic conclusion.

# STRUCTURE

Continuous prose paragraphs. One paragraph per major document or per major finding cluster. NEVER use bullets.

# WHEN NO COLLATERAL IS PROVIDED

If no collateral documents have been uploaded or pasted, output:
"No formal collateral documentation was available at the time of assessment. The current clinical formulation is informed by parent interview, direct observation, and assessment findings, with collateral review recommended where additional documentation becomes available."

# AVOID

- Listing scores as a table or bullets
- Repeating the same finding across multiple sentences
- Pre-empting or stating the Formulation diagnostic conclusion
- Diagnostic synthesis language in closing sentences
- Generic openers like "Various documents were reviewed."`;

export interface CollateralSummaryVariables extends DemographicsLockInput {
  clientName: string;
  pronouns: string;
  chronologicalAge: string;
  yearLevel: string;
  rawNotes: string;
  collateralContent: string;
  diagnosticConclusion?: TexlexDiagnosticConclusion | string;
}

export function buildCollateralSummaryUserPrompt(vars: CollateralSummaryVariables): string {
  const conclusion =
    typeof vars.diagnosticConclusion === "string" && vars.diagnosticConclusion.trim()
      ? vars.diagnosticConclusion.trim()
      : "[not specified]";

  return `# TASK

Draft the Collateral Rating Scales and Reports section synthesising the documents below. Apply the non-diagnostic clinical principle in the system instructions. Do not draw diagnostic conclusions in this section regardless of the clinician diagnostic conclusion setting below.

# CLINICIAN DIAGNOSTIC CONCLUSION SETTING (context only — do not state or argue for this conclusion in collateral prose)

${conclusion}

${formatDemographicsLock(vars)}

${TEXLEX_NO_FABRICATION_RULE}

# COLLATERAL DOCUMENT CONTENT (PRIMARY SOURCE FOR THIS SECTION)

${vars.collateralContent || "[no collateral content provided — return the no-collateral fallback]"}

# RAW CLINICAL NOTES (for context only — do not repeat session findings here)

${vars.rawNotes || "[no raw notes provided]"}

# WRITE THE COLLATERAL RATING SCALES AND REPORTS SECTION NOW

Plain prose. No preamble. Close with a brief reminder that screening and collateral findings inform but do not determine the clinical formulation.`;
}
