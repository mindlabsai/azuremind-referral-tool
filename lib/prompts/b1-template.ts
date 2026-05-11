import { TEXLEX_SHARED_VOICE } from "./shared-voice";

export const B1_SYSTEM_PROMPT = `${TEXLEX_SHARED_VOICE}

# THIS SECTION — CRITERION B1 (STEREOTYPED OR REPETITIVE MOTOR MOVEMENTS, USE OF OBJECTS, OR SPEECH)

B1 considers repetitive motor mannerisms, stereotyped object use, repetitive speech patterns including echolalia and idiosyncratic phrasing.

B1-relevant content includes:
- Hand flapping, finger flicking, body rocking, spinning
- Tip-toe walking, gaited walk
- Repetitive object use (lining up toys, dolls, animals, cards; spinning objects; categorising)
- Echolalia (immediate or delayed)
- Idiosyncratic phrasing or self-coined terms
- Repetitive speech patterns, scripts, or "parrot talk"
- Vocal stereotypy (humming, screaming, roaring, sound effects)
- Self-stimulatory motor behaviours

# CRITERION ISOLATION — STRICT

B1 must contain ONLY B1-relevant content. Do NOT include:
- Restricted topic interests (B3)
- Sameness or transition difficulty (B2)
- Sensory differences (B4)
- Any A criterion content

B1 is about REPETITIVE BEHAVIOURS themselves — the motor pattern, the vocal pattern, the object manipulation pattern. Not the topic of interest.

# STRUCTURE

Three-paragraph defensibility architecture where evidence supports it. Open with:
- "[Client] demonstrates a pattern of stereotyped motor and verbal behaviours, characterised by..."
- "Parent report indicates the presence of repetitive motor and verbal patterns including..."

For ruled-out cases (no stereotypies, no echolalia, no lining up), produce a single concise paragraph noting what was observed and that findings do not support a clinically significant pattern of repetitive behaviours in this domain.`;

export interface B1PromptVariables {
  clientName: string;
  pronouns: string;
  chronologicalAge: string;
  yearLevel: string;
  rawNotes: string;
  b1Markers: string;
}

export function buildB1UserPrompt(vars: B1PromptVariables): string {
  return `# TASK

Draft the Criterion B1 (Stereotyped or Repetitive Motor Movements, Use of Objects, or Speech) Indicators section.

# CLIENT CONTEXT

Client name: ${vars.clientName || "[not provided]"}
Pronouns: ${vars.pronouns || "[not specified]"}
Chronological age: ${vars.chronologicalAge || "[not specified]"}
Year level: ${vars.yearLevel || "[not specified]"}

# RAW CLINICAL NOTES

${vars.rawNotes || "[no raw notes provided]"}

# ENGINE-DETECTED B1 MARKERS (ADVISORY)

${vars.b1Markers || "(no markers detected)"}

# WRITE THE B1 SECTION NOW

Plain prose. No preamble.`;
}
