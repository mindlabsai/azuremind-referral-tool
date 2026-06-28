export type AdhdCriterion = {
  domain: string;
  code: string;
  criterion: string;
  criterionGroup: string;
};

export const ADHD_CRITERIA: AdhdCriterion[] = [
  // INATTENTION (IA)
  {
    code: "IA1",
    domain: "IA1 Careless mistakes / attention to detail",
    criterion: "Often fails to give close attention to details or makes careless mistakes",
    criterionGroup: "IA",
  },
  {
    code: "IA2",
    domain: "IA2 Sustaining attention",
    criterion: "Often has difficulty sustaining attention in tasks or play",
    criterionGroup: "IA",
  },
  {
    code: "IA3",
    domain: "IA3 Listening when spoken to",
    criterion: "Often does not seem to listen when spoken to directly",
    criterionGroup: "IA",
  },
  {
    code: "IA4",
    domain: "IA4 Following through / finishing",
    criterion: "Often does not follow through on instructions and fails to finish tasks",
    criterionGroup: "IA",
  },
  {
    code: "IA5",
    domain: "IA5 Organising tasks",
    criterion: "Often has difficulty organising tasks and activities",
    criterionGroup: "IA",
  },
  {
    code: "IA6",
    domain: "IA6 Sustained mental effort",
    criterion: "Often avoids or is reluctant to engage in tasks requiring sustained mental effort",
    criterionGroup: "IA",
  },
  {
    code: "IA7",
    domain: "IA7 Losing things",
    criterion: "Often loses things necessary for tasks or activities",
    criterionGroup: "IA",
  },
  {
    code: "IA8",
    domain: "IA8 Distractibility",
    criterion: "Often easily distracted by extraneous stimuli",
    criterionGroup: "IA",
  },
  {
    code: "IA9",
    domain: "IA9 Forgetfulness",
    criterion: "Often forgetful in daily activities",
    criterionGroup: "IA",
  },
  // HYPERACTIVITY-IMPULSIVITY (HI)
  {
    code: "HI1",
    domain: "HI1 Fidgeting / squirming",
    criterion: "Often fidgets with or taps hands or feet, or squirms in seat",
    criterionGroup: "HI",
  },
  {
    code: "HI2",
    domain: "HI2 Leaving seat",
    criterion: "Often leaves seat in situations when remaining seated is expected",
    criterionGroup: "HI",
  },
  {
    code: "HI3",
    domain: "HI3 Running / climbing / restlessness",
    criterion:
      "Often runs about or climbs in inappropriate situations, or restlessness in adolescents",
    criterionGroup: "HI",
  },
  {
    code: "HI4",
    domain: "HI4 Playing quietly",
    criterion: "Often unable to play or engage in leisure activities quietly",
    criterionGroup: "HI",
  },
  {
    code: "HI5",
    domain: "HI5 On the go / driven by a motor",
    criterion: "Is often on the go, acting as if driven by a motor",
    criterionGroup: "HI",
  },
  {
    code: "HI6",
    domain: "HI6 Talking excessively",
    criterion: "Often talks excessively",
    criterionGroup: "HI",
  },
  {
    code: "HI7",
    domain: "HI7 Blurting out",
    criterion: "Often blurts out an answer before a question has been completed",
    criterionGroup: "HI",
  },
  {
    code: "HI8",
    domain: "HI8 Waiting turn",
    criterion: "Often has difficulty waiting their turn",
    criterionGroup: "HI",
  },
  {
    code: "HI9",
    domain: "HI9 Interrupting / intruding",
    criterion: "Often interrupts or intrudes on others",
    criterionGroup: "HI",
  },
  // WRAPPERS (C/D/E/F)
  {
    code: "C",
    domain: "Criterion C — Onset before age 12",
    criterion: "Several inattentive or hyperactive-impulsive symptoms present prior to age 12",
    criterionGroup: "C",
  },
  {
    code: "D",
    domain: "Criterion D — Cross-setting",
    criterion: "Several symptoms present in two or more settings",
    criterionGroup: "D",
  },
  {
    code: "E",
    domain: "Criterion E — Functional impairment",
    criterion: "Clear evidence that symptoms interfere with or reduce the quality of functioning",
    criterionGroup: "E",
  },
  {
    code: "F",
    domain: "Criterion F — Differential",
    criterion: "Symptoms not better explained by another mental disorder",
    criterionGroup: "F",
  },
];

export function deriveAdhdPresentation(
  statedIA: number,
  statedHI: number,
  ageYears: number
): { presentation: string | null; iaPositive: boolean; hiPositive: boolean; threshold: number } {
  const threshold = ageYears <= 16 ? 6 : 5;
  const iaPositive = statedIA >= threshold;
  const hiPositive = statedHI >= threshold;
  let presentation: string | null;
  if (iaPositive && hiPositive) presentation = "Combined presentation";
  else if (iaPositive) presentation = "Predominantly inattentive presentation";
  else if (hiPositive) presentation = "Predominantly hyperactive-impulsive presentation";
  else presentation = null;
  return { presentation, iaPositive, hiPositive, threshold };
}
