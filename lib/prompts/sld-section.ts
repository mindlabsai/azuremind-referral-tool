export const SLD_SECTION_IDS = [
  "Reason for assessment",
  "Developmental and educational history",
  "Assessment measures",
  "Reading",
  "Written expression",
  "Mathematics",
  "Formulation",
  "Recommendations",
] as const;

export type SldSectionId = (typeof SLD_SECTION_IDS)[number];

export type SldAreaMark = "indicated" | "not-indicated" | "unset";

export type SldCriterionMark = "met" | "not-met" | "unset";

export type SldDivaState = "positive" | "negative" | "not-administered";

export type SldSectionRequest = {
  section: SldSectionId;
  clientName: string;
  dob: string;
  rawNotes: string;
  adhdInScope: boolean;
  divaState: SldDivaState;
  criteriaStates: Record<string, SldCriterionMark>;
  inattentionMet: number;
  inattentionTotal: number;
  hyperactivityMet: number;
  hyperactivityTotal: number;
  threshold: number | null;
  presentation: string | null;
  areas: {
    reading: SldAreaMark;
    writtenExpression: SldAreaMark;
    mathematics: SldAreaMark;
  };
  severity: string;
  documents: Array<{ filename: string; role: "wiat" | "vanderbilt" }>;
};

export const SLD_SECTION_SYSTEM_PROMPT = `# SLD REPORT SECTION

You are writing one section of a Specific Learning Disorder assessment report, in the voice of the assessing psychologist. The reader may be a school, a parent, a paediatrician, or a regulator. Write plain clinical English. State findings and what they mean. Do not perform reasoning out loud.

Australian and UK English. No em dashes or en dashes. No quotation marks. Report a client's words in indirect speech.

The user message names the section. Write only that section. No heading, no preamble, no title.

FACTUAL RULES
- The clinician's skill-area marks, Young DIVA-5 outcome, and criterion marks are authoritative. Do not contradict, soften, or override them.
- Every score, percentile, standard score, age equivalent, and subscale result must appear in an attached document. If the document for that result is not attached, say the report was not available and quote no number.
- Do not rescore a test. Do not convert a score into a percentile that is not printed. Do not invent names, dates, schools, year levels, or history.
- A Vanderbilt form does not diagnose ADHD. A teacher form completed by a parent is a repeat parent rating and is described as such.
- Young DIVA-5 is the diagnostic interview when ADHD is part of this assessment. If ADHD is not part of this assessment, do not diagnose ADHD and do not say a Young DIVA-5 was completed.
- Affirm Specific Learning Disorder only in skill areas the clinician marked indicated. An unset area stays open. A not-indicated area is not assigned.
- Do not add recommendations, batteries, CTOPP, or paediatric review unless the notes already contain them.
- Do not describe the assessment as preliminary, pending, consensus-based, or awaiting ratification.
- Banned: "struggles", "struggling", "high functioning", "perhaps", "possibly", "might be", "this suggests", "appears to", "Overall", "Taken together", "Furthermore", "Importantly", "Notably".
`;

const SECTION_TASK: Record<SldSectionId, string> = {
  "Reason for assessment":
    "Why this assessment was sought, from the notes. 120 to 180 words. Do not state the diagnosis.",
  "Developmental and educational history":
    "Developmental course and educational history that the notes actually contain. Include instructional history only where the notes record it. 200 to 350 words. Omit what was not provided.",
  "Assessment measures":
    "Name only the measures that are attached or that the notes say were administered. For an attached WIAT file, name the WIAT. For each attached Vanderbilt file, name it by role (parent or teacher) once the document shows who completed it. Name the Young DIVA-5 only when ADHD is part of this assessment and the outcome is positive or negative. One short paragraph. Do not interpret scores here.",
  Reading:
    "Translate the reading results from the attached WIAT report into clinical prose: the reading subtests and the scores printed for them. Add only the reading history the notes contain. 150 to 280 words. If no WIAT file is attached, say the WIAT score report was not available and do not quote reading scores. Do not assign or remove a reading impairment; the clinician's mark stands.",
  "Written expression":
    "Translate the written-expression results from the attached WIAT report: spelling, sentence composition, essay composition, and the scores printed for them. Add only the writing history the notes contain. 150 to 280 words. If no WIAT file is attached, say the WIAT score report was not available and do not quote writing scores. Do not assign or remove a written-expression impairment.",
  Mathematics:
    "Translate the mathematics results from the attached WIAT report: the mathematics subtests and the scores printed for them. Add only the mathematics history the notes contain. 150 to 280 words. If no WIAT file is attached, say the WIAT score report was not available and do not quote mathematics scores. Do not assign or remove a mathematics impairment.",
  Formulation:
    "250 to 400 words. Sentence one is the CLINICAL LOCK supplied below. Reproduce it verbatim. Then give the WIAT findings that bear on the marked areas, once. If ADHD is part of this assessment, one later paragraph carries the Young DIVA-5 outcome and does not restate it. Vanderbilt results may be cited once, as rating-scale evidence, and do not override the interview. Close with what remains to be clarified. Do not restate the diagnosis.",
  Recommendations:
    "Practical recommendations already supported by the notes, for school and home. Do not add a battery, a referral, or a timeline the notes do not contain. Short numbered items in prose paragraphs, not a slogan list.",
};

function areaPhrase(mark: SldAreaMark, label: string): string | null {
  if (mark !== "indicated") return null;
  return label;
}

export function sldFormulationLock(body: SldSectionRequest): string {
  const name = body.clientName.trim() || "The client";
  const indicated = [
    areaPhrase(body.areas.reading, "reading"),
    areaPhrase(body.areas.writtenExpression, "written expression"),
    areaPhrase(body.areas.mathematics, "mathematics"),
  ].filter((item): item is string => Boolean(item));
  const unset = [
    body.areas.reading === "unset" ? "reading" : "",
    body.areas.writtenExpression === "unset" ? "written expression" : "",
    body.areas.mathematics === "unset" ? "mathematics" : "",
  ].filter(Boolean);
  const severity = body.severity.trim();

  if (indicated.length > 0) {
    const list =
      indicated.length === 1
        ? indicated[0]
        : `${indicated.slice(0, -1).join(", ")} and ${indicated[indicated.length - 1]}`;
    const severityClause = severity
      ? severity.toLowerCase().includes("severity")
        ? `, ${severity}`
        : `, ${severity} severity`
      : "";
    return `${name} meets DSM-5-TR criteria for Specific Learning Disorder with impairment in ${list}${severityClause}.`;
  }
  if (unset.length > 0) {
    return `Specific Learning Disorder is held open. The clinician has not marked ${unset.join(", ")}.`;
  }
  return `The available clinical evidence does not support a Specific Learning Disorder in the skill areas the clinician marked.`;
}

function markLabel(mark: SldAreaMark): string {
  if (mark === "indicated") return "indicated";
  if (mark === "not-indicated") return "not indicated";
  return "unset";
}

export function buildSldSectionPrompt(body: SldSectionRequest): string {
  const met = Object.entries(body.criteriaStates)
    .filter(([, state]) => state === "met")
    .map(([code]) => code)
    .sort()
    .join(", ");
  const docs =
    body.documents.length > 0
      ? body.documents.map((doc) => `- ${doc.role}: ${doc.filename}`).join("\n")
      : "- none attached";
  const adhd = body.adhdInScope
    ? [
        `ADHD is part of this assessment.`,
        `Young DIVA-5 outcome: ${body.divaState}.`,
        body.threshold == null
          ? "Date of birth was not entered, so no presentation is derived. Do not assign a presentation."
          : `Inattention ${body.inattentionMet} of ${body.inattentionTotal}. Hyperactivity/impulsivity ${body.hyperactivityMet} of ${body.hyperactivityTotal}. Threshold ${body.threshold}.`,
        body.presentation
          ? `Derived presentation: ${body.presentation}.`
          : "Derived presentation: none.",
        `Criteria marked met: ${met || "none"}.`,
        body.divaState === "positive" && body.presentation
          ? `If this section is the formulation, the ADHD paragraph may use this sentence once and must not repeat the presentation name: ${body.clientName.trim() || "The client"} meets DSM-5-TR criteria for Attention-Deficit/Hyperactivity Disorder, ${body.presentation}.`
          : "Do not write an ADHD diagnosis sentence unless the outcome is positive and a presentation was derived.",
      ].join("\n")
    : "ADHD is not part of this assessment. Do not diagnose ADHD. Do not describe a Young DIVA-5 or a Vanderbilt as establishing ADHD.";

  const lock =
    body.section === "Formulation"
      ? ["CLINICAL LOCK (verbatim sentence one):", sldFormulationLock(body), ""]
      : [];

  return [
    `Write the section: ${body.section}.`,
    SECTION_TASK[body.section],
    "",
    ...lock,
    "CLINICIAN LOCK",
    `Client: ${body.clientName.trim() || "[not provided]"}`,
    `Date of birth: ${body.dob.trim() || "[not provided]"}`,
    `Reading: ${markLabel(body.areas.reading)}.`,
    `Written expression: ${markLabel(body.areas.writtenExpression)}.`,
    `Mathematics: ${markLabel(body.areas.mathematics)}.`,
    `Severity stated: ${body.severity.trim() || "[not stated]"}`,
    adhd,
    "",
    "ATTACHED DOCUMENTS",
    docs,
    "",
    "RAW NOTES",
    body.rawNotes.trim() || "[none]",
  ].join("\n");
}
