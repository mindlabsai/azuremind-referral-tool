export type MarkerPackId = "ASD" | "ADHD" | "SLD";

/** Questions only. They do not set severity and they do not generate report text. */
export const MARKER_QUESTIONS: Record<MarkerPackId, readonly string[]> = {
  ASD: [
    "Are criteria A1–A3 and B1–B4 consistent with the history already in the draft?",
    "Is the developmental course supported by the notes supplied with this pass?",
    "Is behaviour attributed to the person who actually recorded it?",
    "Is functional impact present where the locked conclusion depends on it?",
    "Are differentials and Criterion E consistent with the locked conclusion?",
    "Where support levels are written, do they match the locked levels?",
    "Is a modality limit material in this draft, rather than a missing phrase?",
  ],
  ADHD: [
    "Are symptoms and presentation consistent across the draft?",
    "Is developmental onset supported by the history supplied with this pass?",
    "Is there evidence for the settings this draft relies on?",
    "Is functional impact present where the locked conclusion depends on it?",
    "Are differentials consistent with the locked conclusion?",
    "Are rating scales or interviews used only when the draft says they were administered?",
    "Is the interpretation fitted to the age and context already recorded?",
  ],
  SLD: [
    "Which academic skill area does the draft claim?",
    "Is the educational history consistent with that claim?",
    "Do stated achievement scores match results supplied with this pass?",
    "If the draft names a test battery, do the scores match that source?",
    "Are instructional opportunity and exclusionary factors taken from the supplied notes?",
    "Is the educational impact supported by the draft?",
  ],
};

export type MarkerPackStatus = {
  id: MarkerPackId | null;
  active: boolean;
  questions: readonly string[];
  reason: string;
};

/**
 * SLD questions are specified here. They are not asked until an SLD report editor
 * and review route exist. Booking can already name SLD.
 */
export function markerPackForPathway(pathway: "asd" | "adhd" | "sld"): MarkerPackStatus {
  if (pathway === "asd") {
    return {
      id: "ASD",
      active: true,
      questions: MARKER_QUESTIONS.ASD,
      reason: "ASD report editor and finalize review are live.",
    };
  }
  if (pathway === "adhd") {
    return {
      id: "ADHD",
      active: true,
      questions: MARKER_QUESTIONS.ADHD,
      reason: "ADHD report editor and finalize review are live.",
    };
  }
  return {
    id: null,
    active: false,
    questions: MARKER_QUESTIONS.SLD,
    reason:
      "SLD has no report editor or review route. Booking can name SLD. The SLD marker questions stay unused.",
  };
}

export function activeMarkerQuestions(pathway: "asd" | "adhd" | "sld"): readonly string[] {
  const pack = markerPackForPathway(pathway);
  return pack.active ? pack.questions : [];
}
