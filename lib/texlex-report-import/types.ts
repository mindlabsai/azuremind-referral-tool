import type { TexlexEngineId } from "@/lib/texlex-report-state";

export const ASD_CRITERION_CODES = [
  "A1",
  "A2",
  "A3",
  "B1",
  "B2",
  "B3",
  "B4",
  "C",
  "D",
  "E",
] as const;

export type AsdCriterionCode = (typeof ASD_CRITERION_CODES)[number];

export type ImportedPatientDetails = {
  clientName?: string;
  dob?: string;
  pronouns?: string;
  yearLevel?: string;
  school?: string;
  parent1?: string;
  parent2?: string;
  phone?: string;
  address?: string;
  referringPractitioner?: string;
  assessor?: string;
  reportDate?: string;
  assessmentDate?: string;
};

export type ImportedCriterion = {
  indicators: string;
  rating: 0 | 1 | 2 | 3 | null;
};

export type ImportedSections = {
  presentingConcerns?: string;
  pregnancyBirth?: string;
  earlyDevelopment?: string;
  educationalHistory?: string;
  emotionalBehaviouralSensory?: string;
  collateralSummary?: string;
  formulation?: string;
  recommendations?: string;
  limitationsText?: string;
  functionalImpactSummary?: string;
  criteria?: Partial<Record<AsdCriterionCode, ImportedCriterion>>;
};

export type ImportMethod = "heading" | "llm" | "hybrid";

export type ImportConfidence = "high" | "medium" | "low";

export type TexlexImportedReport = {
  engine: TexlexEngineId;
  method: ImportMethod;
  confidence: ImportConfidence;
  warnings: string[];
  patientDetails: ImportedPatientDetails;
  sections: ImportedSections;
  filledSectionLabels: string[];
  sourceCharCount: number;
};

export type ImportReportResult =
  | { success: true; import: TexlexImportedReport }
  | { success: false; error: string };
