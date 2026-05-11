import { TEXLEX_SHARED_VOICE } from "./shared-voice";

export const RECOMMENDATIONS_SYSTEM_PROMPT = `${TEXLEX_SHARED_VOICE}

# THIS SECTION — RECOMMENDATIONS

Forward-looking, specific, prioritised recommendations for the support pathway following this assessment.

# CONTENT

Address as relevant from raw notes and criterion content:

1. Paediatrician / Psychiatrist referral pathway (always required for diagnostic confirmation)
- "[Client] will require review by a Developmental Paediatrician to finalise the Autism Spectrum Disorder consensus outcome."
- "Paediatrician or psychiatrist review is also recommended to ratify the Attention-Deficit/Hyperactivity Disorder diagnosis and guide management."

2. Education Assistant hours (where applicable, school-aged)
- "Provision of a minimum of [N] hours per week of Education Assistant support within the school environment to facilitate engagement with the curriculum, support behavioural regulation, and scaffold social participation."

3. Speech pathology (where speech/language delay or pragmatic concerns)
- "Ongoing speech pathology intervention, with a focus on [receptive / expressive / pragmatic / functional communication]."

4. Occupational therapy (where sensory, motor, or adaptive concerns)
- "Occupational therapy intervention targeting sensory processing, emotional regulation, fine motor development, and participation in daily routines."

5. Psychology / behavioural support
- "Ongoing psychological therapy with a clinician experienced in [paediatric / adolescent] Autism Spectrum Disorder, with focus on [domain]."

6. Social skills support (where indicated)
- "Implementation of structured social skills support, including facilitated peer interaction and development of age-appropriate social understanding."

7. School-based planning (where indicated)
- "School-based support planning, including [graded return / reduced demand / structured accommodations / sensory accommodations]."

8. Parent support and capacity building
- "Parent support and capacity building, including guidance in behavioural strategies, emotional regulation support, and management of [domain]."

9. NDIS pathway (where indicated)
- "NDIS application support to access funded supports including [domain]."

10. Follow-up
- "Review with the assessing psychologist in [timeframe] to monitor progress and review support adequacy."

# STRUCTURE

NUMBERED PROSE PARAGRAPHS, not bulleted lists. Each recommendation is a complete sentence or short paragraph. Format as:

"1. Provision of a minimum of 24 hours per week of Education Assistant support within the school environment to facilitate engagement with the curriculum, support behavioural regulation, and scaffold social participation.

2. Ongoing speech pathology intervention, with a focus on both receptive and expressive language development, functional communication, and pragmatic language skills.

3. Occupational therapy intervention targeting sensory processing, emotional regulation, fine motor development, and participation in daily routines."

# LENGTH

300-500 words. Specific, not generic. End on the final numbered recommendation only. Do not add a prose coda after the last numbered item.`;

export interface RecommendationsVariables {
  clientName: string;
  pronouns: string;
  chronologicalAge: string;
  yearLevel: string;
  referringPractitioner: string;
  rawNotes: string;
  criteriaState: string;
  formulation: string;
  functionalImpactSummary: string;
}

export function buildRecommendationsUserPrompt(vars: RecommendationsVariables): string {
  return `# TASK

Draft the Recommendations section.

# CLIENT CONTEXT

Client name: ${vars.clientName || "[not provided]"}
Pronouns: ${vars.pronouns || "[not specified]"}
Chronological age: ${vars.chronologicalAge || "[not specified]"}
Year level: ${vars.yearLevel || "[not specified]"}
Referring paediatrician: ${vars.referringPractitioner || "[not specified]"}

# CRITERION OUTPUTS

${vars.criteriaState || "[no criterion content available]"}

# CLINICAL FORMULATION

${vars.formulation || "[no formulation available]"}

# FUNCTIONAL IMPACT SUMMARY

${vars.functionalImpactSummary || "[no functional impact summary available]"}

# RAW CLINICAL NOTES

${vars.rawNotes || "[no raw notes provided]"}

# WRITE THE RECOMMENDATIONS SECTION NOW

Numbered prose paragraphs. No bullets. End on the final numbered recommendation only with no prose coda.`;
}
