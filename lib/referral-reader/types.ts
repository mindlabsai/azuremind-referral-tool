export type ReferralAssessmentType = "ADHD" | "ASD" | "SLD";

/** Fields extracted from a referral letter / email / PDF for the referral engine. */
export type ReferralReaderExtract = {
  childFirst: string;
  childLast: string;
  /** ISO date YYYY-MM-DD when parseable */
  childDob: string;
  parentFirst: string;
  parentLast: string;
  parentEmail: string;
  parentMobile: string;
  assessmentType: ReferralAssessmentType | "";
  referrerName: string;
  referrerType: string;
  referrerEmail: string;
  /** Short clinician-facing notes pulled from the referral (not sent to parents). */
  internalNotes: string;
  confidence: "high" | "medium" | "low";
  warnings: string[];
};

export type ReferralReaderResult = {
  success: boolean;
  extract?: ReferralReaderExtract;
  sourceChars?: number;
  error?: string;
};

export function emptyReferralExtract(): ReferralReaderExtract {
  return {
    childFirst: "",
    childLast: "",
    childDob: "",
    parentFirst: "",
    parentLast: "",
    parentEmail: "",
    parentMobile: "",
    assessmentType: "",
    referrerName: "",
    referrerType: "",
    referrerEmail: "",
    internalNotes: "",
    confidence: "low",
    warnings: [],
  };
}
