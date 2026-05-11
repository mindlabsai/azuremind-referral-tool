import { TEXLEX_SHARED_VOICE } from "./shared-voice";

export const B4_SYSTEM_PROMPT = `${TEXLEX_SHARED_VOICE}

# THIS SECTION — CRITERION B4 (HYPER- OR HYPO-REACTIVITY TO SENSORY INPUT)

B4 considers sensory processing differences across auditory, visual, tactile, olfactory, gustatory, vestibular, and proprioceptive domains, including both heightened and reduced reactivity, sensory seeking behaviours, and unusual sensory interests.

B4-relevant content includes:
- Auditory hypersensitivity (school bell, fire alarm, hand dryers, vacuum, blender, motorcycles, hairdryer)
- Auditory hyposensitivity (not responding to name, reduced startle)
- Tactile sensitivity (clothing tags, textures, denim, light touch, hair washing, shoe removal)
- Tactile seeking (weighted blankets, deep pressure, touching parent's arm)
- Visual seeking or sensitivity
- Olfactory or gustatory sensitivity (food texture, smell aversion, mushy/sticky food refusal)
- Food selectivity (specific brands, specific preparation, restricted variety)
- Proprioceptive seeking (deep pressure, crashing, jumping)
- Vestibular seeking or aversion (spinning, swinging, motion)
- Sensory seeking behaviours (mouthing non-food items, licking, sniffing objects)
- Pain/temperature processing differences

# CRITERION ISOLATION — STRICT

B4 must contain ONLY B4-relevant content. Do NOT include:
- Sensory-driven rigidity itself (B2) — food texture rigidity may overlap, but frame as sensory in B4 and rigidity in B2
- Repetitive motor behaviours (B1)
- Restricted interests (B3)
- Any A criterion content

B4 is about SENSORY PROCESSING — how the client experiences and responds to sensory input.

# STRUCTURE

Three-paragraph defensibility architecture. Open with:
- "[Client] demonstrates clear sensory sensitivities across multiple modalities."
- "[Client] presents with marked sensory differences, characterised by..."
- "Parent report indicates a pervasive pattern of sensory reactivity, characterised by..."

You may reference modalities explicitly (auditory, tactile, gustatory, vestibular, proprioceptive) within the prose, but always in continuous sentences — NEVER as bulleted lists.

For ruled-out cases, single concise paragraph noting findings do not support clinically significant sensory processing differences.`;

export interface B4PromptVariables {
  clientName: string;
  pronouns: string;
  chronologicalAge: string;
  yearLevel: string;
  rawNotes: string;
  b4Markers: string;
}

export function buildB4UserPrompt(vars: B4PromptVariables): string {
  return `# TASK

Draft the Criterion B4 (Hyper- or Hypo-reactivity to Sensory Input) Indicators section.

# CLIENT CONTEXT

Client name: ${vars.clientName || "[not provided]"}
Pronouns: ${vars.pronouns || "[not specified]"}
Chronological age: ${vars.chronologicalAge || "[not specified]"}
Year level: ${vars.yearLevel || "[not specified]"}

# RAW CLINICAL NOTES

${vars.rawNotes || "[no raw notes provided]"}

# ENGINE-DETECTED B4 MARKERS (ADVISORY)

${vars.b4Markers || "(no markers detected)"}

# WRITE THE B4 SECTION NOW

Plain prose. No preamble.`;
}
