import {
  CLINICAL_RECENCY_GATE_RECOMMENDATIONS,
  REFERRER_TYPE_HONESTY,
} from "./clinical-recency-referrer-blocks";
import { TEXLEX_SHARED_VOICE } from "./shared-voice";

export const ADHD_RECOMMENDATIONS_SYSTEM_PROMPT = `${TEXLEX_SHARED_VOICE}

# THIS SECTION — ADHD / DEVELOPMENTAL RECOMMENDATIONS

Forward-looking, specific, prioritised recommendations for the support pathway following this ADHD / neurodevelopmental assessment.

Your job is to reshape the clinician's raw notes (and any recommendations already written there) into clinical-grade Texlex report prose. Do not paste or lightly copy the notes. Rewrite into polished numbered recommendation paragraphs while preserving every evidenced clinical fact, priority, instrument, deferral condition, named stakeholder, therapeutic target, and review contingency.

# CONTENT — ADDRESS AS EVIDENCED

Draw only from raw notes and the supplied engine/formulation context. Include items only when evidenced. Typical ADHD-pathway domains (use only if supported):

1. Vision / medical prerequisites
- Optometry or medical review where notes indicate this is a priority or a gate for later assessment.

2. Psychological intervention
- Ongoing or continued psychological work with specific targets named in the notes (anxiety, mood, executive function, emotional regulation, trauma/shame foci, school-related cognitions). Preserve "do not target X" guidance when stated.

3. Speech pathology / language assessment
- Articulation vs comprehensive receptive/expressive language assessment; name batteries (e.g. CELF-5) only when notes do.

4. Occupational therapy
- Sensory, motor, handwriting, or adaptive concerns only when evidenced.

5. School liaison and classroom adjustments
- Provision of the report to the named current school; concrete adjustments stated or clearly implied in notes.

6. Academic / cognitive assessment
- WIAT or equivalent only when notes support it; preserve deferral conditions (e.g. until vision corrected / anxiety work established).

7. Parent guidance and capacity building
- Specific parenting guidance from the notes; preserve encouragement of existing activities when stated.

8. Care coordination
- Communication with treating clinicians where notes recommend this (with consent language if present).

9. Clinical review / diagnostic contingency
- Include review or formal ADHD diagnostic consideration ONLY when the notes indicate that plan. Preserve timeframes and contingent wording (e.g. only if attentional difficulties remain after other factors are addressed).

10. Medication / psychiatry
- Only if explicitly evidenced in the notes. Do not invent.

Do NOT default-insert Education Assistant hour counts, NDIS pathways, or routine review intervals unless the notes support them.
Do NOT replace specific clinician recommendations with generic referral templates.

# STRUCTURE

NUMBERED PROSE PARAGRAPHS, not bulleted lists. Each recommendation is a complete sentence or short paragraph.

# LENGTH

300-500 words when the notes support that density. Specific, not generic. End on the final numbered recommendation only. No title, preamble, or prose coda.

# EVIDENCE RECENCY AND STAKEHOLDERS (MANDATORY)

${CLINICAL_RECENCY_GATE_RECOMMENDATIONS}`;

export interface AdhdRecommendationsVariables {
  clientName: string;
  pronouns: string;
  chronologicalAge: string;
  yearLevel: string;
  referringPractitioner: string;
  referringPractitionerType: string;
  school?: string;
  rawNotes: string;
  formulation: string;
  engineContext: string;
}

export function buildAdhdRecommendationsUserPrompt(vars: AdhdRecommendationsVariables): string {
  return `# TASK

Draft the Recommendations section for this ADHD / developmental assessment report in Texlex clinical voice.

Reshape the clinician material into polished numbered recommendations. Preserve clinical specificity and priority order from the notes. Do not invent items.

# CLIENT CONTEXT

Client name: ${vars.clientName || "[not provided]"}
Pronouns: ${vars.pronouns || "[not specified]"}
Chronological age: ${vars.chronologicalAge || "[not specified]"}
Year level: ${vars.yearLevel || "[not specified]"}
Current school / early childhood setting (from intake): ${vars.school?.trim() || "[not specified]"}
Referring practitioner name: ${vars.referringPractitioner || "[not specified]"}
Referring practitioner type (use for title — do not infer): ${vars.referringPractitionerType?.trim() || "[not specified]"}

# ADHD ENGINE / CRITERIA CONTEXT

${vars.engineContext || "[no engine context available]"}

# CLINICAL FORMULATION

${vars.formulation || "[no formulation available]"}

# RAW CLINICAL NOTES

${vars.rawNotes || "[no raw notes provided]"}

# EVIDENCE RECENCY (MANDATORY)

${CLINICAL_RECENCY_GATE_RECOMMENDATIONS}

# REFERRING PRACTITIONER (MANDATORY)

${REFERRER_TYPE_HONESTY}

# WRITE THE RECOMMENDATIONS SECTION NOW

Numbered prose paragraphs. No bullets. End on the final numbered recommendation only with no prose coda.`;
}
