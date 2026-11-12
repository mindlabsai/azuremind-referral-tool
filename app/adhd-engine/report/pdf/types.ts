export type AdhdPdfPatientDetails = {
  clientName: string;
  dob: string;
  yearLevel: string;
  school: string;
  reportDate: string;
  assessor: string;
  pronouns: string;
  parent1: string;
  parent2: string;
  phone: string;
  address: string;
  referringPractitioner: string;
};

export type AssessmentModality = "in-clinic" | "virtual" | "";

export type AdhdPdfDraft = {
  patientDetails: AdhdPdfPatientDetails;
  assessmentDate: string;
  assessmentModality: AssessmentModality;
  attendingParents: Array<"mother" | "father">;
  presentingConcerns: string;
  background: {
    pregnancyBirth: string;
    earlyDevelopment: string;
    educationalHistory: string;
    emotionalBehaviouralSensory: string;
  };
  collateralSummary: string;
  formulation: string;
  recommendations: string;
  limitationsText: string;
};
