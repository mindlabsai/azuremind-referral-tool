import { texlexFirstNameVoiceBlock } from "./texlex-first-name-voice";
import { TEXLEX_SHARED_VOICE } from "./shared-voice";

export const B2_SYSTEM_PROMPT = `${TEXLEX_SHARED_VOICE}

# THIS SECTION — CRITERION B2 (INSISTENCE ON SAMENESS, INFLEXIBLE ADHERENCE TO ROUTINES)

B2 considers difficulties with transitions, distress with change, ritualised patterns of behaviour, rigid thinking, and difficulty tolerating disruption to expected routines or sequences.

B2-relevant content includes:
- Distress with unexpected change or transition (school, home, environment)
- Insistence on routines (morning, evening, food, travel, dressing, bath time)
- Ritualised patterns of greeting, eating, sleeping, dressing
- Rigid thinking or black-and-white thinking
- Difficulty with task or setting transitions (recess to classroom, school to home)
- Need for advance notice of changes
- Resistance to novelty in food, clothing, environment, social situation
- Literal interpretation of plans (treating possibilities as fixed commitments)
- Need for specific seating, specific cups, specific routes

# CRITERION ISOLATION — STRICT

B2 must contain ONLY B2-relevant content. Do NOT include:
- Sensory triggers themselves (B4) — though sensory-driven rigidity around food texture etc. can be referenced as part of the rigidity pattern
- Restricted topic interests (B3)
- Motor stereotypies (B1)
- Any A criterion content

B2 is about the RIGIDITY and INSISTENCE ON SAMENESS pattern itself.

# STRUCTURE

Three-paragraph defensibility architecture. Open with:
- "[first name] demonstrates significant rigidity and difficulty adapting to change."
- "[first name] presents with marked inflexibility, characterised by..."

For ruled-out cases (transitions tolerated, no rigidity, flexibility evident), single concise paragraph noting what was observed and that findings do not support clinically significant rigidity.`;

export interface B2PromptVariables {
  clientName: string;
  pronouns: string;
  chronologicalAge: string;
  yearLevel: string;
  rawNotes: string;
  b2Markers: string;
}

export function buildB2UserPrompt(vars: B2PromptVariables): string {
  const clientFirstName = vars.clientName.trim().split(/\s+/)[0] || "";
  return `${texlexFirstNameVoiceBlock(clientFirstName)}

# TASK

Draft the Criterion B2 (Insistence on Sameness, Inflexible Adherence to Routines) Indicators section.

# CLIENT CONTEXT

Client name: ${vars.clientName || "[not provided]"}
Client first name: ${clientFirstName || "[not provided]"}
Pronouns: ${vars.pronouns || "[not specified]"}
Chronological age: ${vars.chronologicalAge || "[not specified]"}
Year level: ${vars.yearLevel || "[not specified]"}

# RAW CLINICAL NOTES

${vars.rawNotes || "[no raw notes provided]"}

# ENGINE-DETECTED B2 MARKERS (ADVISORY)

${vars.b2Markers || "(no markers detected)"}

# WRITE THE B2 SECTION NOW

Plain prose. No preamble.`;
}
