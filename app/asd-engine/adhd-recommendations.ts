// ADHD recommendation expander.
// STRICT COMPILER: expands only the clinician's shorthand recs, adds nothing, EXCEPT
// the risk safety rec which is auto-added when risk is present.
// Age-tailored: the same shorthand expands differently per developmental band.
// Ordering: ratification (paed / child psychiatrist) is Rec 1, UNLESS risk is present,
// in which case GP/safety planning is Rec 1 and ratification moves to Rec 2.

export type AgeBand = "0-5" | "6-11" | "12+";

export function ageBand(ageYears: number): AgeBand {
  if (ageYears <= 5) return "0-5";
  if (ageYears <= 11) return "6-11";
  return "12+";
}

// Each shorthand key maps to a per-band expansion.
const EXPANSIONS: Record<string, Record<AgeBand, string>> = {
  "psych executive functioning": {
    "0-5":
      "Referral to a psychologist for support targeting emotional regulation, routine and transition management, and the development of early self-regulation through play-based intervention and parent coaching.",
    "6-11":
      "Referral to a psychologist for support with emerging organisation, task initiation and completion, emotional regulation, and the development of age-appropriate self-management strategies, with parent and school collaboration.",
    "12+":
      "Referral to a psychologist for support with executive functioning including organisation, planning, time and workload management, and self-monitoring, alongside strategies to support independence in secondary schooling.",
  },
  "psych anxiety": {
    "0-5":
      "Referral to a psychologist experienced in early childhood for support with anxiety, focusing on co-regulation, predictable routines, and graded exposure to feared situations at a developmentally appropriate level.",
    "6-11":
      "Referral to a psychologist for evidence-based intervention for anxiety, including graded exposure and cognitive strategies adapted to the child's developmental level, with parent and school involvement.",
    "12+":
      "Referral to a psychologist for evidence-based intervention for anxiety, including cognitive-behavioural strategies, and where relevant support around school engagement and re-integration.",
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
      "Occupational therapy assessment and intervention targeting handwriting, fine motor skills, and classroom participation.",
    "12+":
      "Occupational therapy assessment targeting fine motor and written-output demands where these affect schooling.",
  },
  "speech pragmatics": {
    "0-5":
      "Speech pathology input targeting early social communication, including turn-taking and functional language, carried across home and early-education settings.",
    "6-11":
      "Speech pathology input targeting pragmatic and social communication, including conversational skills, with goals carried across home and school.",
    "12+":
      "Speech pathology input targeting pragmatic and social communication relevant to adolescent social and academic contexts.",
  },
  "speech expressive": {
    "0-5":
      "Speech pathology assessment and intervention targeting expressive language development.",
    "6-11":
      "Speech pathology assessment and intervention targeting expressive language and its impact on learning.",
    "12+":
      "Speech pathology assessment targeting expressive language where it affects communication and schooling.",
  },
  "school support": {
    "0-5":
      "Early-childhood educator support within the current setting, including structured routines, transition warnings, and individualised scaffolding during group activities.",
    "6-11":
      "School-based support including classroom accommodations, structured routines, movement and attention supports, and a collaborative plan with educators.",
    "12+":
      "Secondary-school support including classroom and assessment accommodations, executive-function scaffolding, and a collaborative re-engagement and learning plan.",
  },
  "cognitive educational assessment": {
    "0-5":
      "Cognitive and developmental assessment to clarify the learning profile as the child enters formal schooling.",
    "6-11":
      "Formal cognitive and academic-achievement assessment (e.g. WISC-V with WIAT or equivalent) to establish or exclude a Specific Learning Disorder contributing to the presentation.",
    "12+":
      "Formal cognitive and academic-achievement assessment to establish or exclude a Specific Learning Disorder and to inform educational planning and accommodations.",
  },
};

// Ratification text. medicationWanted appends the medication clause.
function ratificationRec(ageBand: AgeBand, medicationWanted: boolean): string {
  const base =
    "Review by a developmental paediatrician or child psychiatrist to ratify the preliminary diagnostic formulation through the consensus pathway.";
  if (!medicationWanted) return base;
  const medByBand: Record<AgeBand, string> = {
    "0-5":
      " Any consideration of pharmacological treatment sits with the paediatrician or psychiatrist and is generally approached cautiously at this age.",
    "6-11":
      " Should pharmacological treatment be considered, this sits with the paediatrician or psychiatrist.",
    "12+":
      " Should pharmacological treatment be considered, this sits with the paediatrician or psychiatrist, with discussion appropriate to an adolescent.",
  };
  return base + medByBand[ageBand];
}

const riskRec =
  "Priority GP review for mood and disclosed risk, with safety planning. Consider psychiatric input. This should occur ahead of, and independent of, the diagnostic process.";

export type RecInput = {
  shorthand: string[];     // e.g. ["psych executive functioning", "school support"]
  ageYears: number;
  riskPresent: boolean;
  medicationWanted: boolean;
};

export function expandRecommendations(input: RecInput): string[] {
  const band = ageBand(input.ageYears);
  const out: string[] = [];

  // Ordering: risk first if present, then ratification; otherwise ratification first.
  if (input.riskPresent) {
    out.push(riskRec);
    out.push(ratificationRec(band, input.medicationWanted));
  } else {
    out.push(ratificationRec(band, input.medicationWanted));
  }

  // Then expand the clinician's shorthand recs, in the order given.
  for (const key of input.shorthand) {
    const norm = key.trim().toLowerCase();
    const exp = EXPANSIONS[norm];
    if (exp) out.push(exp[band]);
    else out.push(`[Unrecognised recommendation shorthand: "${key}" — expand manually]`);
  }

  return out;
}
