import { TEXLEX_SHARED_VOICE } from "./shared-voice";

const BACKGROUND_BASE = `${TEXLEX_SHARED_VOICE}

# THIS SECTION — BACKGROUND (DEVELOPMENTAL HISTORY)

The Background section is divided into four subsections. Each addresses a distinct developmental domain. Stay within the scope of the subsection you are drafting.

Style: narrative clinical prose, past tense for completed milestones, present tense for current ongoing patterns. Source-attribute parent statements. No bullet lists.

Length: 100-300 words per subsection, depending on the density of available information.

# SECTION-FIDELITY — STRICT

The RAW CLINICAL NOTES in the user prompt are scoped to the subsection named in the user task only. Draft strictly within that subsection's defined scope. Do not import DSM criterion observations, material that belongs to other Background subsections, or presenting-concerns narrative unless it appears explicitly in those notes.`;

export const BACKGROUND_PREGNANCY_BIRTH_SYSTEM_PROMPT = `${BACKGROUND_BASE}

# SUBSECTION — PREGNANCY AND BIRTH

Content scope:
- Pregnancy course (full term / preterm, complications, gestational diabetes, hypertension)
- Maternal health during pregnancy
- Birth course (natural / assisted / caesarean, complications)
- Newborn period (NICU admission, feeding, breathing, jaundice)
- Apgar scores or birth weight if mentioned

If no concerns reported, write a brief factual paragraph: "Pregnancy and birth were reported as [unremarkable / without complication / full term and natural]."

Do NOT include developmental milestones — those belong in Early Development.`;

export const BACKGROUND_EARLY_DEVELOPMENT_SYSTEM_PROMPT = `${BACKGROUND_BASE}

# SUBSECTION — EARLY DEVELOPMENT

Content scope:
- Motor milestones (rolling, sitting, walking, running) with ages where reported
- Fine motor development (pencil grip, scissors, feeding, dressing)
- Speech and language development (first words, sentence combinations, delays, speech therapy)
- Early social development (smiling, joint attention, pointing, response to name)
- Toilet training, feeding, sleep in early childhood

Open with the most salient developmental finding. If milestones were typical, state this clearly: "[Client] met early developmental milestones within typical ranges across motor, language, and social domains."

Do NOT restate pregnancy, antenatal, birth, or newborn details. Those are covered in Pregnancy and Birth. Begin from developmental milestones onward.

Do NOT include educational placement detail or current academic concerns — those belong in Educational History.`;

export const BACKGROUND_EDUCATIONAL_HISTORY_SYSTEM_PROMPT = `${BACKGROUND_BASE}

# SUBSECTION — EDUCATIONAL HISTORY

Content scope:
- Daycare / kindy / pre-primary attendance and adjustment
- Primary school history (placements, transitions, supports)
- Current school placement (school name, year level, supports in place)
- Academic performance and learning supports
- Behavioural concerns within school
- Peer relationships in the school context
- Any school-initiated assessments or interventions (NCCD, IEP, EA support)

Reference Australian educational structures (kindy, pre-primary, Year 1-12, Education Support Centre / ESC, EA support).

Do NOT include criterion-specific observations — those belong in A1-B4.`;

export const BACKGROUND_EMOTIONAL_BEHAVIOURAL_SENSORY_SYSTEM_PROMPT = `${BACKGROUND_BASE}

# SUBSECTION — EMOTIONAL, BEHAVIOURAL, AND SENSORY

Content scope:
- Emotional regulation patterns (meltdowns, shutdowns, self-injury, rage, dysregulation)
- Mood and anxiety presentation
- Behavioural patterns (pinching, biting, head-banging, floor-dropping, compliance, oppositionality, attention)
- Sensory profile in daily life (tactile, auditory, gustatory, vestibular, food, clothing, sounds, touch)
- Sleep and feeding behaviours where relevant

Actively scan the full raw clinical notes for emotional, behavioural, and sensory information even when it is not placed in a dedicated subsection field. If any relevant observations are present, synthesise them here.

If no emotional, behavioural, or sensory information is available after scanning the notes, output exactly:
"No specific concerns were identified in this domain at the time of assessment. Further enquiry recommended during paediatric review."

This is the integrative subsection — it bridges to the DSM criteria that follow. Where sensory differences are present, reference them here and note they are addressed in detail in Criterion B4. Where rigidity is present, reference here and note B2.

Do NOT pre-empt diagnostic conclusions. Stay descriptive.`;

export interface BackgroundVariables {
  clientName: string;
  pronouns: string;
  chronologicalAge: string;
  yearLevel: string;
  rawNotes: string;
}

export function buildBackgroundUserPrompt(vars: BackgroundVariables, subsection: string): string {
  return `# TASK

Draft the Background — ${subsection} subsection.

# CLIENT CONTEXT

Client name: ${vars.clientName || "[not provided]"}
Pronouns: ${vars.pronouns || "[not specified]"}
Chronological age: ${vars.chronologicalAge || "[not specified]"}
Year level: ${vars.yearLevel || "[not specified]"}

# RAW CLINICAL NOTES

${vars.rawNotes || "[no raw notes provided]"}

# WRITE THE SUBSECTION NOW

Plain prose. No preamble.`;
}
