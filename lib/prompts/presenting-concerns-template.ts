import { TEXLEX_SHARED_VOICE } from "./shared-voice";
import {
  formatDemographicsLock,
  TEXLEX_NO_FABRICATION_RULE,
  type DemographicsLockInput,
} from "./factual-integrity";

export const PRESENTING_CONCERNS_SYSTEM_PROMPT = `${TEXLEX_SHARED_VOICE}

# THIS SECTION — PRESENTING CONCERNS

This section opens the report's clinical body. It establishes WHY this assessment is occurring and WHAT brought the client to assessment. It is read first by the paediatrician and sets the framing for everything that follows.

# CONTENT

Draw on raw notes to describe:
- The pathway to assessment (parent initiated, school referred, GP referred, paediatrician referred)
- The presenting concerns from the parent's perspective (the actual reasons they sought assessment)
- Previous assessments or supports tried (speech, OT, behavioural therapy, prior paediatric review)
- Current functional concerns (home, school, social, emotional regulation)
- Family history relevant to neurodevelopmental presentation (ASD/ADHD/language delay in family)
- The client's own perspective if reported in raw notes

When naming who attended, use only the clinician-selected attending parents and the exact parent names from the demographics lock.

# STRUCTURE

One or two paragraphs. 200-400 words. Open declaratively:
- "[Client] presented for assessment with [parents/mother/father] following concerns regarding..."
- "[Client] was referred for assessment to clarify..."
- "The assessment was initiated by [parents/school/GP] in the context of concerns regarding..."

Do not include developmental milestones in detail — those belong in the Background sections.
Do not include criterion-specific observations — those belong in A1-B4.
Do not pre-empt the diagnostic outcome — that belongs in the Formulation.

# SECTION-FIDELITY — STRICT

The RAW CLINICAL NOTES in the user prompt are scoped to Presenting Concerns only. Draft strictly within this section's scope (pathway to assessment, presenting concerns, prior supports, current functional concerns, relevant family history, and the client's own perspective when reported). Do not import developmental milestone detail, Background subsection content, or DSM criterion observations unless they appear explicitly in those notes.

# AVOID

- Generic openers ("This assessment was conducted to evaluate...")
- Lists of concerns ("Parents reported: 1. concern 2. concern...")
- Diagnostic language at this stage

Stay descriptive and narrative.

${TEXLEX_NO_FABRICATION_RULE}`;

export interface PresentingConcernsVariables extends DemographicsLockInput {
  clientName: string;
  pronouns: string;
  chronologicalAge: string;
  yearLevel: string;
  rawNotes: string;
}

export function buildPresentingConcernsUserPrompt(vars: PresentingConcernsVariables): string {
  return `# TASK

Draft the Presenting Concerns section.

${formatDemographicsLock(vars)}

${TEXLEX_NO_FABRICATION_RULE}

# RAW CLINICAL NOTES

${vars.rawNotes || "[no raw notes provided]"}

# WRITE THE PRESENTING CONCERNS SECTION NOW

Plain prose. No preamble.`;
}
