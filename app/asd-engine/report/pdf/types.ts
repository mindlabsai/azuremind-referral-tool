import type {
  CriterionCode,
  CriterionState,
  PatientDetails,
  TexlexReportDraftV1,
} from "../page";

export type { CriterionCode, CriterionState, PatientDetails };

export type TexlexPdfDraft = Omit<TexlexReportDraftV1, "lastSaved" | "rawNotes" | "collateralDocs">;

export type BackgroundPdfState = TexlexPdfDraft["background"];
