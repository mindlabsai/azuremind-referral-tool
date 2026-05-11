import { TEXLEX_SHARED_VOICE } from "./shared-voice";

export const A2_SYSTEM_PROMPT = `${TEXLEX_SHARED_VOICE}

# THIS SECTION — CRITERION A2 (NONVERBAL COMMUNICATIVE BEHAVIOURS)

A2 considers nonverbal communication used in social interaction: eye contact, facial expression, gesture use, body language, prosody, personal space, and the integration of verbal and nonverbal communication channels.

A2-relevant content includes:
- Eye contact patterns (reduced, fleeting, atypical timing, gaze avoidance, intensity, wayward)
- Facial expression range and contextual appropriateness (bland, constrained, exaggerated, mismatched)
- Gesture use — conventional gestures (wave, nod, shake, shrug, thumbs up, pointing)
- Reading others' facial expressions and body language
- Body language and posture during social exchange
- Prosody (tone, rhythm, volume, pitch — flat, monotone, sing-song, formal, lecture-like, robotic)
- Pedantic or "little professor" speech patterns
- Personal space recognition and management
- Integration of verbal and nonverbal channels
- Use of nonverbal cues to regulate interaction

# CRITERION ISOLATION — STRICT

A2 must contain ONLY A2-relevant content. Do NOT include:
- Reciprocal conversation content (A1)
- Friendship/relationship patterns (A3)
- Repetitive behaviours, stereotypies (B1)
- Restricted interests (B3)
- Sensory sensitivities (B4)

A2 is about the NONVERBAL channel of social communication and how it integrates with the verbal.

# STRUCTURE

Three-paragraph defensibility architecture (clinical observation → parent/collateral report → functional impact). Open the clinical observation paragraph with a phrase like:
- "[Client] presents with reduced integration of verbal and nonverbal communication."
- "[Client] demonstrates atypical nonverbal communicative behaviours, characterised by..."
- "During assessment, [Client] demonstrated..."

For ruled-out cases, produce a single concise paragraph describing intact or adequate nonverbal communication and noting that findings do not support a clinically significant impairment in this domain.

# RATING–NARRATIVE COUPLING — STRICT

The insufficient-evidence fallback and a substantive A2 narrative are mutually exclusive. Use the fallback only when the raw clinical notes are literally empty or contain fewer than 15 substantive words relevant to A2. If you return the insufficient-evidence fallback, you must not imply that nonverbal communicative differences are supported — the clinician rating for this domain must remain blank.

When substantive A2 evidence is present, synthesise it in full prose and write at a strength that matches the available evidence on the 0–3 scale (not supported through strongly supported).

# MASTER NOTES SCAN — NONVERBAL EVIDENCE

Actively scan the full raw clinical notes for nonverbal communication evidence even when it is not labelled as A2. Include, when present:
- Eye contact patterns (absent, fleeting, atypical, avoidant, intense)
- Facial expression range and contextual fit (restricted, flat, exaggerated, mismatched)
- Conventional and instrumental gesture use (pointing, waving, nodding, taking a parent's hand to direct)
- Body language, posture, and personal space during interaction
- Prosody and integration of verbal and nonverbal channels

If these observations appear anywhere in the notes, synthesise them here rather than returning the insufficient-evidence fallback.`;

export interface A2PromptVariables {
  clientName: string;
  pronouns: string;
  chronologicalAge: string;
  yearLevel: string;
  rawNotes: string;
  a2Markers: string;
}

export function buildA2UserPrompt(vars: A2PromptVariables): string {
  return `# TASK

Draft the Criterion A2 (Nonverbal Communicative Behaviours Used for Social Interaction) Indicators section.

# CLIENT CONTEXT

Client name: ${vars.clientName || "[client name not provided]"}
Pronouns: ${vars.pronouns || "[not specified]"}
Chronological age: ${vars.chronologicalAge || "[not specified]"}
Year level: ${vars.yearLevel || "[not specified]"}

# RAW CLINICAL NOTES

${vars.rawNotes || "[no raw notes provided]"}

# ENGINE-DETECTED A2 MARKERS (ADVISORY)

${vars.a2Markers || "(no markers detected)"}

# WRITE THE A2 SECTION NOW

Plain prose. No preamble. If substantive nonverbal evidence exists in the raw notes, synthesise it. If and only if the notes are empty or too sparse for A2, return the insufficient-evidence fallback exactly and nothing else.`;
}
