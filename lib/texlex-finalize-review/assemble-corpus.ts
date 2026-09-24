import type { ReviewSectionId, ReviewSectionInput } from "./types";

export function formatSectionsBlock(sections: ReviewSectionInput[]): string {
  return sections
    .filter((s) => s.text.trim())
    .map((s) => `## [${s.sectionId}]\n${s.text.trim()}`)
    .join("\n\n");
}

export function buildAsdReviewSections(args: {
  presentingConcerns: string;
  background: {
    pregnancyBirth: string;
    earlyDevelopment: string;
    educationalHistory: string;
    emotionalBehaviouralSensory: string;
  };
  collateralSummary: string;
  criteria: Record<string, { indicators: string }>;
  functionalImpactSummary: string;
  clinicalFormulation: string;
  recommendations: string;
  limitationsText: string;
}): ReviewSectionInput[] {
  const criterion = (code: string): ReviewSectionInput => ({
    sectionId: `criterion-${code}` as ReviewSectionId,
    text: args.criteria[code]?.indicators ?? "",
  });

  return [
    { sectionId: "presenting-concerns", text: args.presentingConcerns },
    { sectionId: "background-pregnancy-birth", text: args.background.pregnancyBirth },
    { sectionId: "background-early-development", text: args.background.earlyDevelopment },
    { sectionId: "background-educational-history", text: args.background.educationalHistory },
    {
      sectionId: "background-emotional-behavioural-sensory",
      text: args.background.emotionalBehaviouralSensory,
    },
    { sectionId: "collateral", text: args.collateralSummary },
    criterion("A1"),
    criterion("A2"),
    criterion("A3"),
    criterion("B1"),
    criterion("B2"),
    criterion("B3"),
    criterion("B4"),
    criterion("C"),
    criterion("D"),
    criterion("E"),
    { sectionId: "functional-impact", text: args.functionalImpactSummary },
    { sectionId: "clinical-formulation", text: args.clinicalFormulation },
    { sectionId: "recommendations", text: args.recommendations },
    { sectionId: "limitations", text: args.limitationsText },
  ];
}

/** ADHD narrative sections only — no ASD DSM criterion blocks. */
export function buildAdhdReviewSections(args: {
  presentingConcerns: string;
  background: {
    pregnancyBirth: string;
    earlyDevelopment: string;
    educationalHistory: string;
    emotionalBehaviouralSensory: string;
  };
  collateralSummary: string;
  clinicalFormulation: string;
  recommendations: string;
  limitationsText: string;
}): ReviewSectionInput[] {
  return [
    { sectionId: "presenting-concerns", text: args.presentingConcerns },
    { sectionId: "background-pregnancy-birth", text: args.background.pregnancyBirth },
    { sectionId: "background-early-development", text: args.background.earlyDevelopment },
    { sectionId: "background-educational-history", text: args.background.educationalHistory },
    {
      sectionId: "background-emotional-behavioural-sensory",
      text: args.background.emotionalBehaviouralSensory,
    },
    { sectionId: "collateral", text: args.collateralSummary },
    { sectionId: "clinical-formulation", text: args.clinicalFormulation },
    { sectionId: "recommendations", text: args.recommendations },
    { sectionId: "limitations", text: args.limitationsText },
  ];
}
