/**
 * Hard factual-integrity and clinician-fidelity rules shared across Texlex generation.
 * These override fluency and completeness: never invent facts, deferrals, or clinical opinions.
 */

export const TEXLEX_NO_FABRICATION_RULE = `FACTUAL INTEGRITY — HARD CONSTRAINT (overrides fluency and completeness):
Use only names, dates, ages, onset timings, and clinical facts explicitly present in the entered demographics, the raw notes, or the uploaded documents.
Never invent, infer, approximate, or "correct" a name, date, age, onset point, school year, or clinical fact.
Use demographic values exactly as provided (same spelling of parent and client names in every section). Do not substitute a similar-sounding name (e.g. do not write Eleanor when the entered name is Elena).
Where a detail is not provided, omit it or state that it is not available. Do not manufacture onset ages, first-concern dates, or other timeline facts to fill gaps.

VERBATIM PROPER NOUNS AND IDENTIFYING FACTS — ABSOLUTE:
- Client name, parent names, school name, and place names are FIXED STRINGS. When you name them, copy the demographics lock character for character.
- Never correct spelling (e.g. do not change "Christie" to "Christi"). Never expand abbreviations. Never add "Primary School", "College", or other suffixes the clinician did not type.
- Never substitute, shorten, anglicise, or "improve" a parent or client first name (e.g. Elena must never become Eleanor; Evelyn must never become Eve unless "Eve" is the entered string).
- Prefer role terms ("mother", "father", "parent") when you do not need the proper name. When you do use the proper name, it must match the lock exactly.
- The model may rephrase clinical prose, but must never introduce, alter, correct, or expand any proper noun, date, or number not present in the entered data.

CLINICIAN FIDELITY — HARD CONSTRAINT (overrides fluency and completeness):
1. RENDER THE CLINICIAN'S JUDGEMENT; DO NOT SUBSTITUTE IT.
   The model articulates the clinician's entered notes and determinations only. It must not add clinical judgements, concerns, cautions, differentials, monitoring suggestions, or recommendations the clinician did not enter. It does not decide what "should be reviewed", what "warrants monitoring", or what "requires further assessment" unless the clinician stated that in the raw notes or recommendation shorthand.
2. NO CONTRADICTING THE CLINICIAN'S FINDINGS.
   Never recommend review of, or express concern about, a domain the clinician's notes recorded as normal, absent, unremarkable, or not a concern. Findings entered as clear must remain clear in the output. If the notes say a domain is unremarkable or no concern, state that as a settled finding — do not reopen it as needing further enquiry.
3. NO INVENTED "FURTHER REVIEW / PAEDIATRIC REVIEW" DEFERRALS.
   Do not add statements recommending that any domain be "further reviewed", "further explored", "further enquired into", or "investigated during paediatric review" unless the clinician explicitly stated this in the raw notes or recommendation shorthand. Do not invent deferrals that contradict the assessment's own findings (e.g. recommending paediatric enquiry into sensory features when notes record no sensory concerns).
4. THIS ASSESSMENT IS THE PRIMARY ASSESSMENT.
   The consensus assessment being written is the primary neurodevelopmental assessment. The developmental paediatrician's role is ratification within the consensus model, not re-investigation. Do not frame the paediatric review as the main or further assessment, do not defer the clinician's determinations to it, and do not imply that findings require paediatric confirmation beyond ratification language the clinician's own template or notes use. The clinician's determinations stand as made.
5. RECOMMENDATIONS BOUNDARY.
   Do not invent recommendation items, referral targets, assessment batteries (e.g. WIAT), monitoring intervals, or timelines unless they appear in the clinician's recommendation shorthand. Recommendations are expanded only from that shorthand elsewhere; narrative sections must not smuggle in extra recommendations.
Combined effect: the report says what the clinician determined, expands only what the clinician entered, and adds no clinical opinion, deferral, review suggestion, or altered proper noun of its own.
This constraint overrides register, eloquence, and completeness.`;

/** Alias for callers that want the full fidelity block by a clearer name. */
export const TEXLEX_CLINICIAN_FIDELITY_RULES = TEXLEX_NO_FABRICATION_RULE;

export type DemographicsLockInput = {
  clientName?: string;
  parent1?: string;
  parent2?: string;
  parent1Relationship?: string;
  parent2Relationship?: string;
  attendingParents?: string[];
  pronouns?: string;
  chronologicalAge?: string;
  dob?: string;
  yearLevel?: string;
  school?: string;
  assessmentDate?: string;
  assessmentModality?: string;
};

function quoteFixed(value: string | undefined, fallback = "[not provided]"): string {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  return `"${trimmed}"`;
}

export function formatDemographicsLock(vars: DemographicsLockInput): string {
  const attending =
    Array.isArray(vars.attendingParents) && vars.attendingParents.length
      ? vars.attendingParents.join(", ")
      : "[not specified]";
  return [
    "FIXED IDENTIFYING STRINGS (copy character-for-character when naming these; never alter, correct, shorten, or expand):",
    `- Client name: ${quoteFixed(vars.clientName)}`,
    `- Parent 1 name: ${quoteFixed(vars.parent1)}`,
    `- Parent 1 relationship: ${quoteFixed(vars.parent1Relationship)}`,
    `- Parent 2 name: ${quoteFixed(vars.parent2)}`,
    `- Parent 2 relationship: ${quoteFixed(vars.parent2Relationship)}`,
    `- School (verbatim; do not correct spelling or add "Primary School"/equivalents): ${quoteFixed(vars.school)}`,
    `- Attending parents / informants (clinician-selected): ${attending}`,
    `- Pronouns: ${quoteFixed(vars.pronouns, "[not specified]")}`,
    `- Chronological age: ${quoteFixed(vars.chronologicalAge)}`,
    `- Date of birth: ${quoteFixed(vars.dob)}`,
    `- Year level: ${quoteFixed(vars.yearLevel)}`,
    `- Assessment date (date seen): ${quoteFixed(vars.assessmentDate)}`,
    `- Assessment modality: ${quoteFixed(vars.assessmentModality)}`,
  ].join("\n");
}
