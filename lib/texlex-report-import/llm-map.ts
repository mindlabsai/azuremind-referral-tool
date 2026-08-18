import { anthropic, MODELS } from "@/lib/anthropic-client";
import type { TexlexEngineId } from "@/lib/texlex-report-state";
import { looksVerbatim, normalizeImportedReportText, parseFlexibleDateToIso } from "./normalize";
import {
  ASD_CRITERION_CODES,
  type AsdCriterionCode,
  type ImportedCriterion,
  type ImportedPatientDetails,
  type ImportedSections,
  type TexlexImportedReport,
} from "./types";

const SYSTEM = `You are a clinical document splitter for Texlex ADHD/ASD assessment reports.

Your ONLY job is to copy existing report text into the correct JSON fields.

HARD RULES:
1. Copy text VERBATIM from the source. Do not rewrite, paraphrase, summarise, fix spelling, fix grammar, or improve clinical voice.
2. Do not invent content. If a section is absent, omit it or use "".
3. Strip section headings themselves from the field values (do not include "Presenting concerns" as the first line of presentingConcerns).
4. Strip Texlex boilerplate criterion DESCRIPTION paragraphs that appear under A1–E headings (the fixed DSM explanatory blurb). Keep only the clinician-written indicators.
5. For ratings, use 0|1|2|3 only when clearly present (e.g. "RATING · 2 — ..."). Otherwise null.
6. Preserve paragraph breaks with \\n\\n where they exist in the source.
7. Patient detail dates should be ISO YYYY-MM-DD when possible.
8. Return ONLY valid JSON matching the schema. No markdown.`;

function buildUserPrompt(engine: TexlexEngineId, text: string, seed: TexlexImportedReport | null): string {
  const seedHint = seed
    ? `\nAlready detected by headings (prefer these exact strings when present; only fill empties):\n${JSON.stringify(
        {
          patientDetails: seed.patientDetails,
          sections: {
            ...seed.sections,
            criteria: seed.sections.criteria
              ? Object.fromEntries(
                  Object.entries(seed.sections.criteria).map(([k, v]) => [
                    k,
                    { rating: v?.rating ?? null, indicatorsPreview: (v?.indicators ?? "").slice(0, 120) },
                  ])
                )
              : undefined,
          },
        },
        null,
        2
      )}\n`
    : "";

  const asdExtra =
    engine === "asd"
      ? `
Also extract:
- functionalImpactSummary
- criteria object with keys ${ASD_CRITERION_CODES.join(", ")} each { "indicators": string, "rating": 0|1|2|3|null }`
      : "";

  return `Engine: ${engine}
${seedHint}
Source report text:
---
${text.slice(0, 120_000)}
---

Return JSON:
{
  "patientDetails": {
    "clientName": "",
    "dob": "",
    "pronouns": "",
    "yearLevel": "",
    "school": "",
    "parent1": "",
    "parent2": "",
    "phone": "",
    "address": "",
    "referringPractitioner": "",
    "assessor": "",
    "reportDate": "",
    "assessmentDate": ""
  },
  "sections": {
    "presentingConcerns": "",
    "pregnancyBirth": "",
    "earlyDevelopment": "",
    "educationalHistory": "",
    "emotionalBehaviouralSensory": "",
    "collateralSummary": "",
    "formulation": "",
    "recommendations": "",
    "limitationsText": ""${engine === "asd" ? ',\n    "functionalImpactSummary": "",\n    "criteria": {}' : ""}
  },
  "notes": "short note about coverage"
}
${asdExtra}`;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function pickPatient(raw: Record<string, unknown> | null | undefined): ImportedPatientDetails {
  if (!raw) return {};
  const out: ImportedPatientDetails = {};
  const set = (key: keyof ImportedPatientDetails, val: string) => {
    if (!val || /^not provided$/i.test(val) || val === "—" || /^n\/?a$/i.test(val)) return;
    if (key === "dob" || key === "reportDate" || key === "assessmentDate") {
      const iso = parseFlexibleDateToIso(val);
      if (iso) out[key] = iso;
      return;
    }
    out[key] = val;
  };
  set("clientName", asString(raw.clientName));
  set("dob", asString(raw.dob));
  set("pronouns", asString(raw.pronouns));
  set("yearLevel", asString(raw.yearLevel));
  set("school", asString(raw.school));
  set("parent1", asString(raw.parent1));
  set("parent2", asString(raw.parent2));
  set("phone", asString(raw.phone));
  set("address", asString(raw.address));
  set("referringPractitioner", asString(raw.referringPractitioner));
  set("assessor", asString(raw.assessor));
  set("reportDate", asString(raw.reportDate));
  set("assessmentDate", asString(raw.assessmentDate));
  return out;
}

function pickSections(
  engine: TexlexEngineId,
  raw: Record<string, unknown> | null | undefined,
  source: string,
  warnings: string[]
): ImportedSections {
  if (!raw) return {};
  const sections: ImportedSections = {};
  const assign = (key: keyof ImportedSections, val: string) => {
    if (!val) return;
    if (!looksVerbatim(source, val) && val.length > 80) {
      warnings.push(`${String(key)} may not be a verbatim extract — review carefully.`);
    }
    (sections as Record<string, unknown>)[key] = val;
  };

  assign("presentingConcerns", asString(raw.presentingConcerns));
  assign("pregnancyBirth", asString(raw.pregnancyBirth));
  assign("earlyDevelopment", asString(raw.earlyDevelopment));
  assign("educationalHistory", asString(raw.educationalHistory));
  assign("emotionalBehaviouralSensory", asString(raw.emotionalBehaviouralSensory));
  assign("collateralSummary", asString(raw.collateralSummary));
  assign("formulation", asString(raw.formulation));
  assign("recommendations", asString(raw.recommendations));
  assign("limitationsText", asString(raw.limitationsText));
  if (engine === "asd") {
    assign("functionalImpactSummary", asString(raw.functionalImpactSummary));
    const critRaw = raw.criteria;
    if (critRaw && typeof critRaw === "object") {
      const criteria: Partial<Record<AsdCriterionCode, ImportedCriterion>> = {};
      for (const code of ASD_CRITERION_CODES) {
        const row = (critRaw as Record<string, unknown>)[code];
        if (!row || typeof row !== "object") continue;
        const indicators = asString((row as { indicators?: unknown }).indicators);
        const ratingRaw = (row as { rating?: unknown }).rating;
        let rating: 0 | 1 | 2 | 3 | null = null;
        if (ratingRaw === 0 || ratingRaw === 1 || ratingRaw === 2 || ratingRaw === 3) {
          rating = ratingRaw;
        } else if (typeof ratingRaw === "string" && /^[0-3]$/.test(ratingRaw)) {
          rating = Number(ratingRaw) as 0 | 1 | 2 | 3;
        }
        if (indicators || rating !== null) {
          if (indicators && !looksVerbatim(source, indicators) && indicators.length > 80) {
            warnings.push(`Criterion ${code} may not be a verbatim extract — review carefully.`);
          }
          criteria[code] = { indicators, rating };
        }
      }
      if (Object.keys(criteria).length) sections.criteria = criteria;
    }
  }
  return sections;
}

function mergePreferExisting(
  base: ImportedSections,
  fill: ImportedSections
): ImportedSections {
  const out: ImportedSections = { ...base };
  const keys: (keyof ImportedSections)[] = [
    "presentingConcerns",
    "pregnancyBirth",
    "earlyDevelopment",
    "educationalHistory",
    "emotionalBehaviouralSensory",
    "collateralSummary",
    "formulation",
    "recommendations",
    "limitationsText",
    "functionalImpactSummary",
  ];
  for (const k of keys) {
    const existing = out[k];
    if (typeof existing === "string" && existing.trim().length > 40) continue;
    const next = fill[k];
    if (typeof next === "string" && next.trim()) {
      (out as Record<string, unknown>)[k] = next;
    }
  }
  if (fill.criteria) {
    const merged = { ...(out.criteria ?? {}) };
    for (const code of ASD_CRITERION_CODES) {
      const existing = merged[code];
      if (existing && existing.indicators.trim().length > 40) continue;
      const next = fill.criteria[code];
      if (next && (next.indicators.trim() || next.rating !== null)) merged[code] = next;
    }
    out.criteria = merged;
  }
  return out;
}

function mergePatient(
  base: ImportedPatientDetails,
  fill: ImportedPatientDetails
): ImportedPatientDetails {
  const out = { ...base };
  for (const [k, v] of Object.entries(fill) as [keyof ImportedPatientDetails, string | undefined][]) {
    if (!out[k] && v) out[k] = v;
  }
  return out;
}

function labelsFromSections(sections: ImportedSections): string[] {
  const labels: string[] = [];
  const map: Array<[keyof ImportedSections, string]> = [
    ["presentingConcerns", "Presenting concerns"],
    ["pregnancyBirth", "Pregnancy and birth"],
    ["earlyDevelopment", "Early development"],
    ["educationalHistory", "Educational history"],
    ["emotionalBehaviouralSensory", "Emotional, behavioural and sensory"],
    ["collateralSummary", "Collateral summary"],
    ["formulation", "Clinical formulation"],
    ["recommendations", "Recommendations"],
    ["limitationsText", "Limitations"],
    ["functionalImpactSummary", "Functional impact summary"],
  ];
  for (const [k, label] of map) {
    const v = sections[k];
    if (typeof v === "string" && v.trim()) labels.push(label);
  }
  for (const code of ASD_CRITERION_CODES) {
    const c = sections.criteria?.[code];
    if (c && (c.indicators.trim() || c.rating !== null)) labels.push(`Criterion ${code}`);
  }
  return labels;
}

function scoreConfidence(engine: TexlexEngineId, sections: ImportedSections): TexlexImportedReport["confidence"] {
  const prose = [
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
  const crit = Object.keys(sections.criteria ?? {}).length;
  const score = prose + (engine === "asd" ? Math.min(3, Math.floor(crit / 2)) : 0);
  const min = engine === "asd" ? 4 : 3;
  if (score >= min + 2) return "high";
  if (score >= min) return "medium";
  return "low";
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function mapReportWithLlm(
  engine: TexlexEngineId,
  rawText: string,
  seed: TexlexImportedReport | null
): Promise<TexlexImportedReport> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  const text = normalizeImportedReportText(rawText);
  const warnings: string[] = seed?.warnings ? [...seed.warnings] : [];

  const response = await anthropic.messages.create({
    model: MODELS.SONNET,
    max_tokens: 16_000,
    temperature: 0,
    system: SYSTEM,
    messages: [{ role: "user", content: buildUserPrompt(engine, text, seed) }],
  });

  const block = response.content.find((b) => b.type === "text");
  const rawJson = block && block.type === "text" ? block.text : "";
  const parsed = extractJsonObject(rawJson);
  if (!parsed) {
    throw new Error("AI mapping returned invalid JSON");
  }

  const llmPatient = pickPatient(
    parsed.patientDetails && typeof parsed.patientDetails === "object"
      ? (parsed.patientDetails as Record<string, unknown>)
      : null
  );
  const llmSections = pickSections(
    engine,
    parsed.sections && typeof parsed.sections === "object"
      ? (parsed.sections as Record<string, unknown>)
      : null,
    text,
    warnings
  );

  const sections = seed ? mergePreferExisting(seed.sections, llmSections) : llmSections;
  const patientDetails = seed
    ? mergePatient(seed.patientDetails, llmPatient)
    : llmPatient;

  const filledSectionLabels = labelsFromSections(sections);
  const confidence = scoreConfidence(engine, sections);

  return {
    engine,
    method: seed ? "hybrid" : "llm",
    confidence,
    warnings,
    patientDetails,
    sections,
    filledSectionLabels,
    sourceCharCount: text.length,
  };
}
