import { TEXLEX_LIMITATIONS } from "@/app/asd-engine/report/constants/texlexBoilerplate";
import type { TexlexEngineId } from "@/lib/texlex-report-state";
import {
  collapseWs,
  extractRatingToken,
  normalizeImportedReportText,
  parseFlexibleDateToIso,
  stripKnownBoilerplate,
  stripPageMarkers,
} from "./normalize";
import { finalizeImportedReport, looksLikeMastheadJunk, scrubCriterionIndicators } from "./scrub-content";
import {
  ASD_CRITERION_CODES,
  type AsdCriterionCode,
  type ImportedCriterion,
  type ImportedDiagnosticConclusion,
  type ImportedPatientDetails,
  type ImportedSections,
  type TexlexImportedReport,
} from "./types";

type HeadingDef = {
  key: string;
  patterns: RegExp[];
};

const SHARED_HEADINGS: HeadingDef[] = [
  { key: "presentingConcerns", patterns: [/^presenting concerns\b/i] },
  { key: "pregnancyBirth", patterns: [/^pregnancy and birth\b/i] },
  { key: "earlyDevelopment", patterns: [/^early development\b/i] },
  { key: "educationalHistory", patterns: [/^educational history\b/i] },
  {
    key: "emotionalBehaviouralSensory",
    patterns: [
      /^emotional[, ]+behavioural and sensory\b/i,
      /^emotional[, ]+behavioral and sensory\b/i,
    ],
  },
  {
    key: "collateralSummary",
    patterns: [/^collateral rating scales and reports\b/i, /^collateral summary\b/i],
  },
  {
    key: "formulation",
    patterns: [/^clinical formulation and consensus opinion\b/i, /^clinical formulation\b/i],
  },
  { key: "recommendations", patterns: [/^recommendations\b/i] },
  { key: "limitationsText", patterns: [/^limitations\b/i] },
];

/** Require "A1." / "C." form — never bare "C" (matches letter-spaced "C L I E N T"). */
const ASD_ONLY_HEADINGS: HeadingDef[] = [
  { key: "functionalImpactSummary", patterns: [/^functional impact summary\b/i] },
  ...ASD_CRITERION_CODES.map((code) => ({
    key: `criterion:${code}`,
    patterns: [new RegExp(`^${code}\\.\\s*`, "i")],
  })),
];

const SKIP_HEADINGS: RegExp[] = [
  /^assessment context\b/i,
  /^consent and use of report\b/i,
  /^background\b/i,
  /^dsm[- ]?5/i,
  /^section b\b/i,
  /^section c\b/i,
  /^neurodevelopmental assessment report\b/i,
  /^consensus-based neurodevelopmental/i,
  /^attention-deficit/i,
  /^autism spectrum disorder assessment pathway\b/i,
  /^confidential\b/i,
  /^and additional diagnostic criteria\b/i,
  /^c\.\s+onset in early developmental period and additional/i,
];

const ASSESSMENT_CONTEXT_SNIPPET =
  "This assessment was conducted as part of a consensus-based neurodevelopmental assessment pathway";

function lineMatchesAny(line: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(line.trim()));
}

function findHeadingKey(line: string, defs: HeadingDef[]): string | null {
  const t = line.trim();
  if (!t || t.length > 200) return null;
  // Prefer longer/more specific defs first is handled by array order for shared;
  // for criteria, A1 before A2 etc. is fine. Check criteria before bare shared collisions.
  for (const def of defs) {
    if (def.patterns.some((p) => p.test(t))) return def.key;
  }
  return null;
}

function cleanSectionBody(raw: string): string {
  return stripPageMarkers(
    raw
      .replace(/^\s*Background\s*\n+/i, "")
      // Repair PDF soft hyphens split across lines / spaces
      .replace(/(\w)-\n(\w)/g, "$1$2")
      .replace(/(\w)-\s+(\w)/g, "$1$2")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

function inferDiagnosticConclusion(
  formulation: string | undefined,
  fullText: string
): ImportedDiagnosticConclusion | null {
  const hay = `${formulation ?? ""}\n${fullText}`.toLowerCase();
  if (
    /does not meet\s+dsm|does not meet.{0,40}criteria for autism|does not meet.{0,40}\basd\b/.test(
      hay
    )
  ) {
    return "does_not_meet";
  }
  if (
    /meets\s+dsm[-–]?5|meets.{0,40}criteria for autism spectrum disorder|autism spectrum disorder,\s*level\s*[123]|asd,\s*level\s*[123]/.test(
      hay
    )
  ) {
    return "meets";
  }
  if (/inconclusive|further evidence required/.test(hay)) return "inconclusive";
  return null;
}

function extractPatientDetails(text: string): ImportedPatientDetails {
  const details: ImportedPatientDetails = {};
  const labelValue = (labels: string[]): string | undefined => {
    for (const label of labels) {
      const re = new RegExp(`(?:^|\\n)\\s*${label}\\s*[:\\n]\\s*([^\\n]+)`, "i");
      const m = text.match(re);
      if (m?.[1]) {
        const v = m[1].trim();
        if (v && !/^not provided$/i.test(v) && !/^n\/?a$/i.test(v) && v !== "—") {
          return v.replace(/\s{2,}/g, " ").trim();
        }
      }
    }
    return undefined;
  };

  const clientName = labelValue(["CLIENT", "Client", "Client name", "Name"]);
  if (clientName) details.clientName = clientName.replace(/\s+·\s+.*$/, "").trim();

  const dobRaw = labelValue(["DATE OF BIRTH", "Date of birth", "DOB", "Dob"]);
  if (dobRaw) {
    const withoutAge = dobRaw.split("·")[0]?.trim() ?? dobRaw;
    details.dob = parseFlexibleDateToIso(withoutAge);
  }

  const pronouns = labelValue(["PRONOUNS", "Pronouns"]);
  if (pronouns) details.pronouns = pronouns;

  const yearLevel = labelValue(["YEAR LEVEL", "Year level"]);
  if (yearLevel) details.yearLevel = yearLevel;

  const school = labelValue(["SCHOOL", "School"]);
  if (school) details.school = school;

  const phone = labelValue(["PHONE", "Phone", "Telephone", "Mobile"]);
  if (phone) details.phone = phone;

  const address = labelValue(["ADDRESS", "Address"]);
  if (address) details.address = address;

  const referring = labelValue(["REFERRING PRACTITIONER", "Referring practitioner", "Referrer"]);
  if (referring) details.referringPractitioner = referring;

  const assessor = labelValue(["ASSESSOR", "Assessor", "Clinician"]);
  if (assessor) details.assessor = assessor;

  const reportDateRaw = labelValue(["DATE OF REPORT", "Report date", "Date of report"]);
  if (reportDateRaw) details.reportDate = parseFlexibleDateToIso(reportDateRaw.split("·")[0]!.trim());

  const assessmentDateRaw = labelValue([
    "DATE OF ASSESSMENT",
    "Assessment date",
    "Date of assessment",
    "Assessment dates",
  ]);
  if (assessmentDateRaw) {
    details.assessmentDate = parseFlexibleDateToIso(assessmentDateRaw.split("·")[0]!.trim());
  }

  const parentsBlock = text.match(
    /(?:^|\n)\s*(?:PARENTS|Parents|Parent\/Carer(?:s)?|Parent\/Guardians?)\s*[:\n]\s*([^\n]+)(?:\n\s*([^\n]+))?/i
  );
  if (parentsBlock) {
    const p1 = parentsBlock[1]?.trim();
    const p2 = parentsBlock[2]?.trim();
    if (p1 && !/^not provided$/i.test(p1) && !/^(PHONE|ADDRESS|DATE|SCHOOL|ASSESSOR)/i.test(p1)) {
      details.parent1 = p1;
    }
    if (
      p2 &&
      !/^not provided$/i.test(p2) &&
      !/^(PHONE|ADDRESS|DATE|SCHOOL|ASSESSOR|REGISTRATION|PRACTICE)/i.test(p2)
    ) {
      details.parent2 = p2;
    }
  }

  return details;
}

function sectionLabel(key: string): string {
  if (key.startsWith("criterion:")) return key.replace("criterion:", "Criterion ");
  const map: Record<string, string> = {
    presentingConcerns: "Presenting concerns",
    pregnancyBirth: "Pregnancy and birth",
    earlyDevelopment: "Early development",
    educationalHistory: "Educational history",
    emotionalBehaviouralSensory: "Emotional, behavioural and sensory",
    collateralSummary: "Collateral summary",
    formulation: "Clinical formulation",
    recommendations: "Recommendations",
    limitationsText: "Limitations",
    functionalImpactSummary: "Functional impact summary",
  };
  return map[key] ?? key;
}

export function splitTexlexReportByHeadings(
  rawText: string,
  engine: TexlexEngineId
): TexlexImportedReport {
  const text = normalizeImportedReportText(rawText);
  const warnings: string[] = [];
  const headingDefs = [
    ...(engine === "asd" ? ASD_ONLY_HEADINGS : []),
    ...SHARED_HEADINGS,
  ];

  const lines = text.split("\n");
  type Hit = { key: string; lineIndex: number; headingLine: string; rating: 0 | 1 | 2 | 3 | null };
  const hits: Hit[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();
    if (lineMatchesAny(trimmed, SKIP_HEADINGS)) continue;

    const key = findHeadingKey(trimmed, headingDefs);
    if (!key) continue;

    // Skip section-C umbrella heading; keep the real "C. Onset … RATING" line.
    if (
      key === "criterion:C" &&
      /and additional diagnostic criteria/i.test(trimmed) &&
      !/RATING/i.test(trimmed)
    ) {
      continue;
    }

    const { rating: headingRating } = extractRatingToken(trimmed);

    // Prefer the later occurrence when the same key appears twice (e.g. C umbrella then real C).
    const existingIdx = hits.findIndex((h) => h.key === key);
    if (existingIdx >= 0) {
      const existing = hits[existingIdx]!;
      const preferNew =
        (headingRating !== null && existing.rating === null) ||
        (/RATING/i.test(trimmed) && !/RATING/i.test(existing.headingLine));
      if (preferNew) {
        hits[existingIdx] = { key, lineIndex: i, headingLine: trimmed, rating: headingRating };
      }
      continue;
    }
    hits.push({ key, lineIndex: i, headingLine: trimmed, rating: headingRating });
  }

  hits.sort((a, b) => a.lineIndex - b.lineIndex);

  const buckets: Record<string, string> = {};
  const ratingsFromHeading: Record<string, 0 | 1 | 2 | 3 | null> = {};
  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i]!;
    const startLine = hit.lineIndex + 1;
    const endLine = i + 1 < hits.length ? hits[i + 1]!.lineIndex : lines.length;
    let body = cleanSectionBody(lines.slice(startLine, endLine).join("\n"));
    // If rating is on the next line alone (common for E), pull it
    let rating = hit.rating;
    if (rating === null) {
      const fromBody = extractRatingToken(body);
      if (fromBody.rating !== null && (fromBody.rest.length < body.length || /^RATING/i.test(body.trim()))) {
        rating = fromBody.rating;
        body = fromBody.rest;
      }
    }
    ratingsFromHeading[hit.key] = rating;
    if (body) buckets[hit.key] = body;
  }

  if (buckets.presentingConcerns) {
    buckets.presentingConcerns = stripKnownBoilerplate(buckets.presentingConcerns, [
      ASSESSMENT_CONTEXT_SNIPPET,
    ]);
  }

  const sections: ImportedSections = {};
  if (buckets.presentingConcerns) sections.presentingConcerns = buckets.presentingConcerns;
  if (buckets.pregnancyBirth) sections.pregnancyBirth = buckets.pregnancyBirth;
  if (buckets.earlyDevelopment) sections.earlyDevelopment = buckets.earlyDevelopment;
  if (buckets.educationalHistory) sections.educationalHistory = buckets.educationalHistory;
  if (buckets.emotionalBehaviouralSensory) {
    sections.emotionalBehaviouralSensory = buckets.emotionalBehaviouralSensory;
  }
  if (buckets.collateralSummary) sections.collateralSummary = buckets.collateralSummary;
  if (buckets.formulation) sections.formulation = buckets.formulation;
  if (buckets.recommendations) sections.recommendations = buckets.recommendations;
  if (buckets.limitationsText) {
    const lim = buckets.limitationsText.trim();
    if (collapseWs(lim) !== collapseWs(TEXLEX_LIMITATIONS)) {
      sections.limitationsText = lim;
    }
  }
  if (engine === "asd" && buckets.functionalImpactSummary) {
    sections.functionalImpactSummary = buckets.functionalImpactSummary;
  }

  if (engine === "asd") {
    const criteria: Partial<Record<AsdCriterionCode, ImportedCriterion>> = {};
    for (const code of ASD_CRITERION_CODES) {
      const key = `criterion:${code}`;
      const raw = buckets[key];
      if (!raw && ratingsFromHeading[key] == null) continue;
      let body = scrubCriterionIndicators(code, raw ?? "");
      const fromBody = extractRatingToken(body);
      const rating = ratingsFromHeading[key] ?? fromBody.rating;
      const indicators = (fromBody.rating !== null ? fromBody.rest : body).trim();
      if (looksLikeMastheadJunk(indicators)) {
        warnings.push(`Criterion ${code} looked like header junk and was skipped — review that section.`);
        // Still keep rating if we captured it from the heading line
        if (rating !== null) {
          criteria[code] = { indicators: "", rating };
        }
        continue;
      }
      if (indicators.trim() || rating !== null) {
        criteria[code] = { indicators: indicators.trim(), rating };
      }
    }
    if (Object.keys(criteria).length) sections.criteria = criteria;
  }

  const patientDetails = extractPatientDetails(text);
  if (!patientDetails.clientName) {
    warnings.push("Client name was not detected from the PDF header — fill it manually if needed.");
  }

  const cleanedSections = finalizeImportedReport({
    engine,
    method: "heading",
    confidence: "medium",
    warnings: [],
    patientDetails: {},
    sections,
    filledSectionLabels: [],
    sourceCharCount: text.length,
  }).sections;
  const diagnosticConclusion = inferDiagnosticConclusion(cleanedSections.formulation, text);

  const filledSectionLabels: string[] = [];
  for (const [k, v] of Object.entries(buckets)) {
    if (k.startsWith("criterion:") && cleanedSections.criteria) {
      const code = k.slice("criterion:".length) as AsdCriterionCode;
      if (!cleanedSections.criteria[code]) continue;
    }
    if (v.trim()) filledSectionLabels.push(sectionLabel(k));
  }
  if (cleanedSections.criteria) {
    for (const code of ASD_CRITERION_CODES) {
      if (cleanedSections.criteria[code] && !filledSectionLabels.includes(`Criterion ${code}`)) {
        filledSectionLabels.push(`Criterion ${code}`);
      }
    }
  }
  if (diagnosticConclusion) {
    filledSectionLabels.push(
      diagnosticConclusion === "meets"
        ? "Diagnostic conclusion: Meets"
        : diagnosticConclusion === "does_not_meet"
          ? "Diagnostic conclusion: Does not meet"
          : "Diagnostic conclusion: Inconclusive"
    );
  }

  const proseCount = [
    cleanedSections.presentingConcerns,
    cleanedSections.pregnancyBirth,
    cleanedSections.earlyDevelopment,
    cleanedSections.educationalHistory,
    cleanedSections.emotionalBehaviouralSensory,
    cleanedSections.collateralSummary,
    cleanedSections.formulation,
    cleanedSections.recommendations,
    cleanedSections.functionalImpactSummary,
  ].filter((s) => (s ?? "").trim().length > 40).length;

  const criterionCount = Object.keys(cleanedSections.criteria ?? {}).length;
  const ratedCount = Object.values(cleanedSections.criteria ?? {}).filter(
    (c) => c && c.rating !== null
  ).length;
  const expectedMin = engine === "asd" ? 4 : 3;
  const score =
    proseCount +
    (engine === "asd" ? Math.min(3, Math.floor(criterionCount / 2)) : 0) +
    (engine === "asd" && ratedCount >= 6 ? 1 : 0);

  let confidence: TexlexImportedReport["confidence"] = "low";
  if (score >= expectedMin + 2) confidence = "high";
  else if (score >= expectedMin) confidence = "medium";

  if (engine === "asd" && criterionCount < 8) {
    warnings.push("Not all ASD criteria were recovered cleanly — check A1–E after load.");
    if (confidence === "high") confidence = "medium";
  }
  if (engine === "asd" && ratedCount < 8) {
    warnings.push("Some clinician ratings were missing from the PDF — check A1–E rating dropdowns.");
  }

  if (hits.length === 0) {
    warnings.push("No Texlex section headings detected. AI mapping will be used.");
  } else if (confidence === "low") {
    warnings.push("Only a few sections were found by headings. AI will try to fill gaps.");
  }

  return {
    engine,
    method: "heading",
    confidence,
    warnings,
    patientDetails,
    sections: cleanedSections,
    diagnosticConclusion,
    filledSectionLabels,
    sourceCharCount: text.length,
  };
}
