import { TEXLEX_CRITERIA, TEXLEX_LIMITATIONS } from "@/app/asd-engine/report/constants/texlexBoilerplate";
import type { TexlexEngineId } from "@/lib/texlex-report-state";
import {
  normalizeImportedReportText,
  parseFlexibleDateToIso,
  stripKnownBoilerplate,
} from "./normalize";
import {
  ASD_CRITERION_CODES,
  type AsdCriterionCode,
  type ImportedCriterion,
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
    patterns: [/^emotional[, ]+behavioural and sensory\b/i, /^emotional[, ]+behavioral and sensory\b/i],
  },
  {
    key: "collateralSummary",
    patterns: [/^collateral rating scales and reports\b/i, /^collateral summary\b/i],
  },
  {
    key: "formulation",
    patterns: [
      /^clinical formulation and consensus opinion\b/i,
      /^clinical formulation\b/i,
    ],
  },
  { key: "recommendations", patterns: [/^recommendations\b/i] },
  { key: "limitationsText", patterns: [/^limitations\b/i] },
];

const ASD_ONLY_HEADINGS: HeadingDef[] = [
  { key: "functionalImpactSummary", patterns: [/^functional impact summary\b/i] },
  ...ASD_CRITERION_CODES.map((code) => ({
    key: `criterion:${code}`,
    patterns: [new RegExp(`^${code}\\.\\s`, "i"), new RegExp(`^${code}\\b(?![A-Za-z0-9])`, "i")],
  })),
];

const SKIP_HEADINGS: RegExp[] = [
  /^assessment context\b/i,
  /^background\b/i,
  /^dsm[- ]?5/i,
  /^section b\b/i,
  /^section c\b/i,
  /^neurodevelopmental assessment report\b/i,
  /^attention-deficit/i,
  /^autism spectrum/i,
  /^confidential\b/i,
];

const ASSESSMENT_CONTEXT_SNIPPET =
  "This assessment was conducted as part of a consensus-based neurodevelopmental assessment pathway";

function lineMatchesAny(line: string, patterns: RegExp[]): boolean {
  const t = line.trim();
  return patterns.some((p) => p.test(t));
}

function findHeadingKey(line: string, defs: HeadingDef[]): string | null {
  const t = line.trim();
  if (!t || t.length > 160) return null;
  for (const def of defs) {
    if (def.patterns.some((p) => p.test(t))) return def.key;
  }
  return null;
}

function cleanSectionBody(raw: string): string {
  return raw
    .replace(/^\s*Background\s*\n+/i, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractRatingFromCriterionBody(body: string): {
  indicators: string;
  rating: 0 | 1 | 2 | 3 | null;
} {
  let indicators = body.trim();
  let rating: 0 | 1 | 2 | 3 | null = null;
  const pill = indicators.match(/^RATING\s*[·•.\-:]?\s*([0-3])\b[^\n]*/i);
  if (pill) {
    rating = Number(pill[1]) as 0 | 1 | 2 | 3;
    indicators = indicators.slice(pill[0].length).trim();
  } else {
    const inline = indicators.match(/\bRATING\s*[·•.\-:]?\s*([0-3])\b/i);
    if (inline && inline.index !== undefined && inline.index < 80) {
      rating = Number(inline[1]) as 0 | 1 | 2 | 3;
      indicators = (indicators.slice(0, inline.index) + indicators.slice(inline.index + inline[0].length))
        .replace(/\s{2,}/g, " ")
        .trim();
    }
  }
  return { indicators, rating };
}

function stripCriterionDescription(code: AsdCriterionCode, body: string): string {
  const desc = TEXLEX_CRITERIA[code]?.description?.trim();
  if (!desc) return body;
  const collapsedBody = body.replace(/\s+/g, " ").trim();
  const collapsedDesc = desc.replace(/\s+/g, " ").trim();
  if (collapsedBody.startsWith(collapsedDesc)) {
    // Remove from original by finding approximate end via word count
    const words = desc.split(/\s+/).length;
    const bodyWords = body.trim().split(/\s+/);
    return bodyWords.slice(words).join(" ").replace(/^\s*[-–—:]\s*/, "").trim();
  }
  if (body.trim().startsWith(desc)) {
    return body.trim().slice(desc.length).trim();
  }
  return body;
}

function extractPatientDetails(text: string): ImportedPatientDetails {
  const details: ImportedPatientDetails = {};
  const labelValue = (labels: string[]): string | undefined => {
    for (const label of labels) {
      const re = new RegExp(
        `(?:^|\\n)\\s*${label}\\s*[:\\n]\\s*([^\\n]+)`,
        "i"
      );
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

  const clientName = labelValue(["Client", "Client name", "Name"]);
  if (clientName) details.clientName = clientName.replace(/\s+·\s+.*$/, "").trim();

  const dobRaw = labelValue(["Date of birth", "DOB", "Dob"]);
  if (dobRaw) {
    const withoutAge = dobRaw.split("·")[0]?.trim() ?? dobRaw;
    details.dob = parseFlexibleDateToIso(withoutAge) ?? undefined;
    // Keep raw if parse failed but looks useful — leave undefined for date input safety
  }

  const pronouns = labelValue(["Pronouns"]);
  if (pronouns) details.pronouns = pronouns;

  const yearLevel = labelValue(["Year level", "Year Level"]);
  if (yearLevel) details.yearLevel = yearLevel;

  const school = labelValue(["School"]);
  if (school) details.school = school;

  const phone = labelValue(["Phone", "Telephone", "Mobile"]);
  if (phone) details.phone = phone;

  const address = labelValue(["Address"]);
  if (address) details.address = address;

  const referring = labelValue(["Referring practitioner", "Referrer"]);
  if (referring) details.referringPractitioner = referring;

  const assessor = labelValue(["Assessor", "Clinician"]);
  if (assessor) details.assessor = assessor;

  const reportDateRaw = labelValue(["Report date", "Date of report"]);
  if (reportDateRaw) details.reportDate = parseFlexibleDateToIso(reportDateRaw);

  const assessmentDateRaw = labelValue(["Assessment date", "Date of assessment", "Assessment dates"]);
  if (assessmentDateRaw) details.assessmentDate = parseFlexibleDateToIso(assessmentDateRaw);

  // Parents block often "Parents" then two lines or "Parent/Carer"
  const parentsBlock = text.match(
    /(?:^|\n)\s*(?:Parents|Parent\/Carer(?:s)?|Parent\/Guardians?)\s*[:\n]\s*([^\n]+)(?:\n\s*([^\n]+))?/i
  );
  if (parentsBlock) {
    const p1 = parentsBlock[1]?.trim();
    const p2 = parentsBlock[2]?.trim();
    if (p1 && !/^not provided$/i.test(p1)) details.parent1 = p1;
    if (p2 && !/^not provided$/i.test(p2) && !/^(phone|address|dob|school)/i.test(p2)) {
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
    ...SHARED_HEADINGS,
    ...(engine === "asd" ? ASD_ONLY_HEADINGS : []),
  ];

  const lines = text.split("\n");
  type Hit = { key: string; lineIndex: number; charStart: number };
  const hits: Hit[] = [];
  let charAt = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();
    if (lineMatchesAny(trimmed, SKIP_HEADINGS)) {
      charAt += line.length + 1;
      continue;
    }
    const key = findHeadingKey(trimmed, headingDefs);
    if (key) {
      // Prefer first occurrence of each key (except we allow only one)
      if (!hits.some((h) => h.key === key)) {
        hits.push({ key, lineIndex: i, charStart: charAt + (line.length - line.trimStart().length) });
      }
    }
    charAt += line.length + 1;
  }

  // Sort by position
  hits.sort((a, b) => a.lineIndex - b.lineIndex);

  const buckets: Record<string, string> = {};
  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i]!;
    const startLine = hit.lineIndex + 1;
    const endLine = i + 1 < hits.length ? hits[i + 1]!.lineIndex : lines.length;
    const body = cleanSectionBody(lines.slice(startLine, endLine).join("\n"));
    if (body) buckets[hit.key] = body;
  }

  // Strip assessment-context boilerplate if it leaked into presenting
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
    // Skip if it's only the standard boilerplate
    if (lim.replace(/\s+/g, " ") !== TEXLEX_LIMITATIONS.replace(/\s+/g, " ").trim()) {
      sections.limitationsText = lim;
    }
  }
  if (engine === "asd" && buckets.functionalImpactSummary) {
    sections.functionalImpactSummary = buckets.functionalImpactSummary;
  }

  if (engine === "asd") {
    const criteria: Partial<Record<AsdCriterionCode, ImportedCriterion>> = {};
    for (const code of ASD_CRITERION_CODES) {
      const raw = buckets[`criterion:${code}`];
      if (!raw) continue;
      let body = stripCriterionDescription(code, raw);
      // Drop criterion title line if duplicated
      body = body.replace(new RegExp(`^${code}\\.[^\\n]*\\n+`, "i"), "").trim();
      const { indicators, rating } = extractRatingFromCriterionBody(body);
      if (indicators.trim() || rating !== null) {
        criteria[code] = { indicators: indicators.trim(), rating };
      }
    }
    if (Object.keys(criteria).length) sections.criteria = criteria;
  }

  const patientDetails = extractPatientDetails(text);

  const filledSectionLabels: string[] = [];
  for (const [k, v] of Object.entries(buckets)) {
    if (v.trim()) filledSectionLabels.push(sectionLabel(k));
  }

  const proseCount = [
    sections.presentingConcerns,
    sections.pregnancyBirth,
    sections.earlyDevelopment,
    sections.educationalHistory,
    sections.emotionalBehaviouralSensory,
    sections.collateralSummary,
    sections.formulation,
    sections.recommendations,
    sections.functionalImpactSummary,
  ].filter((s) => (s ?? "").trim().length > 40).length;

  const criterionCount = Object.keys(sections.criteria ?? {}).length;
  const expectedMin = engine === "asd" ? 4 : 3;
  const score = proseCount + (engine === "asd" ? Math.min(3, Math.floor(criterionCount / 2)) : 0);

  let confidence: TexlexImportedReport["confidence"] = "low";
  if (score >= expectedMin + 2) confidence = "high";
  else if (score >= expectedMin) confidence = "medium";

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
    sections,
    filledSectionLabels,
    sourceCharCount: text.length,
  };
}
