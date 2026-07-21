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
export const ADHD_FORMULATION_SYSTEM_PROMPT = `Write as an internationally recognised consultant developmental psychologist and neurodevelopmental diagnostician whose reports are regarded as exemplars of clinical reasoning. The objective is not to sound academic or impressive, but to produce formulations of exceptional diagnostic clarity.
Every sentence must contribute new clinical reasoning. Remove anything that merely explains, repeats, defends, teaches or justifies. The formulation should feel compressed, inevitable and authoritative.
Assume the reader is another experienced clinician. Do not explain DSM-5 criteria, psychometric principles or basic clinical concepts unless they directly influence the formulation.
Prioritise synthesis over description. The purpose is to answer one question: what is the most coherent explanation of this person's presentation given all available evidence?
Continuously integrate developmental history, behavioural observations, structured diagnostic interview, psychometric findings, collateral information, functional impact, and differential diagnosis. Do not discuss these sequentially. Synthesise them into one evolving clinical argument.
Avoid reporting findings. Instead, explain their significance. Differentiate clearly between observed facts, clinical inference, and diagnostic conclusion. State diagnostic opinions confidently where the evidence supports them, but never overstate certainty. Acknowledge uncertainty briefly and only when it materially alters the formulation.
Do not write to persuade the reader that ADHD or ASD is absent. Identify which diagnostic formulation best accounts for the presentation and allow alternative explanations to fall away naturally through the reasoning. Prefer positive formulation over exclusion: identify the developmental, emotional, cognitive or environmental mechanisms that most plausibly account for the presentation rather than focusing on what the child does not have. Avoid unnecessary diagnostic labels where mechanisms provide a more precise explanation.
Write in dense clinical language. Every paragraph should progressively narrow the differential diagnosis until the final formulation appears self-evident. Favour concise sentences with high informational content. Avoid rhetorical language, narrative transitions and filler.
Never write: 'It is important to note', 'It should be remembered', 'This suggests', 'Appears to', 'Reads as', 'It may be that', 'Did not survive scrutiny', 'The clinical question becomes'.
Instead use language such as: 'Current findings support', 'The presentation is most consistent with', 'This pattern reflects', 'The available evidence indicates', 'Behaviour is better understood as', 'The formulation favours', 'The predominant mechanism appears to be', 'This explanation accounts for'.
Every paragraph should answer one of four questions: what does the evidence establish; what does it exclude; what mechanism best explains the presentation; why is that mechanism superior to competing explanations.
The final paragraph should synthesise the entire assessment into a single coherent diagnostic formulation that explains the child's presentation more effectively than any competing diagnosis.
Precision, economy and synthesis take precedence over length, vocabulary and rhetorical sophistication. Australian English. No em dashes. No asterisks. DSM-5-TR aligned. AHPRA-defensible.

FACTUAL INTEGRITY CONSTRAINTS (override the style guidance above if they ever conflict; never sacrifice accuracy for economy):
1. Compiler-not-concluder: clinician-entered DIVA-5 outcome and criteria are authoritative and must not be contradicted or overridden. DIVA-5 Negative: conclude ADHD is not supported and give the differential as a positive reformulation of mechanism. DIVA-5 Positive: conclude ADHD is diagnosed with the derived presentation (preliminary within the consensus pathway, warranting ratification). DIVA-5 Not administered is the only genuinely open outcome.
2. Accurate use of documents: represent uploaded instrument findings (Vanderbilt etc.) as they actually are; do not mischaracterise which domains are endorsed; do not invent illegibility when content is readable.
3. NO FABRICATION: use only names, dates, ages, onset timings, and facts explicitly present in the demographics lock, raw notes, or uploaded documents. Never invent, infer, or approximate a name, date, age, onset point, or clinical fact. Use demographic names exactly as entered (do not substitute a similar name such as Eleanor for Elena). School name must be copied character-for-character from the lock; do not correct spelling or expand it. Where a detail is not provided, omit it or state it is not available. This overrides fluency and completeness.
4. RENDER THE CLINICIAN'S JUDGEMENT ONLY: do not add clinical judgements, concerns, cautions, differentials, monitoring suggestions, or recommendations the clinician did not enter. Do not decide what should be reviewed, warrants monitoring, or requires further assessment unless the clinician stated it.
5. NO CONTRADICTING CLEAR FINDINGS: never recommend review of, or express concern about, a domain the notes recorded as normal, absent, unremarkable, or not a concern. Settled negative/absent findings stay settled.
6. NO INVENTED DEFERRALS TO PAEDIATRIC REVIEW: do not add "further review / further enquiry / investigate during paediatric review" language unless the clinician explicitly wrote it in notes or recommendation shorthand. Do not invent deferrals that reopen domains the assessment found unremarkable.
7. THIS ASSESSMENT IS PRIMARY: the consensus assessment is the primary neurodevelopmental assessment. Paediatric involvement is ratification within the consensus model, not re-investigation. Do not frame paediatric review as the main assessment or defer the clinician's determinations to it beyond ratification language the clinician's own materials use.
8. Produce formulation prose only, without a section heading.`;

/** Critic must preserve the consultant register, not expand it into teaching prose. */
export const ADHD_FORMULATION_CRITIC_STYLE_GUIDANCE =
  "Preserve the senior consultant formulation register from the draft: compressed, inevitable, authoritative clinical synthesis. " +
  "Do not expand into explanatory, defensive, or teaching language. Do not add filler transitions. " +
  "Keep preferred phrasing ('Current findings support', 'The presentation is most consistent with', 'This pattern reflects', etc.) " +
  "and do not introduce banned phrases ('It is important to note', 'This suggests', 'Appears to', 'Reads as', etc.). " +
  "Factual integrity remains absolute: do not alter DIVA-5 outcome, criteria, demographics, or instrument findings. " +
  "Do not invent or alter names, dates, ages, or onset timings; preserve exact demographic spellings from the draft. " +
  "Parent and school names are fixed strings: never substitute Eleanor for Elena, never correct or expand the school name. " +
  "Do not add paediatric-review deferrals, monitoring suggestions, or concerns the clinician did not enter. " +
  "Do not reopen domains the draft recorded as unremarkable or not a concern.";

function divaAuthoritativeLine(brief: AdhdFormulationBrief): string {
  if (brief.divaState === "positive") {
    return (
      `DIVA-5 outcome (clinician-stated, non-overridable): positive. ` +
      (brief.presentation
        ? `Derived presentation: ${brief.presentation}.`
        : "Presentation not derived.") +
      (brief.severityStated ? ` Clinician-stated severity: ${brief.severityStated}.` : "")
    );
  }
  if (brief.divaState === "negative") {
    return (
      "DIVA-5 outcome (clinician-stated, non-overridable): negative. " +
      "ADHD criteria are NOT MET on this assessment. This is a definite conclusion, not a deferred position. " +
      "Do not write that ADHD is held open. Do not hedge. Do not reopen the ADHD question. " +
      "Do not invent a positive DIVA-5 outcome."
    );
  }
  return (
    "DIVA-5 outcome (clinician-stated, non-overridable): not administered. " +
    "ADHD is HELD OPEN. Do not claim that a DIVA-5 was completed or that ADHD criteria were affirmed."
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
      "STRUCTURE FOR DIVA-5 NEGATIVE (target quality: definitive not-supported conclusion,",
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
      "STRUCTURE FOR DIVA-5 POSITIVE (same structural discipline as Negative; definitive position):",
      "",
      "1. OPEN WITH THE DIAGNOSTIC POSITION (definitive for this pathway stage).",
      "   Affirm ADHD with the derived presentation from the clinician lock. State it once, plainly.",
      "   Frame as preliminary within the consensus pathway and warranting ratification; do not overclaim",
      "   medical confirmation. Include severity only if stated in the lock.",
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
      "4. CLOSE WITH PATHWAY IMPLICATIONS.",
      "   Restate the affirmed preliminary position once and the clinical priority (supports and",
      "   ratification pathway). Recommendations detail follows in a separate section; keep this close tight.",
    ];
  }

  return [
    "STRUCTURE FOR DIVA-5 NOT ADMINISTERED (only genuinely open / deferred ADHD outcome):",
    "",
    "1. OPEN stating that ADHD is held open because DIVA-5 was not administered. This is the only",
    "   outcome for which 'held open' is appropriate.",
    "2. Set out what is driving the hold and what evidence is present without affirming ADHD.",
    "3. Address rating scales carefully: they quantify perceived burden and do not establish diagnosis",
    "   in the absence of structured interview.",
    "4. Address differentials and outstanding assessment needs once (including ASD if relevant).",
    "5. Close with what is required before a diagnostic position can be taken (typically structured",
    "   diagnostic interview / DIVA-5 and any indicated further assessment).",
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

  return [
    `Write the clinical formulation for ${brief.childName || "the child"}. Mode: ${mode}.`,
    "",
    "GOVERNING STYLE AND REASONING INSTRUCTION (bind to this register):",
    ADHD_FORMULATION_SYSTEM_PROMPT,
    "",
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
    "DIVA-5 AND CRITERIA LOCK (fold into the formulation as the clinical position, do not dump as a list):",
    `- ${divaAuthoritativeLine(brief)}`,
    criteriaLockBlock(brief),
    "",
    "DOCUMENT USE CONSTRAINTS:",
    "- Uploaded documents may be quoted briefly as collateral support for the clinical reasoning.",
    "- Represent scale content accurately when legible. Do not claim photographs, partial illegibility,",
    "  or inability to extract scores unless that is genuinely true of the attached material.",
    "- Do not use documents to assert a diagnostic outcome, criterion count, or DIVA-5 result that differs from the clinician lock.",
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
