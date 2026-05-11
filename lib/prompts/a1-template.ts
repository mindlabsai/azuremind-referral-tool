import { TEXLEX_SHARED_VOICE } from "./shared-voice";

export const A1_SYSTEM_PROMPT = `${TEXLEX_SHARED_VOICE}

# CRITERION A1 DEFINITION

A1. Social-Emotional Reciprocity considers differences relating to reciprocal social interaction, conversational reciprocity, shared emotional engagement, initiation and response within social interaction, and the capacity to sustain socially reciprocal communication across settings.

Relevant indicators to consider IF supported by raw notes:
- Initiation of social interaction (does the client approach others, or wait to be approached)
- Response to others' initiations
- Conversational turn-taking and topic maintenance
- One-sided interaction patterns (monologues, perseveration on preferred topics)
- Shared emotional engagement (sharing achievements, distress-seeking comfort, joint enjoyment)
- Reciprocal asking of questions about others
- Capacity to sustain back-and-forth exchange beyond brief interactions
- Cross-setting consistency (home / school / peers / community)
- Reduced spontaneous sharing of thoughts or emotions
- Literal communication style with reduced flexibility

Include only indicators supported by raw notes. Do not include indicators without supporting evidence.`;

export interface A1PromptVariables {
  clientName: string;
  pronouns: string;
  chronologicalAge: string;
  yearLevel: string;
  rawNotes: string;
  a1Markers: string;
}

export function buildA1UserPrompt(vars: A1PromptVariables): string {
  return `# TASK

Draft the "Observed / Reported Indicators" section for Criterion A1 (Social-Emotional Reciprocity) of a Texlex consensus-based ASD assessment report.

# CLIENT CONTEXT

Client name: ${vars.clientName || "[not provided]"}
Pronouns: ${vars.pronouns || "[not provided]"}
Chronological age: ${vars.chronologicalAge || "[not provided]"}
Year level / educational setting: ${vars.yearLevel || "[not provided]"}

# RAW CLINICAL NOTES

The following are unstructured clinical notes from the assessment session. Extract A1-relevant observations only. Ignore content relevant to other criteria — those are drafted separately.

${vars.rawNotes || "[no raw notes provided]"}

# ENGINE-DETECTED A1 MARKERS (advisory)

The detection engine identified the following A1-relevant markers in the raw notes. Use these as a checklist of evidence to consider. Do NOT reproduce marker labels verbatim — translate into prose. Do not include markers that lack actual supporting content (the engine sometimes over-detects).

${vars.a1Markers || "(no markers detected)"}

# WRITE THE SECTION NOW

Output the A1 Indicators section in plain prose, following the three-paragraph defensibility structure (clinical observation → parent/collateral report → functional impact). Do not include any preamble — output the paragraphs directly.`;
}
