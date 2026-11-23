// ADHD formulation assembler.
// Compiles the outputs of the ADHD module components into a structured brief and a
// generation prompt. It NEVER concludes beyond what the clinician determined
// (DIVA-derived presentation, differential results, mental-health screen, channels)
// plus the clinician's stated framing. The integrated ASD+ADHD variant must SYNTHESISE
// the interaction between conditions in THIS child, not concatenate two formulations.

export type AdhdFormulationBrief = {
  childName: string;
  ageYears: number;
  chronologicalAgeLabel: string;
  yearLevel: string;
  school: string;
  parent1: string;
  parent2: string;
  parent1Relationship: string;
  parent2Relationship: string;
  attendingParents: string[];
  assessmentDate: string;
  assessmentModality: string;
  divaState: "positive" | "negative" | "not-administered";
  presentation: string | null;
  severityStated: string | null;
  criteriaStates: Record<string, "met" | "not-met" | "unset">;
  inattentionMet: number;
  inattentionTotal: number;
  hyperactivityMet: number;
  hyperactivityTotal: number;
  threshold: number;
  asdDifferentialBlock: string;
  asdActive: boolean;
  channelSummaries: string[];
  riskPresent: boolean;
  mentalHealthFraming: string | null;
  clinicianStatedFraming: string;
};

/** Governing style/reasoning system prompt for ADHD formulation generation. */
export const ADHD_FORMULATION_SYSTEM_PROMPT = `# ADHD CLINICAL FORMULATION

You are writing the clinical formulation section of an ADHD assessment report, in the voice of the assessing psychologist. The reader may be a paediatrician, a school, a parent, a tribunal or a regulator. Write in plain clinical English that none of them needs to translate. State findings and what they mean. Do not perform reasoning, do not explain why a finding is interesting, and do not write to impress.

Australian and UK English. No em dashes or en dashes; use full stops, commas or parentheses. No quotation marks anywhere in the section; report a client's words in indirect speech (he describes his body warming and telling himself he cannot do it).

STRUCTURE
Follow the outcome specific structure supplied in the user message. Within it: 250 to 400 words, no headings, no bullet points, no closing summary. When a CLINICAL LOCK opening sentence is supplied, reproduce it verbatim as sentence one.

The diagnosis and the presentation are each stated exactly once, in sentence one. After sentence one, do not write the presentation name again in any form (not "predominantly inattentive range", not "the inattentive presentation", not "this presentation"). Refer to it as "the attentional profile" or "the findings" if needed.

Every paragraph answers one of four questions: what the evidence establishes; what it does not establish; what co-occurring features are present and how each is read; what differentials were considered and how each was closed.

HOW PEOPLE AND INSTRUMENTS ARE NAMED
- The Young DIVA-5 sentence reads: "The Young DIVA-5, administered in clinic on [date], was positive, with [n] of nine inattention criteria and [n] of nine hyperactivity/impulsivity criteria met." It never names an informant.
- The client is named in sentence one and thereafter by first name or pronoun.
- Parents, carers and teachers are never referred to by first name. Use "his mother", "parent report", "the current classroom teacher". A rating scale is attributed by role: "the parent VADPRS", "the teacher VADTRS".
- The referring practitioner is named only by professional title and only where supplied.

RATING SCALE RULES
- Report each scale with its scores and percentiles where supplied, who completed it by role, and the setting it describes.
- If a scale file was supplied but contains no readable data, write one sentence in the collateral paragraph: "Rating scale data were not available for this formulation." Do not omit scales silently.
- "Convergence", "across informants", "across both forms", "cross situational" and "multi source" are used only when at least two scales were completed by different people. A teacher form completed by a parent is a repeat parent rating and is described as such.
- If a scale's clinical cut off is not met but any subscale percentile is at or above the 95th, report both facts in one sentence with the reason. Do not describe that scale as corroborating elsewhere.
- If a scale's subtype result differs from the Young DIVA-5 result, state the difference once and note that the structured interview is the diagnostic instrument.
- A child's own ratings of difficulty are reported as self report, never as evidence of functional impairment.

CAUSAL AND MECHANISM LANGUAGE
Any sentence that attributes one symptom cluster to another, says one feature accounts for, explains, predates, drives or underlies another, or offers a mechanism for the presentation, is clinical opinion. On positive and not administered outcomes it is written with exactly one of: "is most parsimoniously understood as", "is read as", "is consistent with". At most one such sentence per cluster. Never "is secondary to", "is driven by", "accounts for", "a recognised mechanism", "sequelae of" or any other causal construction without one of those three phrases in the same sentence. On a negative outcome the clinician's entered alternative conceptualisation is stated plainly, as the user message directs.

DIFFERENTIALS
Each differential the clinician entered is closed in one of three forms and no other:
- "warrants formal assessment";
- "a diagnostic pathway is not indicated at this time; [named features] are isolated features and [domain] should be monitored";
- "no features suggestive of [condition] were identified".
If any feature of a condition was recorded, the second form is used. Count the domains those features sit in accurately against the DSM-5-TR domains supplied; do not understate the count. Where differential text is supplied in the user message, reproduce it verbatim.

BANNED
"preliminary", "pending", "awaits", "ratification", "consensus", "confirmed", "established", "proven", "unambiguous", "inevitable", "compressed", "authoritative", "saturation", "signature", "signal", "threshold arithmetic", "integration rather than attribution", "suffers from", "struggles", "struggling", "high functioning", "mild ADHD", "perhaps", "possibly", "might be", "this suggests", "appears to", "it may be that", "It is important to note", "In conclusion", "Overall", "Taken together", "Furthermore", "Importantly", "Notably".

FACTUAL INTEGRITY CONSTRAINTS (override everything above if they ever conflict; never sacrifice accuracy for economy)
1. Compiler, not concluder. The clinician entered Young DIVA-5 outcome, criteria and derived presentation are authoritative and must not be contradicted, softened or overridden.
   - Positive: conclude that the client meets DSM-5-TR criteria for ADHD with the derived presentation. Do not add pathway status; the cover sheet carries it.
   - Negative: conclude that the available clinical evidence does not support a diagnosis of ADHD, and give the differential as a positive reformulation of mechanism on the basis of the alternative the clinician entered. Elevated rating scales under a negative interview are reported as the informant's perceived burden and do not reopen the question.
   - Not administered: ADHD is held open. State what evidence exists, what is missing, and that no conclusion is drawn.
2. Accurate use of documents: represent uploaded instrument findings (Vanderbilt etc.) as they actually are; do not mischaracterise which domains are endorsed; do not invent illegibility when content is readable.
3. NO FABRICATION: use only names, dates, ages, onset timings, and facts explicitly present in the demographics lock, raw notes, or uploaded documents. Never invent, infer, or approximate a name, date, age, onset point, or clinical fact. Use demographic names exactly as entered (do not substitute a similar name such as Eleanor for Elena). School name must be copied character-for-character from the lock; do not correct spelling or expand it. Where a detail is not provided, omit it or state it is not available. This overrides fluency and completeness.
4. Render the clinician's judgement only. Every fact in this section must come from the clinician's notes, the entered criteria, or the attached documents. Do not add observations, history, scores, ratings, concerns, cautions, differentials, mechanisms, monitoring suggestions or recommendations the clinician did not enter. Where the clinician recorded a reading of a co-occurring feature, reproduce that reading under the causal language rules; where they did not, report the feature without a reading.
5. NO CONTRADICTING CLEAR FINDINGS: never recommend review of, or express concern about, a domain the notes recorded as normal, absent, unremarkable, or not a concern. Settled negative/absent findings stay settled.
6. NO INVENTED DEFERRALS TO PAEDIATRIC REVIEW: do not add "further review / further enquiry / investigate during paediatric review" language unless the clinician explicitly wrote it in notes or recommendation shorthand. Do not invent deferrals that reopen domains the assessment found unremarkable.
7. Pathway status is not part of this section. Do not describe the assessment as consensus based, preliminary, or subject to ratification.
`;

/** Passed as styleGuidance. The critic route places this after the shared system prompt. */
export const ADHD_FORMULATION_CRITIC_STYLE_GUIDANCE =
  "Style lock for ADHD formulation (overrides any general framing instruction above): plain clinical English in the assessing psychologist's voice. Do not insert, restore or preserve 'consensus-based', 'preliminary', 'ratification', 'pending', 'awaits', 'unambiguous', 'compressed', 'inevitable' or 'authoritative'. Do not insert any mechanism or causal statement the draft does not contain; where the draft hedges a mechanism with 'is most parsimoniously understood as', 'is read as' or 'is consistent with', keep that hedge. Delete any second statement of the diagnosis or presentation after paragraph one. Do not lengthen. Stay at or under 400 words. Strip 'Taken together', 'Furthermore', 'Importantly', 'Notably', 'It is important to note', 'Overall'. Remove any quotation marks and any second occurrence of the presentation name after sentence one.";

function divaAuthoritativeLine(brief: AdhdFormulationBrief): string {
  if (brief.divaState === "positive") {
    return (
      `Young DIVA-5 outcome (clinician-stated, non-overridable): positive. ` +
      (brief.presentation
        ? `Derived presentation: ${brief.presentation}.`
        : "Presentation not derived.") +
      (brief.severityStated ? ` Clinician-stated severity: ${brief.severityStated}.` : "")
    );
  }
  if (brief.divaState === "negative") {
    return (
      "Young DIVA-5 outcome (clinician-stated, non-overridable): negative. " +
      "ADHD criteria are NOT MET on this assessment. This is a definite conclusion, not a deferred position. " +
      "Do not write that ADHD is held open. Do not hedge. Do not reopen the ADHD question. " +
      "Do not invent a positive Young DIVA-5 outcome."
    );
  }
  return (
    "Young DIVA-5 outcome (clinician-stated, non-overridable): not administered. " +
    "ADHD is HELD OPEN. Do not claim that a Young DIVA-5 was completed or that ADHD criteria were affirmed."
  );
}

function presentationAuthoritativeLine(brief: AdhdFormulationBrief): string {
  if (brief.divaState === "negative") {
    return "Presentation (authoritative): ADHD not met (no ADHD presentation assigned).";
  }
  if (brief.divaState === "not-administered") {
    return "Presentation (authoritative): Held open.";
  }
  return `Presentation (authoritative): ${brief.presentation ?? "Held open"}.`;
}

function assessmentDateForDivaSentence(raw: string): string {
  const trimmed = raw.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return trimmed || "[date not provided]";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Positive Young DIVA-5 sentence. Counts and date only; no informant name. */
function youngDivaSentenceLines(brief: AdhdFormulationBrief): string[] {
  if (brief.divaState !== "positive") return [];
  const date = assessmentDateForDivaSentence(brief.assessmentDate);
  const inClinic = !/virtual|video|tele/i.test(brief.assessmentModality);
  const setting = inClinic ? "in clinic " : "";
  return [
    "",
    "YOUNG DIVA-5 SENTENCE (use this sentence; do not add an informant, parent, carer, or teacher name):",
    `The Young DIVA-5, administered ${setting}on ${date}, was positive, with ${brief.inattentionMet} of nine inattention criteria and ${brief.hyperactivityMet} of nine hyperactivity/impulsivity criteria met.`,
  ];
}

function criteriaLockBlock(brief: AdhdFormulationBrief): string {
  const met = Object.entries(brief.criteriaStates)
    .filter(([, state]) => state === "met")
    .map(([code]) => code)
    .sort()
    .join(", ");

  return [
    `Inattention count (authoritative): ${brief.inattentionMet} of ${brief.inattentionTotal} met (threshold ${brief.threshold}).`,
    `Hyperactivity/impulsivity count (authoritative): ${brief.hyperactivityMet} of ${brief.hyperactivityTotal} met (threshold ${brief.threshold}).`,
    presentationAuthoritativeLine(brief),
    `Criteria marked met: ${met || "none"}.`,
  ].join("\n");
}

function demographicsLockBlock(brief: AdhdFormulationBrief): string {
  const attending = brief.attendingParents.length
    ? brief.attendingParents.join(", ")
    : "[not specified]";
  const q = (value: string) => (value.trim() ? `"${value.trim()}"` : "[not provided]");
  return [
    "FIXED IDENTIFYING STRINGS (when naming these people or places, copy character-for-character; never alter):",
    `- Client name: ${q(brief.childName)}`,
    `- Parent 1 name: ${q(brief.parent1)}`,
    `- Parent 1 relationship: ${q(brief.parent1Relationship)}`,
    `- Parent 2 name: ${q(brief.parent2)}`,
    `- Parent 2 relationship: ${q(brief.parent2Relationship)}`,
    `- School (verbatim; do not correct spelling; do not expand or add "Primary School"/equivalents): ${q(brief.school)}`,
    `- Chronological age (from DOB, authoritative): ${brief.chronologicalAgeLabel || (brief.ageYears > 0 ? `${brief.ageYears} years` : "[not provided]")}`,
    `- Year level (authoritative): ${q(brief.yearLevel)}`,
    `- Attending parents / informants (authoritative): ${attending}`,
    `- Assessment date / date seen (authoritative): ${q(brief.assessmentDate)}`,
    `- Assessment modality (authoritative): ${q(brief.assessmentModality)}`,
    "",
    "NAME AND SCHOOL RULES:",
    "- If Parent 1 is provided, that exact string is the only permitted proper name for that parent. Do not invent an alternate first name (e.g. never write Eleanor when Parent 1 is Elena Batres).",
    "- Prefer 'mother' / 'father' / 'parent' when a proper name is unnecessary. If you use a proper name, it must match the lock exactly.",
    "- The school string above is the only permitted school name. Do not 'fix' Christie/Christi or add Primary School unless those characters are in the lock.",
  ].join("\n");
}

/**
 * Structural rules derived from a Negative-DIVA clinician exemplar.
 * Encode the shape and register; do not hardcode case-specific content.
 */
function structureBlock(brief: AdhdFormulationBrief): string[] {
  if (brief.divaState === "negative") {
    return [
      "STRUCTURE FOR Young DIVA-5 NEGATIVE (target quality: definitive not-supported conclusion,",
      "scales handled as perceived burden not diagnosis, positive multifactorial differential,",
      "ASD addressed, integrative close). Match this structure and register. Do not hardcode any exemplar wording.",
      "",
      "1. OPEN WITH THE CONCLUSION (definitive).",
      "   State that the available clinical evidence does not support a diagnosis of ADHD.",
      "   Tie this to insufficient symptoms across inattentive and/or hyperactive-impulsive domains",
      "   against DSM-5 criteria, and to the absence of a pervasive, developmentally persistent pattern",
      "   expected of a primary attentional disorder. No hedging. No 'held open'. No deferred position.",
      "",
      "2. ADDRESS ELEVATED RATING SCALES DIRECTLY AND CORRECTLY (when present).",
      "   Acknowledge elevated ratings (e.g. Vanderbilt). Frame them as quantifying perceived symptom burden",
      "   rather than establishing diagnosis. State that when the endorsed concerns were examined through",
      "   structured clinical interview against DSM-5 criteria, they were not substantiated.",
      "   Note the distinction between behavioural concern and diagnostic threshold.",
      "   Represent scale findings accurately: do not mischaracterise which domains were endorsed,",
      "   and do not invent illegibility or missing scores when the documents are readable.",
      "   Do not use elevated scales to reopen the ADHD question.",
      "",
      "3. DIFFERENTIAL AS A POSITIVE REFORMULATION.",
      "   State what the presentation is more consistent with (e.g. multifactorial presentation;",
      "   emotional and behavioural regulation difficulties emerging under frustration, interpersonal",
      "   demands, or emotional arousal). Ground this in specific case evidence, including the child's",
      "   own account where available. This is not a list of ruled-out labels; it is what DOES explain",
      "   the presentation.",
      "",
      "4. LEARNING / ACADEMIC CONTRIBUTORS (where relevant).",
      "   Address learning-related factors supported by the evidence. State clearly what cannot be",
      "   determined without formal psychoeducational or other indicated assessment.",
      "",
      "5. ASD DIFFERENTIAL (explicit).",
      "   State what was observed (e.g. reciprocal social interaction, conversational reciprocity,",
      "   abstract reasoning, social insight, as supported by THIS case). Explain why threshold was",
      "   not reached. Conclude that current evidence does not support Autism Spectrum Disorder.",
      "   Use the ASD differential block as advisory evidence; do not invent observations.",
      "",
      "6. INTEGRATIVE CLOSE.",
      "   One paragraph conceptualising the presentation (e.g. emotional and behavioural regulation",
      "   difficulties with possible learning-related contributors, rather than ADHD or ASD) and naming",
      "   the clinical priority: clarify the mechanisms underpinning the presentation rather than",
      "   attribute difficulties to a neurodevelopmental disorder that is not supported.",
      "",
      "Shape: not supported (definite) → scales as burden not diagnosis → positive differential →",
      "learning (if relevant) → ASD excluded → integrative priority. Never write 'held open' for Negative.",
    ];
  }

  if (brief.divaState === "positive") {
    return [
      "STRUCTURE FOR Young DIVA-5 POSITIVE (same structural discipline as Negative; definitive position):",
      "",
      "1. OPEN WITH THE DIAGNOSTIC POSITION.",
      "   Sentence one is the CLINICAL LOCK opening. Reproduce it verbatim.",
      "   Include severity only if stated in the lock.",
      "",
      "2. SUPPORTING EVIDENCE INTEGRATED.",
      "   Weave interview findings, developmental persistence, and collateral (including rating scales)",
      "   as support inside the clinical reasoning. Scales quantify symptom burden that aligns with",
      "   the interview; do not recite clusters or items. Each finding once.",
      "",
      "3. DIFFERENTIALS ADDRESSED.",
      "   Address competing explanations (learning, emotional/behavioural regulation, ASD, other channels)",
      "   and how they were considered or resolved in THIS case. Where ASD is below threshold or excluded,",
      "   say so briefly with observed grounds. Where co-occurring factors remain relevant, name them",
      "   without undoing the ADHD affirmation.",
      "",
      "4. CLOSE WITH OUTSTANDING QUESTIONS. State what remains to be clarified or monitored. Do not restate the diagnosis, the presentation, or the pathway status.",
    ];
  }

  return [
    "STRUCTURE FOR Young DIVA-5 NOT ADMINISTERED (only genuinely open / deferred ADHD outcome):",
    "",
    "1. OPEN stating that ADHD is held open because Young DIVA-5 was not administered. This is the only",
    "   outcome for which 'held open' is appropriate.",
    "2. Set out what is driving the hold and what evidence is present without affirming ADHD.",
    "3. Address rating scales carefully: they quantify perceived burden and do not establish diagnosis",
    "   in the absence of structured interview.",
    "4. Address differentials and outstanding assessment needs once (including ASD if relevant).",
    "5. Close with what is required before a diagnostic position can be taken (typically structured",
    "   diagnostic interview / Young DIVA-5 and any indicated further assessment).",
  ];
}

export function buildFormulationPrompt(brief: AdhdFormulationBrief): string {
  const mode = brief.asdActive ? "INTEGRATED ASD + ADHD" : "ADHD";

  const mh = brief.riskPresent
    ? "RISK: disclosed self-directed risk is present. It must be surfaced prominently and addressed ahead of the diagnostic discussion."
    : brief.mentalHealthFraming
      ? `Mental health (clinician's framing, use verbatim in meaning): ${brief.mentalHealthFraming}`
      : "";

  const synthesisInstruction = brief.asdActive
    ? "This is an INTEGRATED formulation. Do NOT write two separate formulations and join them. " +
      "Write ONE clinical opinion that NAMES THE INTERACTION between the ASD and ADHD presentations " +
      "in this specific child: how the attentional profile and the autistic profile compound or shape " +
      "each other here, and how the combined picture changes the support needs versus either alone. " +
      (brief.divaState === "negative"
        ? "Because ADHD is not met, the integrated opinion must explain how ASD and/or other differentials account for the presentation without affirming ADHD. If ASD is also not supported, exclude both and give the multifactorial reformulation."
        : "")
    : "Write a single coherent ADHD clinical formulation that reads as a clinician's reasoned opinion.";

  const derivedPresentation = brief.presentation?.trim() ?? "";
  const positiveOpening =
    brief.divaState === "positive" && derivedPresentation
      ? [
          "CLINICAL LOCK — MANDATORY OPENING (verbatim first sentence).",
          "The first sentence of your output MUST be exactly the following, character-for-character. Do not paraphrase it. Do not restate the diagnosis or the presentation after this sentence.",
          "",
          `${(brief.childName || "The client").trim()} meets DSM-5-TR criteria for Attention-Deficit/Hyperactivity Disorder, ${derivedPresentation}.`,
          "",
        ]
      : [];

  return [
    `Write the clinical formulation for ${brief.childName || "the child"}. Mode: ${mode}.`,
    "",
    "GOVERNING STYLE AND REASONING INSTRUCTION (bind to this register):",
    ADHD_FORMULATION_SYSTEM_PROMPT,
    "",
    ...positiveOpening,
    ...structureBlock(brief),
    "",
    "ANTI-REPETITION (critical):",
    "- Do NOT walk through inattentive cluster, then hyperactive cluster, then conduct, then internalising, then performance as separate recitations.",
    "- Do NOT restate the same Vanderbilt (or other scale) findings in a later synthesis paragraph.",
    "- Do NOT produce a cluster-by-cluster transcription of any rating scale.",
    "- Each finding is said once, in service of the clinical opinion.",
    "- Target length: approximately 5 to 7 tight paragraphs for Negative; 4 to 6 for Positive. Prefer fewer if the picture is clear.",
    "",
    "CLINICIAN LOCK (AUTHORITATIVE AND NON-OVERRIDABLE).",
    "These are clinician-stated facts. You must not contradict, invent over, or override them.",
    "If attached documents or raw notes appear to conflict with this lock, you may note a discrepancy for clinical reconciliation,",
    "but the clinician lock remains the stated position of this report. There is no separate DSM criteria section in the report;",
    "the formulation itself carries the diagnostic position.",
    "",
    "DEMOGRAPHICS LOCK:",
    demographicsLockBlock(brief),
    "",
    "Young DIVA-5 AND CRITERIA LOCK (fold into the formulation as the clinical position, do not dump as a list):",
    `- ${divaAuthoritativeLine(brief)}`,
    criteriaLockBlock(brief),
    ...youngDivaSentenceLines(brief),
    "",
    "DOCUMENT USE CONSTRAINTS:",
    "- Uploaded documents may be quoted briefly as collateral support for the clinical reasoning.",
    "- Represent scale content accurately when legible. Do not claim photographs, partial illegibility,",
    "  or inability to extract scores unless that is genuinely true of the attached material.",
    "- Do not use documents to assert a diagnostic outcome, criterion count, or Young DIVA-5 result that differs from the clinician lock.",
    "- Do not claim an instrument was administered or reached an outcome unless the clinician lock or a clearly legible document supports that claim.",
    brief.divaState === "negative"
      ? "- For Negative: elevated questionnaire endorsement must be explained as perceived symptom burden not substantiated on structured interview, folded into the differential, never used to reopen ADHD."
      : "- If documents appear more endorsed than the entered criteria, note the discrepancy once; do not rewrite the entered criteria.",
    "",
    "NO INVENTED SPECIFICS:",
    "- Do not invent teacher names, parent names, dates, ages, year levels, schools, or instrument scores.",
    "- FIXED STRINGS: when naming the client, a parent, or the school, copy the quoted string from the demographics lock character-for-character.",
    "- Never write a different first name for a parent (Eleanor is forbidden if the lock says Elena Batres).",
    "- Never alter the school string (do not change Christie to Christi; do not add Primary School).",
    "- Use only the demographics lock above for age, year level, and school.",
    "- For anything not provided in the lock and not legibly present in an attached document or raw notes, state that it is not available. Do not guess.",
    "- Do not introduce recommendation items, batteries, or timelines that belong in the recommendations section.",
    "",
    "ADDITIONAL SOURCE MATERIAL (compile; do not use to override the lock):",
    `- ASD differential: ${brief.asdDifferentialBlock}`,
    ...(brief.channelSummaries.length
      ? [`- Other differentials: ${brief.channelSummaries.join(" ")}`]
      : []),
    ...(mh ? [`- ${mh}`] : []),
    `- Clinician's stated framing (authoritative): ${brief.clinicianStatedFraming || "[not provided]"}`,
    "",
    synthesisInstruction,
    "",
    "Produce the formulation prose only. No headings, no preamble, no separate criteria checklist,",
    "no title such as 'Clinical Formulation' (the UI supplies the section title).",
  ].join("\n");
}
