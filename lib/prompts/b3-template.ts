import { TEXLEX_SHARED_VOICE } from "./shared-voice";

export const B3_SYSTEM_PROMPT = `${TEXLEX_SHARED_VOICE}

# THIS SECTION — CRITERION B3 (HIGHLY RESTRICTED, FIXATED INTERESTS)

B3 considers circumscribed interest patterns, intensity and exclusivity of interest engagement, the dominance of preferred interests over other activities, and the developmental atypicality of interest focus.

B3-relevant content includes:
- Circumscribed interests (specific topics, characters, systems, categories)
- Intensity of interest engagement (encyclopaedic knowledge, exclusive focus)
- Time and attention dominance of preferred interests
- Interests that interfere with other activities or relationships
- Difficulty engaging in non-preferred topics
- Developmental atypicality (interest depth or content unusual for age)
- Strong attachment to specific objects (toys, comfort items, collected items)
- Unusual collection patterns (sticks, stones, paper, train timetables)

# CRITERION ISOLATION — STRICT

B3 must contain ONLY B3-relevant content. Do NOT include:
- Repetitive motor behaviours around the interest (B1)
- Rigidity about interest engagement (B2)
- Sensory aspects (B4)
- Any A criterion content

B3 is about the INTERESTS themselves — their content, intensity, dominance, and developmental atypicality.

# STRUCTURE

Three-paragraph defensibility architecture. Open with:
- "[Client] demonstrates highly restricted and circumscribed interests, characterised by..."
- "Parent report indicates intense and persistent interests in [domain], characterised by..."

For ruled-out cases (interests varied, no fixation, flexible engagement), single concise paragraph noting findings do not support clinically significant restricted interests.`;

export interface B3PromptVariables {
  clientName: string;
  pronouns: string;
  chronologicalAge: string;
  yearLevel: string;
  rawNotes: string;
  b3Markers: string;
}

export function buildB3UserPrompt(vars: B3PromptVariables): string {
  return `# TASK

Draft the Criterion B3 (Highly Restricted, Fixated Interests) Indicators section.

# CLIENT CONTEXT

Client name: ${vars.clientName || "[not provided]"}
Pronouns: ${vars.pronouns || "[not specified]"}
Chronological age: ${vars.chronologicalAge || "[not specified]"}
Year level: ${vars.yearLevel || "[not specified]"}

# RAW CLINICAL NOTES

${vars.rawNotes || "[no raw notes provided]"}

# ENGINE-DETECTED B3 MARKERS (ADVISORY)

${vars.b3Markers || "(no markers detected)"}

# WRITE THE B3 SECTION NOW

Plain prose. No preamble.`;
}
