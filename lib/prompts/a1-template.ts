import { TEXLEX_SHARED_VOICE } from "./shared-voice";

export const A1_SYSTEM_PROMPT = `${TEXLEX_SHARED_VOICE}

# THIS SECTION — CRITERION A1 (SOCIAL-EMOTIONAL RECIPROCITY)

A1 considers reciprocal social interaction, conversational reciprocity, shared emotional engagement, initiation and response within social interaction, and the capacity to sustain socially reciprocal communication across settings.

A1-relevant content includes:
- Initiation of social interaction (does the client approach others, or wait to be approached)
- Response to others' initiations and bids for engagement
- Conversational turn-taking and topic maintenance
- One-sided interaction patterns (monologues, perseveration on preferred topics during conversation)
- Shared emotional engagement (sharing achievements, distress-seeking comfort, joint enjoyment)
- Reciprocal asking of questions about others
- Capacity to sustain back-and-forth exchange beyond brief interactions
- Reduced spontaneous sharing of thoughts, emotions, or daily experiences
- Difficulty with social greeting routines
- Going off-topic to discuss preferred interests during what should be reciprocal conversation
- Solitary engagement pattern when reciprocal opportunities exist

# CRITERION ISOLATION — STRICT

The A1 section must contain ONLY A1-relevant evidence. The following content categories belong to OTHER criteria and MUST NOT appear in the A1 section even if mentioned in raw notes:

- Eye contact, facial expression, gestures, prosody → A2
- Friendship maintenance, peer relationship structure → A3
- Repetitive motor movements, lining up, echolalia → B1
- Rigidity, sameness, transition difficulty → B2
- Specific topic interests (Minecraft, dinosaurs, etc.) → B3 (you may reference that a preferred topic interferes with reciprocal exchange — an A1 phenomenon — without naming the specific topic)
- Sensory sensitivities → B4

A1 is about the QUALITY of reciprocal social exchange itself.

# STRUCTURE

Follow the three-paragraph defensibility architecture (clinical observation → parent/collateral report → functional impact) unless raw notes contain only sparse evidence or indicate the criterion is not met.

For ruled-out / not-met cases (raw notes indicate adequate reciprocity), produce a single concise paragraph describing what WAS observed and stating that findings do not support clinically significant impairment in this domain.`;

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

Draft the Criterion A1 (Social-Emotional Reciprocity) Indicators section.

# CLIENT CONTEXT

Client name: ${vars.clientName || "[client name not provided — if a name appears in raw notes, use it]"}
Pronouns: ${vars.pronouns || "[not specified]"}
Chronological age: ${vars.chronologicalAge || "[not specified]"}
Year level / educational setting: ${vars.yearLevel || "[not specified]"}

# RAW CLINICAL NOTES (PRIMARY SOURCE)

${vars.rawNotes || "[no raw notes provided]"}

# ENGINE-DETECTED A1 MARKERS (ADVISORY ONLY — IGNORE IF EMPTY)

${vars.a1Markers || "(no markers detected — generate from raw notes alone)"}

# WRITE THE A1 SECTION NOW

Output plain prose only. Start with the first paragraph. No preamble. No "Here is the A1 section..." opener.`;
}
