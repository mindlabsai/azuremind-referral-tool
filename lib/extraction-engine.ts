// ASD / ADHD Live Formulation Engine
// Extraction engine core
// This file is the clinical intelligence layer between raw notes and the evidence ledger.

/*
ROLE

Input:
- raw live notes
- assessment type
- case/session IDs
- taxonomy markers from database

Output:
- evidence ledger rows
- criterion readiness scores
- differential flags
- missing clinical questions

The first production version should use deterministic extraction + LLM second pass.
Never rely on the LLM alone.
*/

// =====================================================
// 1. TYPES
// =====================================================

export type AssessmentType = "ASD" | "ADHD" | "ASD_ADHD";

export type CriterionCode =
  | "ASD_A1"
  | "ASD_A2"
  | "ASD_A3"
  | "ASD_B1"
  | "ASD_B2"
  | "ASD_B3"
  | "ASD_B4"
  | "ASD_C"
  | "ASD_D"
  | "ASD_E"
  | "ADHD_INATTENTION"
  | "ADHD_HYPERACTIVE_IMPULSIVE"
  | "ADHD_IMPAIRMENT"
  | "MASKING"
  | "FUNCTIONAL_IMPAIRMENT"
  | "DIFFERENTIAL"
  | "RISK";

export type EvidenceStatus =
  | "detected"
  | "accepted"
  | "rejected"
  | "needs_clarification"
  | "clinician_edited";

export type Readiness = "missing" | "partial" | "sufficient" | "strong" | "contradictory";

export interface TaxonomyMarker {
  id: string;
  criterionCode: CriterionCode;
  markerLabel: string;
  exampleTerms: string[];
  examplePhrases: string[];
  severityWeight: number;
  defaultConfidence: number;
}

export interface ExtractInput {
  caseId: string;
  sessionId: string;
  clinicianId: string;
  assessmentType: AssessmentType;
  rawNotes: string;
  taxonomyMarkers: TaxonomyMarker[];
}

export interface EvidenceCandidate {
  caseId: string;
  sessionId: string;
  clinicianId: string;
  criterionCode: CriterionCode;
  taxonomyMarkerId?: string;
  markerLabel: string;
  evidenceQuote: string;
  confidence: number;
  severityWeight: number;
  status: EvidenceStatus;
  sourceType: "live_note";
  extractionMethod: "deterministic" | "llm" | "hybrid";
  rawNoteLocation?: {
    sentenceIndex: number;
    startChar?: number;
    endChar?: number;
  };
  rationale?: string;
  differentialFlags?: string[];
}

export interface CriterionReadinessResult {
  criterionCode: CriterionCode;
  readiness: Readiness;
  acceptedEvidenceCount: number;
  detectedEvidenceCount: number;
  contradictionCount: number;
  averageConfidence: number;
  summary: string;
}

export interface ExtractionResult {
  evidence: EvidenceCandidate[];
  readiness: CriterionReadinessResult[];
  differentialFlags: string[];
  missingQuestions: string[];
  contradictionWarnings: string[];
}

// =====================================================
// 2. TEXT HELPERS
// =====================================================

export function normaliseText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitIntoSentences(rawText: string): string[] {
  return rawText
    .replace(/\n+/g, ". ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function sentenceContains(sentence: string, term: string): boolean {
  return normaliseText(sentence).includes(normaliseText(term));
}

export function uniqueByEvidence(items: EvidenceCandidate[]): EvidenceCandidate[] {
  const seen = new Set<string>();
  const output: EvidenceCandidate[] = [];

  for (const item of items) {
    const key = `${item.criterionCode}:${item.markerLabel}:${normaliseText(item.evidenceQuote)}`;
    if (!seen.has(key)) {
      seen.add(key);
      output.push(item);
    }
  }

  return output;
}

// =====================================================
// 3. DETERMINISTIC EXTRACTION
// =====================================================

export function deterministicExtract(input: ExtractInput): EvidenceCandidate[] {
  const sentences = splitIntoSentences(input.rawNotes);
  const candidates: EvidenceCandidate[] = [];

  sentences.forEach((sentence, sentenceIndex) => {
    for (const marker of input.taxonomyMarkers) {
      const allTerms = [...marker.exampleTerms, ...marker.examplePhrases].filter(Boolean);
      const hits = allTerms.filter((term) => sentenceContains(sentence, term));

      if (hits.length === 0) continue;

      const confidence = Math.min(
        0.95,
        marker.defaultConfidence + hits.length * 0.08 + (sentence.length > 80 ? 0.04 : 0)
      );

      candidates.push({
        caseId: input.caseId,
        sessionId: input.sessionId,
        clinicianId: input.clinicianId,
        criterionCode: marker.criterionCode,
        taxonomyMarkerId: marker.id,
        markerLabel: marker.markerLabel,
        evidenceQuote: sentence,
        confidence,
        severityWeight: marker.severityWeight,
        status: confidence >= 0.78 ? "detected" : "needs_clarification",
        sourceType: "live_note",
        extractionMethod: "deterministic",
        rawNoteLocation: { sentenceIndex },
        rationale: `Matched term(s): ${hits.join(", ")}`,
      });
    }
  });

  return uniqueByEvidence(candidates);
}

// =====================================================
// 4. DIFFERENTIAL FLAGS
// =====================================================

export function detectDifferentialFlags(rawNotes: string): string[] {
  const text = normaliseText(rawNotes);
  const flags = new Set<string>();

  const addIf = (flag: string, terms: string[]) => {
    if (terms.some((term) => text.includes(term))) flags.add(flag);
  };

  addIf("ADHD_OVERLAP", ["adhd", "inattention", "impulsive", "hyperactive", "distractible", "executive"]);
  addIf("ANXIETY_OVERLAP", ["anxiety", "worry", "panic", "fear", "social anxiety", "school refusal"]);
  addIf("LANGUAGE_DISORDER_OVERLAP", ["language disorder", "speech delay", "receptive language", "expressive language", "dld", "limited verbal"]);
  addIf("TRAUMA_ATTACHMENT_OVERLAP", ["trauma", "attachment", "separation", "family violence", "grief", "loss", "bereavement"]);
  addIf("FASD_OVERLAP", ["fasd", "fetal alcohol", "foetal alcohol"]);
  addIf("INTELLECTUAL_DISABILITY_OVERLAP", ["intellectual disability", "global developmental delay", "gdd", "cognitive delay"]);
  addIf("GIFTEDNESS_OVERLAP", ["gifted", "high iq", "very bright", "advanced language", "highly academic"]);
  addIf("SCHOOL_HOME_DISCREPANCY", ["fine at school", "teacher average", "home collapse", "different at home", "parent elevated", "school does not see"]);
  addIf("POSSIBLE_MASKING", ["masking", "camouflage", "scripted", "rehearsed", "post-school collapse", "exhausted after school"]);
  addIf("ASD_RULE_OUT_SIGNAL", ["criterion not met", "not consistent with autism", "asd ruled out", "does not meet"]);

  return Array.from(flags);
}

// =====================================================
// 5. CONTRADICTION WARNINGS
// =====================================================

export function detectContradictions(rawNotes: string, evidence: EvidenceCandidate[]): string[] {
  const text = normaliseText(rawNotes);
  const warnings: string[] = [];
  const asdEvidenceCount = evidence.filter((item) => item.criterionCode.startsWith("ASD_")).length;

  if (asdEvidenceCount >= 5 && /fine at school|teacher average|no concerns at school|school does not see/.test(text)) {
    warnings.push("Strong ASD markers appear alongside low school concern. Treat as possible masking, environmental structure effect, or informant discrepancy.");
  }

  if (asdEvidenceCount >= 4 && /good friends|many friends|socially confident|popular/.test(text)) {
    warnings.push("Social strengths are present alongside ASD markers. Clarify reciprocity quality, friendship depth, flexibility, and social fatigue before interpreting criterion A3.");
  }

  if (/no speech delay/.test(text) && /limited verbal|non-verbal|speech delay|language disorder/.test(text)) {
    warnings.push("Speech/language history appears internally inconsistent. Clarify early milestones versus current expressive, receptive, and pragmatic language functioning.");
  }

  if (/criterion not met|not met/.test(text) && asdEvidenceCount >= 5) {
    warnings.push("The notes include non-met language despite multiple ASD markers. Review whether this reflects differential formulation, historical text, or a live contradiction.");
  }

  if (/adhd/.test(text) && asdEvidenceCount >= 3) {
    warnings.push("ADHD overlap present. Ensure social-communication impairment is not explained solely by impulsivity, inattention, or executive dysfunction.");
  }

  return warnings;
}

// =====================================================
// 6. READINESS SCORING
// =====================================================

const CORE_ASD_CRITERIA: CriterionCode[] = [
  "ASD_A1",
  "ASD_A2",
  "ASD_A3",
  "ASD_B1",
  "ASD_B2",
  "ASD_B3",
  "ASD_B4",
  "FUNCTIONAL_IMPAIRMENT",
];

export function computeCriterionReadiness(evidence: EvidenceCandidate[], contradictions: string[]): CriterionReadinessResult[] {
  return CORE_ASD_CRITERIA.map((criterionCode) => {
    const items = evidence.filter((item) => item.criterionCode === criterionCode);
    const detectedEvidenceCount = items.length;
    const acceptedEvidenceCount = items.filter((item) => item.confidence >= 0.78).length;
    const averageConfidence = detectedEvidenceCount
      ? items.reduce((sum, item) => sum + item.confidence, 0) / detectedEvidenceCount
      : 0;

    const contradictionCount = contradictions.filter((warning) => {
      if (criterionCode === "ASD_A3" && warning.includes("Social strengths")) return true;
      if (criterionCode === "FUNCTIONAL_IMPAIRMENT" && warning.includes("school concern")) return true;
      return false;
    }).length;

    let readiness: Readiness = "missing";
    if (contradictionCount > 0 && detectedEvidenceCount > 0) readiness = "contradictory";
    else if (acceptedEvidenceCount >= 3 || averageConfidence >= 0.85) readiness = "strong";
    else if (acceptedEvidenceCount >= 1 || averageConfidence >= 0.72) readiness = "sufficient";
    else if (detectedEvidenceCount >= 1) readiness = "partial";

    const summary = buildReadinessSummary(criterionCode, readiness, detectedEvidenceCount, averageConfidence);

    return {
      criterionCode,
      readiness,
      acceptedEvidenceCount,
      detectedEvidenceCount,
      contradictionCount,
      averageConfidence,
      summary,
    };
  });
}

export function buildReadinessSummary(
  criterionCode: CriterionCode,
  readiness: Readiness,
  detectedEvidenceCount: number,
  averageConfidence: number
): string {
  const confidence = Math.round(averageConfidence * 100);

  if (readiness === "missing") {
    return `${criterionCode}: no evidence detected yet. Ask targeted follow-up questions before drafting.`;
  }

  if (readiness === "partial") {
    return `${criterionCode}: partial evidence detected (${detectedEvidenceCount} item/s, average confidence ${confidence}%). Requires clarification before criterion-level wording.`;
  }

  if (readiness === "sufficient") {
    return `${criterionCode}: sufficient evidence detected (${detectedEvidenceCount} item/s, average confidence ${confidence}%). Draft cautiously and preserve evidence linkage.`;
  }

  if (readiness === "strong") {
    return `${criterionCode}: strong evidence detected (${detectedEvidenceCount} item/s, average confidence ${confidence}%). Suitable for report drafting if consistent with developmental history and collateral.`;
  }

  return `${criterionCode}: evidence detected but contradiction present. Do not state criterion met until discrepancy is resolved.`;
}

// =====================================================
// 7. MISSING QUESTIONS
// =====================================================

export function buildMissingQuestions(readiness: CriterionReadinessResult[]): string[] {
  const questions: string[] = [];

  for (const item of readiness) {
    if (item.readiness !== "missing" && item.readiness !== "partial") continue;

    switch (item.criterionCode) {
      case "ASD_A1":
        questions.push("Ask: Does the child initiate conversation, ask reciprocal questions, share emotions, and respond when others approach them?");
        break;
      case "ASD_A2":
        questions.push("Ask: What is eye contact like across settings? Do they use gestures, facial expression, tone, and body language naturally?");
        break;
      case "ASD_A3":
        questions.push("Ask: What is the quality of friendships, play flexibility, peer repair, social stamina, and ability to adjust behaviour?");
        break;
      case "ASD_B1":
        questions.push("Ask: Any hand flapping, toe walking, echolalia, repetitive phrases, lining up, sorting, spinning, or repetitive object use?");
        break;
      case "ASD_B2":
        questions.push("Ask: How do they cope with transitions, changes in routine, unexpected events, rules, fairness, and repetitive questioning?");
        break;
      case "ASD_B3":
        questions.push("Ask: Are interests unusually intense, repetitive, dominant in conversation, difficult to shift from, or interfering with daily functioning?");
        break;
      case "ASD_B4":
        questions.push("Ask: Any sound, clothing, food texture, smell, light, movement, grooming, or crowded-environment sensitivities?");
        break;
      case "FUNCTIONAL_IMPAIRMENT":
        questions.push("Ask: What is the impact across school, home, adaptive functioning, peer relationships, emotional regulation, safety, and family routines?");
        break;
    }
  }

  return questions;
}

// =====================================================
// 8. MAIN EXTRACTION PIPELINE
// =====================================================

export async function runExtractionPipeline(input: ExtractInput): Promise<ExtractionResult> {
  const deterministicEvidence = deterministicExtract(input);

  // Placeholder for LLM extraction pass.
  // In production:
  // const llmEvidence = await llmExtract(input.rawNotes, input.assessmentType);
  // const mergedEvidence = mergeEvidence(deterministicEvidence, llmEvidence);

  const mergedEvidence = deterministicEvidence;
  const differentialFlags = detectDifferentialFlags(input.rawNotes);
  const contradictionWarnings = detectContradictions(input.rawNotes, mergedEvidence);
  const readiness = computeCriterionReadiness(mergedEvidence, contradictionWarnings);
  const missingQuestions = buildMissingQuestions(readiness);

  return {
    evidence: mergedEvidence,
    readiness,
    differentialFlags,
    missingQuestions,
    contradictionWarnings,
  };
}

// =====================================================
// 9. DATABASE WRITE PSEUDOCODE
// =====================================================

export async function persistExtractionResult(result: ExtractionResult) {
  /*
  Write flow:

  1. Upsert evidence_ledger rows.
     - Deduplicate by case_id + criterion_code + marker_label + evidence_quote.
     - Do not overwrite clinician-accepted/rejected status automatically.

  2. Upsert criterion_readiness rows.
     - One row per criterion.
     - Store readiness, acceptedEvidenceCount, contradictionCount, summary.

  3. Upsert differential_flags.
     - Keep active unless clinician dismisses.

  4. Return updated case intelligence snapshot.
  */
}

// =====================================================
// 10. API ROUTE EXAMPLE
// =====================================================

export const EXAMPLE_NEXT_API_ROUTE = `
// app/api/extract/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { runExtractionPipeline, persistExtractionResult } from '@/lib/asd-extraction-engine-core';
import { getTaxonomyMarkersForAssessment } from '@/lib/taxonomy';
import { requireClinician } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const clinician = await requireClinician();
  const body = await req.json();

  const taxonomyMarkers = await getTaxonomyMarkersForAssessment(body.assessmentType);

  const result = await runExtractionPipeline({
    caseId: body.caseId,
    sessionId: body.sessionId,
    clinicianId: clinician.id,
    assessmentType: body.assessmentType,
    rawNotes: body.rawNotes,
    taxonomyMarkers,
  });

  await persistExtractionResult(result);

  return NextResponse.json(result);
}
`;

// =====================================================
// 11. IMPORTANT SAFETY CONSTRAINT
// =====================================================

export const SAFETY_CONSTRAINT = `
The extraction engine may say:
- evidence detected
- evidence partially supports
- criterion appears supported
- further clarification required

The extraction engine must not independently diagnose.
Final diagnostic wording must require clinician approval and, where relevant, paediatrician review under the consensus pathway.
`;
