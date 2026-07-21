// ADHD recommendation expander.
// STRICT COMPILER: expands only the clinician's shorthand recs, adds nothing else.
// Age-tailored: the same shorthand expands differently per developmental band.
// Unrecognised shorthand is emitted as the clinician's own text (not invented).
// Exactly N non-empty shorthand items → exactly N output paragraphs.

export type AgeBand = "0-5" | "6-11" | "12+";

export function ageBand(ageYears: number): AgeBand {
  if (ageYears <= 5) return "0-5";
  if (ageYears <= 11) return "6-11";
  return "12+";
}

/**
 * Parse clinician shorthand into discrete items.
 * Splits on commas, semicolons, or newlines. Does not invent items.
 */
export function parseRecommendationShorthand(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Each shorthand key maps to a per-band expansion.
// Keep each expansion to ONE recommendation intent. No bolted-on batteries, timelines, or extra referrals.
const EXPANSIONS: Record<string, Record<AgeBand, string>> = {
  "psych executive functioning": {
    "0-5":
      "Referral to a psychologist for support targeting emotional regulation, routine and transition management, and early self-regulation through play-based intervention and parent coaching.",
    "6-11":
      "Referral to a psychologist for support with organisation, task initiation and completion, emotional regulation, and age-appropriate self-management strategies, with parent and school collaboration.",
    "12+":
      "Referral to a psychologist for support with executive functioning including organisation, planning, time and workload management, and self-monitoring to support independence in secondary schooling.",
  },
  "psych anxiety": {
    "0-5":
      "Referral to a psychologist experienced in early childhood for support with anxiety, focusing on co-regulation, predictable routines, and graded exposure at a developmentally appropriate level.",
    "6-11":
      "Referral to a psychologist for evidence-based intervention for anxiety, including graded exposure and cognitive strategies adapted to the child's developmental level, with parent and school involvement.",
    "12+":
      "Referral to a psychologist for evidence-based intervention for anxiety, including cognitive-behavioural strategies appropriate to adolescence.",
  },
  "psych emotional regulation": {
    "0-5":
      "Referral to a psychologist for support with emotional regulation through co-regulation, routine, and play-based strategies, with parent coaching.",
    "6-11":
      "Referral to a psychologist for support with emotional regulation and frustration tolerance, with strategies carried across home and school.",
    "12+":
      "Referral to a psychologist for support with emotional regulation and distress tolerance, adapted to an adolescent context.",
  },
  "ot gross motor": {
    "0-5":
      "Occupational therapy assessment and play-based intervention targeting gross motor development and coordination.",
    "6-11":
      "Occupational therapy assessment and intervention targeting gross motor coordination and its impact on participation.",
    "12+":
      "Occupational therapy assessment targeting gross motor coordination where it affects daily functioning.",
  },
  "ot sensory": {
    "0-5":
      "Occupational therapy assessment and intervention targeting sensory processing, with strategies for home and early-education settings and parent coaching.",
    "6-11":
      "Occupational therapy assessment and intervention targeting sensory processing across home and school settings.",
    "12+":
      "Occupational therapy assessment targeting sensory processing where it affects daily participation.",
  },
  "ot handwriting": {
    "0-5":
      "Occupational therapy assessment of fine motor and pre-writing skills with play-based intervention.",
    "6-11":
      "Occupational therapy assessment and intervention targeting handwriting and fine motor skills for classroom participation.",
    "12+":
      "Occupational therapy assessment targeting fine motor and written-output demands where these affect schooling.",
  },
  "speech pragmatics": {
    "0-5":
      "Speech pathology input targeting early social communication, including turn-taking and functional language.",
    "6-11":
      "Speech pathology input targeting pragmatic and social communication, including conversational skills.",
    "12+":
      "Speech pathology input targeting pragmatic and social communication relevant to adolescent contexts.",
  },
  "speech expressive": {
    "0-5":
      "Speech pathology assessment and intervention targeting expressive language development.",
    "6-11":
      "Speech pathology assessment and intervention targeting expressive language and its impact on learning.",
    "12+":
      "Speech pathology assessment targeting expressive language where it affects communication and schooling.",
  },
  "speech pathology": {
    "0-5":
      "Speech pathology assessment and intervention as clinically indicated for the child's speech and language profile.",
    "6-11":
      "Speech pathology assessment and intervention as clinically indicated for the child's speech and language profile.",
    "12+":
      "Speech pathology assessment and intervention as clinically indicated for the adolescent's speech and language profile.",
  },
  "school support": {
    "0-5":
      "Educator support within the current setting, including structured routines, transition warnings, and individualised scaffolding during group activities.",
    "6-11":
      "School-based support including classroom accommodations, structured routines, and movement and attention supports, in collaboration with educators.",
    "12+":
      "Secondary-school support including classroom and assessment accommodations and executive-function scaffolding, in collaboration with educators.",
  },
  "cognitive educational assessment": {
    "0-5":
      "Cognitive and developmental assessment to clarify the learning profile.",
    "6-11":
      "Formal cognitive and academic-achievement assessment to establish or exclude a Specific Learning Disorder contributing to the presentation.",
    "12+":
      "Formal cognitive and academic-achievement assessment to establish or exclude a Specific Learning Disorder and to inform educational planning.",
  },
};

export type RecInput = {
  shorthand: string[]; // e.g. ["psych executive functioning", "school support"]
  ageYears: number;
  /** Retained for callers; no longer auto-injects risk or ratification text. */
  riskPresent?: boolean;
  medicationWanted?: boolean;
};

/**
 * Expand only the clinician's shorthand items, in order.
 * Exactly N input items → exactly N output paragraphs. Nothing added.
 * Does not invent WIAT timelines, extra referrals, or monitoring intervals.
 */
export function expandRecommendations(input: RecInput): string[] {
  const band = ageBand(input.ageYears);
  const out: string[] = [];

  for (const key of input.shorthand) {
    const trimmed = key.trim();
    if (!trimmed) continue;
    const norm = trimmed.toLowerCase();
    const exp = EXPANSIONS[norm];
    // Known shorthand → age-banded prose for that single intent.
    // Unknown → clinician's own wording, unchanged (still one item).
    out.push(exp ? exp[band] : trimmed);
  }

  return out;
}

export function formatExpandedRecommendations(items: string[]): string {
  return items.map((text, i) => `${i + 1}. ${text}`).join("\n\n");
}
