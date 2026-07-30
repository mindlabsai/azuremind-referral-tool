"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentProps,
  type Dispatch,
  type DragEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import { File as FileIcon, FileText, Image, Upload, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { mergeCriterionSuggestedRating } from "@/lib/texlex-criterion-rating";
import {
  capSuggestedRatingForDiagnosticConclusion,
  resolveTexlexDiagnosticConclusion,
  type TexlexDiagnosticConclusion,
} from "@/lib/texlex-diagnostic-conclusion";
import {
  normalizeCriterionState,
  sanitiseExtractedNumber,
  sanitiseForPdf,
  stripScientificNotationGarbageFromText,
  stripDashes,
} from "@/lib/texlex-pdf-sanitize";
import {
  buildLockedFormulationOpening,
  type FormulationCriterionSnapshot,
} from "@/lib/prompts/formulation-template";
import { ClinikoIntakeCard } from "./components/ClinikoIntakeCard";
import { TexlexSectionHeading } from "./components/TexlexSectionHeading";
import { TexlexSectionRawNotesField } from "./components/TexlexSectionRawNotesField";
import { TexlexModelPill } from "./components/TexlexModelPill";
import { TexlexReportSidebarNav } from "./components/TexlexReportSidebarNav";
import { TexlexReportHeader } from "./components/TexlexReportHeader";
import { NewReportConfirmModal } from "./components/NewReportConfirmModal";
import type { ClinikoDraftState } from "@/lib/texlex-cliniko-sync";
import {
  clearAsdLegacyLocalDraftKeys,
  clearEngineActiveDraftPointer,
  clearLocalEngineDraft,
  draftMatchesStorageKey,
  engineLocalDraftKey,
  formatLocalDraftClockTime,
  migrateAsdLegacyLocalDrafts,
  readEngineActiveDraftKey,
  readLocalEngineDraft,
  writeLocalEngineDraft,
} from "@/lib/engine-draft-storage";
import {
  fetchReportStateForEngine,
  saveReportStateForEngine,
} from "@/lib/texlex-report-state";
import { EngineAssistant } from "../components/EngineAssistant";
import { useAsdEnginePipeline } from "../asd-engine-core";
import {
  TEXLEX_ASSESSMENT_CONTEXT,
  TEXLEX_CONSENT,
  TEXLEX_CRITERIA,
  TEXLEX_CRITERION_A_HEADER,
  TEXLEX_CRITERION_B_HEADER,
  TEXLEX_CRITERION_C_HEADER,
  TEXLEX_DSM_INTRO,
  TEXLEX_HEADER,
  TEXLEX_LIMITATIONS,
  TEXLEX_RATING_GUIDE,
  TEXLEX_SECTION_MODELS,
  TEXLEX_SIGNATURE,
} from "./constants/texlexBoilerplate";
import {
  TEXLEX_SECTION_CONTAINER_CLASS,
  TEXLEX_SECTION_CONTENT_CLASS,
} from "./constants/texlexSectionSurface";
import { resolveTexlexPublicAsset, resolveTexlexSignatureSrc, TEXLEX_LOGO_PATH } from "./pdf/assets";
import {
  BACKGROUND_EMOTIONAL_EMPTY_FALLBACK,
  clientFirstName,
  computeChronologicalAge,
  FUNCTIONAL_IMPACT_RENDER_FALLBACK,
  isInsufficientEvidenceNarrative,
  isTexlexSubsectionEmpty,
  resolveFunctionalImpactDisplay,
  safeFilenamePart,
} from "./pdf/utils";

const AUTO_SAVE_DEBOUNCE_MS = 1500;
const METADATA_INPUT_MAX_LENGTH = 500;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

function pdfFieldString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

/** Remove tokens that look like corrupted floats (e.g. from bad PDF extraction pasted into a field). */
function stripCorruptedSciNumericTokens(input: string): string {
  return stripScientificNotationGarbageFromText(input, "normalizeTexlexTextForPdf")
    .replace(/\r\n/g, "\n")
    // Horizontal whitespace only — \s{2,} would collapse \n\n and destroy PDF paragraph breaks.
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Resolve DOB for storage / UI. Canonical field is `dob`; also accepts Cliniko-style `date_of_birth`
 * and legacy `dateOfBirth` so one value always maps into `dob`.
 */
function resolveDobFromRaw(r: Record<string, unknown>): string {
  const direct = typeof r.dob === "string" ? r.dob.trim() : "";
  if (direct) return stripCorruptedSciNumericTokens(direct);
  const camel = typeof r.dateOfBirth === "string" ? r.dateOfBirth.trim() : "";
  if (camel) return stripCorruptedSciNumericTokens(camel);
  const snake = typeof r.date_of_birth === "string" ? r.date_of_birth.trim() : "";
  return stripCorruptedSciNumericTokens(snake);
}

function normalizeAssessmentDatesFromStorage(v: unknown): string[] {
  if (Array.isArray(v)) {
    const arr = v.map((x) => String(x));
    return arr.length ? arr : [""];
  }
  if (typeof v === "string" && v.trim()) {
    const parts = v
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.length ? parts : [""];
  }
  return [""];
}

function formatAssessmentDatesDisplay(dates: string[]): string {
  const filled = dates.map((d) => d.trim()).filter(Boolean);
  if (!filled.length) return "";
  return filled
    .map((iso) => {
      const t = new Date(iso + "T12:00:00");
      return Number.isNaN(t.getTime()) ? iso : t.toLocaleDateString(undefined, { dateStyle: "medium" });
    })
    .join(", ");
}

/** Combined parent/carer line for templates and read-only summaries. */
function formatParentsCarers(parent1: string, parent2: string): string {
  const a = parent1.trim();
  const b = parent2.trim();
  if (a && b) return `${a} & ${b}`;
  return a || b;
}

const CRITERION_CODES = ["A1", "A2", "A3", "B1", "B2", "B3", "B4", "C", "D", "E"] as const;
export type CriterionCode = (typeof CRITERION_CODES)[number];

export type CriterionState = {
  code: CriterionCode;
  rating: 0 | 1 | 2 | 3 | null;
  indicators: string;
  suggestedRating: 0 | 1 | 2 | 3 | null;
  markerCount: number;
  lastGenerated: string | null;
};

export type PatientDetails = {
  clientName: string;
  parent1: string;
  parent2: string;
  parent1Relationship: string;
  parent2Relationship: string;
  dob: string;
  referringPractitioner: string;
  referringPractitionerType: string;
  referringPractitionerEmail: string;
  assessmentType: string;
  assessmentDates: string[];
  school: string;
  reportDate: string;
  yearLevel: string;
  assessor: string;
  phone: string;
  address: string;
  pronouns: string;
};

const DEFAULT_ASSESSOR = "Vishal Maharaj, Registered Psychologist, PSY0001579010";
const PRESERVED_ASSESSOR_FOR_NEW_REPORT =
  "Vishal Maharaj, Registered Psychologist, PSY0001579010, Azure Mind";

function todayReportDateIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function patientDetailsAfterNewReport(): PatientDetails {
  return {
    ...emptyPatientDetails(),
    assessor: PRESERVED_ASSESSOR_FOR_NEW_REPORT,
    reportDate: todayReportDateIso(),
  };
}

/** Clinical working content only — ignores Cliniko link and demographics. */
function texlexHasClinicalWorkingContent(args: {
  rawNotes: string;
  collateralDocs: CollateralDoc[];
  criteria: Record<CriterionCode, CriterionState>;
  presentingConcernsRaw: string;
  presentingConcerns: string;
  background: BackgroundState;
  collateralSummary: string;
  functionalImpactSummary: string;
  clinicalFormulation: string;
  recommendations: string;
  limitationsText: string;
  diagnosticConclusion?: TexlexDiagnosticConclusion;
}): boolean {
  if (resolveTexlexDiagnosticConclusion(args.diagnosticConclusion) !== "inconclusive") return true;
  if (args.rawNotes.trim()) return true;
  if (args.collateralDocs.length > 0) return true;
  if (args.presentingConcernsRaw.trim() || args.presentingConcerns.trim()) return true;
  if (args.collateralSummary.trim() || args.functionalImpactSummary.trim()) return true;
  if (args.clinicalFormulation.trim() || args.recommendations.trim()) return true;
  if (args.limitationsText.trim() !== TEXLEX_LIMITATIONS.trim()) return true;
  for (const key of Object.keys(args.background) as (keyof BackgroundState)[]) {
    if (args.background[key].trim()) return true;
  }
  for (const code of CRITERION_CODES) {
    const row = args.criteria[code];
    if (row.rating !== null || row.indicators.trim() || row.lastGenerated) return true;
  }
  return false;
}

function isTexlexDraftEffectivelyEmpty(args: {
  patientDetails: PatientDetails;
  rawNotes: string;
  collateralDocs: CollateralDoc[];
  criteria: Record<CriterionCode, CriterionState>;
  presentingConcernsRaw: string;
  presentingConcerns: string;
  background: BackgroundState;
  collateralSummary: string;
  functionalImpactSummary: string;
  clinicalFormulation: string;
  recommendations: string;
  limitationsText: string;
  cliniko?: ClinikoDraftState | null;
  diagnosticConclusion?: TexlexDiagnosticConclusion;
}): boolean {
  const {
    patientDetails,
    rawNotes,
    collateralDocs,
    criteria,
    presentingConcernsRaw,
    presentingConcerns,
    background,
    collateralSummary,
    functionalImpactSummary,
    clinicalFormulation,
    recommendations,
    limitationsText,
    cliniko,
    diagnosticConclusion,
  } = args;

  if (resolveTexlexDiagnosticConclusion(diagnosticConclusion) !== "inconclusive") return false;

  if (cliniko ?? null) return false;
  if (rawNotes.trim()) return false;
  if (collateralDocs.length > 0) return false;
  if (presentingConcernsRaw.trim() || presentingConcerns.trim()) return false;
  if (collateralSummary.trim() || functionalImpactSummary.trim()) return false;
  if (clinicalFormulation.trim() || recommendations.trim()) return false;
  if (limitationsText.trim() !== TEXLEX_LIMITATIONS.trim()) return false;

  for (const key of Object.keys(background) as (keyof BackgroundState)[]) {
    if (background[key].trim()) return false;
  }

  for (const code of CRITERION_CODES) {
    const row = criteria[code];
    if (row.rating !== null || row.indicators.trim() || row.lastGenerated) return false;
  }

  const details = patientDetails;
  if (
    details.clientName.trim() ||
    details.parent1.trim() ||
    details.parent2.trim() ||
    details.parent1Relationship.trim() ||
    details.parent2Relationship.trim() ||
    details.dob.trim() ||
    details.referringPractitioner.trim() ||
    details.referringPractitionerType.trim() ||
    details.referringPractitionerEmail.trim() ||
    details.assessmentType.trim() ||
    details.school.trim() ||
    details.yearLevel.trim() ||
    details.phone.trim() ||
    details.address.trim() ||
    details.pronouns.trim()
  ) {
    return false;
  }

  if (details.assessmentDates.some((date) => date.trim())) return false;

  return true;
}

function emptyPatientDetails(): PatientDetails {
  return {
    clientName: "",
    parent1: "",
    parent2: "",
    parent1Relationship: "",
    parent2Relationship: "",
    dob: "",
    referringPractitioner: "",
    referringPractitionerType: "",
    referringPractitionerEmail: "",
    assessmentType: "",
    assessmentDates: [""],
    school: "",
    reportDate: new Date().toISOString().slice(0, 10),
    yearLevel: "",
    assessor: DEFAULT_ASSESSOR,
    phone: "",
    address: "",
    pronouns: "",
  };
}

function stripPhoneFromStoredAddress(address: string): string {
  const phoneIndex = address.search(/\bPhone\s*:/i);
  if (phoneIndex === -1) return address;
  return address.slice(0, phoneIndex).trim().replace(/[,\s]+$/, "");
}

function migratePatientDetails(raw: unknown): PatientDetails {
  const next = emptyPatientDetails();
  if (!raw || typeof raw !== "object") return next;
  const r = raw as Record<string, unknown>;

  const parent1 =
    typeof r.parent1 === "string"
      ? r.parent1
      : typeof r.parents === "string"
        ? r.parents
        : "";
  const parent2 = typeof r.parent2 === "string" ? r.parent2 : "";

  const assessmentDatesMerged = Array.isArray(r.assessmentDates)
    ? normalizeAssessmentDatesFromStorage(r.assessmentDates)
    : normalizeAssessmentDatesFromStorage(
        typeof r.assessmentDates === "string"
          ? r.assessmentDates
          : typeof r.dateOfAssessment === "string"
            ? r.dateOfAssessment
            : ""
      );

  if ("clientName" in r || "dob" in r) {
    return {
      ...next,
      clientName: typeof r.clientName === "string" ? r.clientName : next.clientName,
      parent1,
      parent2,
      parent1Relationship:
        typeof r.parent1Relationship === "string" ? r.parent1Relationship : next.parent1Relationship,
      parent2Relationship:
        typeof r.parent2Relationship === "string" ? r.parent2Relationship : next.parent2Relationship,
      dob: resolveDobFromRaw(r) || next.dob,
      referringPractitioner:
        typeof r.referringPractitioner === "string" ? r.referringPractitioner : next.referringPractitioner,
      referringPractitionerType:
        typeof r.referringPractitionerType === "string"
          ? r.referringPractitionerType
          : next.referringPractitionerType,
      referringPractitionerEmail:
        typeof r.referringPractitionerEmail === "string"
          ? r.referringPractitionerEmail
          : next.referringPractitionerEmail,
      assessmentType: typeof r.assessmentType === "string" ? r.assessmentType : next.assessmentType,
      assessmentDates: assessmentDatesMerged,
      school: typeof r.school === "string" ? r.school : next.school,
      reportDate: typeof r.reportDate === "string" && r.reportDate ? r.reportDate : next.reportDate,
      yearLevel: typeof r.yearLevel === "string" ? r.yearLevel : next.yearLevel,
      assessor: typeof r.assessor === "string" && r.assessor ? r.assessor : next.assessor,
      phone: typeof r.phone === "string" ? r.phone : next.phone,
      address: stripPhoneFromStoredAddress(typeof r.address === "string" ? r.address : next.address),
      pronouns: typeof r.pronouns === "string" ? r.pronouns : next.pronouns,
    };
  }
  return {
    ...next,
    clientName: typeof r.fullName === "string" ? r.fullName : typeof r.clientName === "string" ? r.clientName : "",
    parent1,
    parent2,
    parent1Relationship: typeof r.parent1Relationship === "string" ? r.parent1Relationship : "",
    parent2Relationship: typeof r.parent2Relationship === "string" ? r.parent2Relationship : "",
    dob: resolveDobFromRaw(r),
    referringPractitioner:
      typeof r.referringPractitioner === "string"
        ? r.referringPractitioner
        : typeof r.referrer === "string"
          ? r.referrer
          : "",
    referringPractitionerType: typeof r.referringPractitionerType === "string" ? r.referringPractitionerType : "",
    referringPractitionerEmail:
      typeof r.referringPractitionerEmail === "string" ? r.referringPractitionerEmail : "",
    assessmentType: typeof r.assessmentType === "string" ? r.assessmentType : "",
    assessmentDates: assessmentDatesMerged,
    school: typeof r.school === "string" ? r.school : "",
    reportDate: typeof r.reportDate === "string" && r.reportDate ? r.reportDate : next.reportDate,
    yearLevel: typeof r.yearLevel === "string" ? r.yearLevel : "",
    assessor: typeof r.assessor === "string" && r.assessor ? r.assessor : next.assessor,
    phone: typeof r.phone === "string" ? r.phone : "",
    address: stripPhoneFromStoredAddress(typeof r.address === "string" ? r.address : ""),
    pronouns: typeof r.pronouns === "string" ? r.pronouns : "",
  };
}

function buildCriterionMarkersPayload(markers: unknown, code: CriterionCode): string {
  if (!Array.isArray(markers)) return "(no markers detected)";
  const lines: string[] = [];
  for (const raw of markers) {
    if (!raw || typeof raw !== "object") continue;
    const m = raw as Record<string, unknown>;
    if (m.code !== code) continue;
    const label = typeof m.label === "string" ? m.label : "Marker";
    let src = "";
    if (typeof m.verbatim === "string" && m.verbatim.trim()) src = m.verbatim.trim();
    else if (typeof m.matchedText === "string" && m.matchedText.trim()) src = m.matchedText.trim();
    else if (Array.isArray(m.hits) && m.hits.length) {
      const h0 = m.hits[0];
      if (typeof h0 === "string" && h0.trim()) src = h0.trim();
    }
    const safe = src.replace(/"/g, "'");
    lines.push(`- ${label} (source: "${safe}")`);
  }
  return lines.length ? lines.join("\n") : "(no markers detected)";
}

function criterionSectionId(code: CriterionCode): string {
  return `criterion-${code}`;
}

function isCollateralPdfDoc(doc: CollateralDoc): boolean {
  return (
    doc.mimeType === "application/pdf" || doc.filename.toLowerCase().endsWith(".pdf")
  );
}

function collateralAiStatusLabel(doc: CollateralDoc): string {
  if (isCollateralPdfDoc(doc)) {
    if (doc.extractionStatus === "ready") return "📄 PDF: AI summary enabled";
    if (doc.extractionStatus === "failed") return "PDF: read failed — manual summary required";
    return "PDF: preparing…";
  }
  return "⏳ JPG/PNG/HEIC/DOCX: manual summary";
}

function buildCollateralManifestForApi(docs: CollateralDoc[]): string {
  if (!docs.length) return "";
  const lines = docs.map((d) => {
    const title = d.filename.trim() || "Collateral document";
    const manual = d.content?.trim();
    let line = `- ${title} (${d.category}): ${collateralAiStatusLabel(d)}`;
    if (manual) line += `\n  Clinician manual summary: ${manual}`;
    return line;
  });
  return `Collateral upload manifest:\n${lines.join("\n")}`;
}

function buildCollateralPdfPayload(docs: CollateralDoc[]): {
  collateralPdfDocuments: Array<{
    id: string;
    filename: string;
    category: string;
    data: string;
  }>;
  unsupportedCollateralDocuments: Array<{ id: string; filename: string; mimeType: string }>;
  pendingCollateralDocuments: Array<{ id: string; filename: string }>;
} {
  const collateralPdfDocuments: Array<{
    id: string;
    filename: string;
    category: string;
    data: string;
  }> = [];
  const unsupportedCollateralDocuments: Array<{ id: string; filename: string; mimeType: string }> =
    [];
  const pendingCollateralDocuments: Array<{ id: string; filename: string }> = [];

  for (const doc of docs) {
    if (isCollateralPdfDoc(doc)) {
      if (doc.extractionStatus === "ready" && doc.pdfBase64) {
        collateralPdfDocuments.push({
          id: doc.id,
          filename: doc.filename,
          category: doc.category,
          data: doc.pdfBase64,
        });
      } else if (doc.extractionStatus === "failed") {
        pendingCollateralDocuments.push({ id: doc.id, filename: doc.filename });
      } else {
        pendingCollateralDocuments.push({ id: doc.id, filename: doc.filename });
      }
    } else {
      unsupportedCollateralDocuments.push({
        id: doc.id,
        filename: doc.filename,
        mimeType: doc.mimeType,
      });
    }
  }

  return {
    collateralPdfDocuments,
    unsupportedCollateralDocuments,
    pendingCollateralDocuments,
  };
}

function serialiseCollateralDocsForStorage(docs: CollateralDoc[]): CollateralDoc[] {
  return docs.map((doc) => {
    const { pdfBase64: _pdf, ...rest } = doc;
    const extractionStatus =
      isCollateralPdfDoc(doc) && doc.extractionStatus === "ready"
        ? "pending"
        : doc.extractionStatus;
    return { ...rest, pdfBase64: null, extractionStatus };
  });
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Could not read file"));
        return;
      }
      const comma = reader.result.indexOf(",");
      resolve(comma >= 0 ? reader.result.slice(comma + 1) : reader.result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsDataURL(file);
  });
}

const GENERATION_MIN_NOTES_CHARS = 20;
const GENERATION_MIN_NOTES_ERROR =
  "Provide notes in master Raw Clinical Notes OR this section's input field (minimum 20 characters).";

function resolveGenerationRawNotes(sectionInput: string, masterInput: string): string {
  const section = sectionInput.trim();
  const master = masterInput.trim();
  return section.length >= GENERATION_MIN_NOTES_CHARS ? section : master;
}

function buildCriteriaStateBlock(criteriaState: Record<CriterionCode, CriterionState>): string {
  const parts: string[] = [];
  for (const code of CRITERION_CODES) {
    const t = criteriaState[code]?.indicators?.trim();
    if (t) parts.push(`## ${code}\n${t}`);
  }
  return parts.join("\n\n");
}

function buildRatingsAssignedSnapshot(
  criteriaState: Record<CriterionCode, CriterionState>
): Record<string, number | null> {
  return Object.fromEntries(
    CRITERION_CODES.map((code) => [code, criteriaState[code]?.rating ?? null])
  );
}

function buildFormulationPatientDetailsForCritic(
  patientDetails: PatientDetails,
  chronologicalAge: string
): Record<string, string> {
  return {
    clientName: patientDetails.clientName,
    pronouns: patientDetails.pronouns,
    chronologicalAge,
    yearLevel: patientDetails.yearLevel,
    school: patientDetails.school,
    referringPractitioner: patientDetails.referringPractitioner,
    referringPractitionerType: patientDetails.referringPractitionerType,
  };
}

type VoiceCriticBadgeKind = "criticApplied" | "fallbackToDraft" | "criticDisabled";

type CollateralDocumentProcessingStatus = {
  id: string;
  filename: string;
  status: "processed" | "failed" | "unsupported" | "pending";
  detail?: string;
};

type VoiceCriticStreamMeta = {
  criticApplied: boolean;
  fallbackToDraft: boolean;
  criticDisabled: boolean;
  model: string;
  truncationWarning: string | null;
  documentProcessing?: CollateralDocumentProcessingStatus[];
};

function applyVoiceCriticBadgeFromMeta(
  meta: VoiceCriticStreamMeta,
  setBadge: (kind: VoiceCriticBadgeKind | null) => void
): void {
  if (meta.criticDisabled) setBadge("criticDisabled");
  else if (meta.criticApplied && !meta.fallbackToDraft) setBadge("criticApplied");
  else if (meta.fallbackToDraft) setBadge("fallbackToDraft");
  else setBadge(null);
}

function VoiceCriticBadge({ kind }: { kind: VoiceCriticBadgeKind | null }) {
  if (!kind) return null;
  if (kind === "criticApplied") {
    return (
      <span className="w-full basis-full text-xs text-muted-foreground">
        Generation: Claude Sonnet 4.6 → Voice critic: Claude Opus 4.7
      </span>
    );
  }
  if (kind === "fallbackToDraft") {
    return (
      <span className="w-full basis-full text-xs text-muted-foreground">
        Generation: Claude Sonnet 4.6 (voice critic unavailable — single pass)
      </span>
    );
  }
  return (
    <span className="w-full basis-full text-xs text-muted-foreground">
      Generation: Claude Sonnet 4.6
    </span>
  );
}

function logVoiceCriticComplete(sectionLabel: string, meta: VoiceCriticStreamMeta): void {
  console.info(`[Texlex] ${sectionLabel} generation complete`, {
    criticApplied: meta.criticApplied,
    fallbackToDraft: meta.fallbackToDraft,
    criticDisabled: meta.criticDisabled,
    model: meta.model,
    truncationWarning: meta.truncationWarning,
  });
}

async function streamTexlexWithCriticSse(
  url: string,
  body: unknown,
  onDelta: (text: string) => void,
  onComplete: (meta: VoiceCriticStreamMeta, finalContent: string) => void,
  abortSignal: AbortSignal
): Promise<string> {
  let assembled = "";
  let finalContent = "";
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: abortSignal,
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text();
    let detail = errorText.slice(0, 800);
    try {
      const j = JSON.parse(errorText) as { error?: string };
      if (typeof j.error === "string") detail = j.error;
    } catch {
      /* keep raw body */
    }
    throw new Error(`Generation failed: ${detail}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let meta: VoiceCriticStreamMeta | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") {
        const content = stripDashes(finalContent || assembled);
        if (meta) onComplete(meta, content);
        return content;
      }
      try {
        const parsed = JSON.parse(data) as {
          delta?: string;
          error?: string;
          content?: string;
          replaceContent?: boolean;
          criticApplied?: boolean;
          fallbackToDraft?: boolean;
          criticDisabled?: boolean;
          model?: string;
          truncationWarning?: string | null;
          truncation_warning?: string;
          documentProcessing?: CollateralDocumentProcessingStatus[];
        };
        if (parsed.error) throw new Error(parsed.error);
        if (typeof parsed.delta === "string" && parsed.delta.length) {
          assembled += parsed.delta;
          onDelta(parsed.delta);
        }
        if (typeof parsed.content === "string") {
          finalContent = parsed.content;
          meta = {
            criticApplied: Boolean(parsed.criticApplied),
            fallbackToDraft: Boolean(parsed.fallbackToDraft),
            criticDisabled: Boolean(parsed.criticDisabled),
            model: typeof parsed.model === "string" ? parsed.model : "claude-sonnet-4-6",
            truncationWarning:
              typeof parsed.truncationWarning === "string"
                ? parsed.truncationWarning
                : typeof parsed.truncation_warning === "string"
                  ? parsed.truncation_warning
                  : null,
            documentProcessing: Array.isArray(parsed.documentProcessing)
              ? parsed.documentProcessing
              : undefined,
          };
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
  const content = stripDashes(finalContent || assembled);
  if (meta) onComplete(meta, content);
  return content;
}

// Fallback: derive DSM-5-TR support levels from clinician-set criterion ratings
// when the engine (deriveLevelOfSupport) returns determinable: false.
// Per DSM-5-TR: Level A = max(A1, A2, A3); Level B = max(B1..B4).
function deriveLevelsFromCriterionRatings(
  criteriaState: Record<CriterionCode, CriterionState>
): { levelA: number | null; levelB: number | null; determinable: boolean } {
  const aCodes: CriterionCode[] = ["A1", "A2", "A3"] as CriterionCode[];
  const bCodes: CriterionCode[] = ["B1", "B2", "B3", "B4"] as CriterionCode[];
  const readRating = (code: CriterionCode): number | null => {
    const r = criteriaState[code]?.rating;
    if (typeof r === "number" && r >= 1 && r <= 3) return r;
    return null;
  };
  const aRatings = aCodes.map(readRating).filter((v): v is number => v != null);
  const bRatings = bCodes.map(readRating).filter((v): v is number => v != null);
  // Require at least one rated criterion in each domain
  if (aRatings.length === 0 || bRatings.length === 0) {
    return { levelA: null, levelB: null, determinable: false };
  }
  const levelA = Math.max(...aRatings);
  const levelB = Math.max(...bRatings);
  return { levelA, levelB, determinable: true };
}

function criteriaSnapshotForFormulationLock(
  criteriaState: Record<CriterionCode, CriterionState>
): Record<string, FormulationCriterionSnapshot> {
  return Object.fromEntries(
    CRITERION_CODES.map((code) => {
      const row = criteriaState[code];
      return [
        code,
        {
          indicators: row.indicators,
          markerCount: row.markerCount,
          suggestedRating: row.suggestedRating,
          rating: row.rating,
        },
      ];
    })
  );
}

type ReportGenerationSnapshot = {
  presentingConcerns: string;
  background: BackgroundState;
  collateralSummary: string;
  criteria: Record<CriterionCode, CriterionState>;
  clinicalFormulation: string;
  diagnosticConclusion: TexlexDiagnosticConclusion;
};

function cloneCriteriaState(criteria: Record<CriterionCode, CriterionState>): Record<CriterionCode, CriterionState> {
  return Object.fromEntries(
    CRITERION_CODES.map((code) => [code, { ...criteria[code] }])
  ) as Record<CriterionCode, CriterionState>;
}

function clampCriterionRatingForPdfExport(value: unknown): 0 | 1 | 2 | 3 | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  if (r < 0 || r > 3) return null;
  return r as 0 | 1 | 2 | 3;
}

function safeMarkerCountForPdfExport(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(10_000, Math.round(n));
}

function normalizeTexlexTextForPdf(value: unknown): string {
  return stripCorruptedSciNumericTokens(pdfFieldString(value));
}

/**
 * Coerce every patient-details field to plain strings before @react-pdf render.
 * No `...details` spread — strips unknown keys from hydrated JSON that could carry stray numbers.
 */
function normalizePatientDetailsForPdf(details: PatientDetails): PatientDetails {
  const datesRaw = Array.isArray(details.assessmentDates) ? details.assessmentDates : [""];
  const dates = datesRaw.map((d) => normalizeTexlexTextForPdf(d)).filter(Boolean);

  return {
    clientName: normalizeTexlexTextForPdf(details.clientName),
    parent1: normalizeTexlexTextForPdf(details.parent1),
    parent2: normalizeTexlexTextForPdf(details.parent2),
    parent1Relationship: normalizeTexlexTextForPdf(details.parent1Relationship),
    parent2Relationship: normalizeTexlexTextForPdf(details.parent2Relationship),
    dob: normalizeTexlexTextForPdf(details.dob),
    referringPractitioner: normalizeTexlexTextForPdf(details.referringPractitioner),
    referringPractitionerType: normalizeTexlexTextForPdf(details.referringPractitionerType),
    referringPractitionerEmail: normalizeTexlexTextForPdf(details.referringPractitionerEmail),
    assessmentType: normalizeTexlexTextForPdf(details.assessmentType),
    assessmentDates: dates.length ? dates : [""],
    school: normalizeTexlexTextForPdf(details.school),
    reportDate: normalizeTexlexTextForPdf(details.reportDate),
    yearLevel: normalizeTexlexTextForPdf(details.yearLevel),
    assessor: normalizeTexlexTextForPdf(details.assessor),
    phone: normalizeTexlexTextForPdf(details.phone),
    address: normalizeTexlexTextForPdf(details.address),
    pronouns: normalizeTexlexTextForPdf(details.pronouns),
  };
}

function normalizeBackgroundForPdf(bg: BackgroundState): BackgroundState {
  const k = (s: string) => stripCorruptedSciNumericTokens(pdfFieldString(s));
  return {
    pregnancyBirthRaw: k(bg.pregnancyBirthRaw),
    pregnancyBirth: k(bg.pregnancyBirth),
    earlyDevelopmentRaw: k(bg.earlyDevelopmentRaw),
    earlyDevelopment: k(bg.earlyDevelopment),
    educationalHistoryRaw: k(bg.educationalHistoryRaw),
    educationalHistory: k(bg.educationalHistory),
    emotionalBehaviouralSensoryRaw: k(bg.emotionalBehaviouralSensoryRaw),
    emotionalBehaviouralSensory: k(bg.emotionalBehaviouralSensory),
  };
}

/** Only fields read by TexlexPdfDocument — strips lastGenerated and coerces ratings. */
function criteriaStateForPdfRenderer(
  criteria: Record<CriterionCode, CriterionState>
): Record<CriterionCode, CriterionState> {
  return Object.fromEntries(
    CRITERION_CODES.map((code) => {
      const c = criteria[code];
      return [
        code,
        {
          code,
          indicators: normalizeTexlexTextForPdf(c.indicators),
          rating: clampCriterionRatingForPdfExport(c.rating),
          suggestedRating: clampCriterionRatingForPdfExport(c.suggestedRating),
          markerCount: safeMarkerCountForPdfExport(c.markerCount),
          lastGenerated: null,
        },
      ];
    })
  ) as Record<CriterionCode, CriterionState>;
}

/** Explicit PDF-only draft: no spread from sanitized JSON (drops stray keys) and strips cliniko payload. */
function buildPdfRenderDraftFromSanitized(
  sanitised: Omit<TexlexReportDraftV1, "lastSaved" | "rawNotes" | "collateralDocs">
): Omit<TexlexReportDraftV1, "lastSaved" | "rawNotes" | "collateralDocs"> {
  return {
    patientDetails: normalizePatientDetailsForPdf(sanitised.patientDetails),
    background: normalizeBackgroundForPdf(sanitised.background),
    presentingConcernsRaw: normalizeTexlexTextForPdf(sanitised.presentingConcernsRaw),
    presentingConcerns: normalizeTexlexTextForPdf(sanitised.presentingConcerns),
    collateralSummary: normalizeTexlexTextForPdf(sanitised.collateralSummary),
    functionalImpactSummary: normalizeTexlexTextForPdf(sanitised.functionalImpactSummary),
    clinicalFormulation: normalizeTexlexTextForPdf(sanitised.clinicalFormulation),
    recommendations: normalizeTexlexTextForPdf(sanitised.recommendations),
    limitationsText: normalizeTexlexTextForPdf(sanitised.limitationsText),
    criteria: criteriaStateForPdfRenderer(sanitised.criteria),
    cliniko: null,
    diagnosticConclusion: resolveTexlexDiagnosticConclusion(sanitised.diagnosticConclusion),
  };
}

function cloneBackgroundState(background: BackgroundState): BackgroundState {
  return { ...background };
}

function buildBackgroundTextBlock(background: BackgroundState): string {
  const sections: Array<[string, string]> = [
    ["Pregnancy and birth", background.pregnancyBirth],
    ["Early development", background.earlyDevelopment],
    ["Educational history", background.educationalHistory],
    ["Emotional, behavioural and sensory", background.emotionalBehaviouralSensory],
  ];
  return sections
    .filter(([, text]) => !isTexlexSubsectionEmpty(text))
    .map(([label, text]) => `## ${label}\n${text.trim()}`)
    .join("\n\n");
}

async function streamTexlexSse(
  url: string,
  body: unknown,
  onDelta: (text: string) => void,
  abortSignal: AbortSignal
): Promise<string> {
  let assembled = "";
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: abortSignal,
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text();
    let detail = errorText.slice(0, 800);
    try {
      const j = JSON.parse(errorText) as { error?: string };
      if (typeof j.error === "string") detail = j.error;
    } catch {
      /* keep raw body */
    }
    throw new Error(`Generation failed: ${detail}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return assembled;
      try {
        const parsed = JSON.parse(data) as { delta?: string; error?: string; done?: boolean };
        if (parsed.error) throw new Error(parsed.error);
        if (typeof parsed.delta === "string" && parsed.delta.length) {
          assembled += parsed.delta;
          onDelta(parsed.delta);
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
  return assembled;
}

function buildVoiceCriticPayloadExtras(
  patientDetails: PatientDetails,
  criteriaState: Record<CriterionCode, CriterionState>,
  diagnosticConclusion: TexlexDiagnosticConclusion,
  criterionCode?: CriterionCode
): {
  patientDetails: Record<string, string>;
  diagnosticConclusion: TexlexDiagnosticConclusion;
  ratingsAssigned: Record<string, number | null>;
} {
  const chronologicalAge = computeChronologicalAge(patientDetails.dob);
  const ratingsAssigned = criterionCode
    ? { [criterionCode]: criteriaState[criterionCode]?.rating ?? null }
    : buildRatingsAssignedSnapshot(criteriaState);
  return {
    patientDetails: buildFormulationPatientDetailsForCritic(patientDetails, chronologicalAge),
    diagnosticConclusion,
    ratingsAssigned,
  };
}

function buildCriterionApiBody(
  code: CriterionCode,
  patientDetails: PatientDetails,
  rawNotesForModel: string,
  markersText: string,
  criteriaState: Record<CriterionCode, CriterionState>,
  diagnosticConclusion: TexlexDiagnosticConclusion,
  background: BackgroundState,
  functionalImpactSummary: string
): Record<string, unknown> {
  const base = {
    clientName: patientDetails.clientName,
    pronouns: patientDetails.pronouns,
    chronologicalAge: computeChronologicalAge(patientDetails.dob),
    yearLevel: patientDetails.yearLevel,
    rawNotes: rawNotesForModel,
    ...buildVoiceCriticPayloadExtras(patientDetails, criteriaState, diagnosticConclusion, code),
  };
  switch (code) {
    case "A1":
      return { ...base, a1Markers: markersText };
    case "A2":
      return { ...base, a2Markers: markersText };
    case "A3":
      return { ...base, a3Markers: markersText };
    case "B1":
      return { ...base, b1Markers: markersText };
    case "B2":
      return { ...base, b2Markers: markersText };
    case "B3":
      return { ...base, b3Markers: markersText };
    case "B4":
      return { ...base, b4Markers: markersText };
    case "C":
      return { ...base, cMarkers: markersText, background: buildBackgroundTextBlock(background) };
    case "D":
      return {
        ...base,
        dMarkers: markersText,
        functionalImpactSummary: functionalImpactSummary.trim(),
      };
    case "E":
      return { ...base, eMarkers: markersText };
    default: {
      const _exhaustive: never = code;
      return _exhaustive;
    }
  }
}

const ACCEPTED_FILE_TYPES = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/heic": [".heic"],
  "image/heif": [".heif"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/msword": [".doc"],
} as const;

const DOC_CATEGORIES = [
  "Cognitive assessment (WISC / WPPSI / WAIS)",
  "Adaptive functioning (ABAS-3 / Vineland-3)",
  "ASD-specific (ADOS-2 / ADI-R)",
  "Behaviour rating scale (BASC-3 / Conners-3)",
  "Speech and language assessment",
  "Occupational therapy / sensory assessment",
  "Academic achievement (WIAT / WJ-IV)",
  "Executive function (BRIEF)",
  "Paediatrician report",
  "GP referral",
  "Psychiatrist report",
  "School report / IEP / NCCD",
  "Teacher questionnaire",
  "Personal Health Record (Blue Book)",
  "Previous diagnostic report",
  "Other",
] as const;

const DEFAULT_DOC_CATEGORY: (typeof DOC_CATEGORIES)[number] = "Other";

const COLLATERAL_MAX_FILES = 20;
const COLLATERAL_MAX_FILE_BYTES = 25 * 1024 * 1024;
const COLLATERAL_MAX_TOTAL_BYTES = 100 * 1024 * 1024;

const ACCEPTED_MIME_TYPES = new Set<string>(Object.keys(ACCEPTED_FILE_TYPES));

const EXTENSION_TO_MIME = (() => {
  const map: Record<string, string> = {};
  for (const [mime, exts] of Object.entries(ACCEPTED_FILE_TYPES)) {
    for (const ext of exts) {
      map[ext.toLowerCase()] = mime;
    }
  }
  return map;
})();

const COLLATERAL_INPUT_ACCEPT = [
  ...Object.keys(ACCEPTED_FILE_TYPES),
  ...Object.values(ACCEPTED_FILE_TYPES).flat(),
].join(",");

type CollateralDoc = {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  category: string;
  uploadedAt: string;
  content?: string;
  pdfBase64: string | null;
  extractionStatus: "pending" | "ready" | "failed";
};

function newCollateralDocId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `doc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function migrateCollateralDocsFromStorage(raw: unknown): CollateralDoc[] {
  if (!Array.isArray(raw)) return [];
  const out: CollateralDoc[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" && o.id ? o.id : newCollateralDocId();
    if (typeof o.filename === "string" && typeof o.mimeType === "string") {
      const category =
        typeof o.category === "string" && (DOC_CATEGORIES as readonly string[]).includes(o.category)
          ? o.category
          : DEFAULT_DOC_CATEGORY;
      const extractionStatus =
        o.extractionStatus === "ready" || o.extractionStatus === "failed"
          ? o.extractionStatus
          : "pending";
      out.push({
        id,
        filename: o.filename,
        size: typeof o.size === "number" ? sanitiseExtractedNumber(o.size) ?? 0 : 0,
        mimeType: o.mimeType,
        category,
        uploadedAt: typeof o.uploadedAt === "string" ? o.uploadedAt : new Date().toISOString(),
        content: typeof o.content === "string" ? o.content : undefined,
        pdfBase64: null,
        extractionStatus,
      });
      continue;
    }
    if ("title" in o || "summary" in o) {
      const title = typeof o.title === "string" ? o.title.trim() : "";
      const content =
        typeof o.content === "string"
          ? o.content
          : typeof o.summary === "string"
            ? o.summary
            : undefined;
      out.push({
        id,
        filename: title || "Collateral document",
        size: 0,
        mimeType: "application/pdf",
        category: DEFAULT_DOC_CATEGORY,
        uploadedAt: new Date().toISOString(),
        content,
        pdfBase64: null,
        extractionStatus: "pending",
      });
    }
  }
  return out;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileTypeLabel(mimeType: string): string {
  const map: Record<string, string> = {
    "application/pdf": "PDF",
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/heic": "HEIC",
    "image/heif": "HEIF",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
    "application/msword": "DOC",
  };
  return map[mimeType] || "FILE";
}

function resolveCollateralMime(file: File): string | null {
  const t = file.type?.trim();
  if (t && ACCEPTED_MIME_TYPES.has(t)) return t;
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
  const fromExt = EXTENSION_TO_MIME[ext];
  return fromExt ?? null;
}

function sumCollateralBytes(docs: CollateralDoc[]): number {
  return docs.reduce((s, d) => s + (typeof d.size === "number" ? d.size : 0), 0);
}

function truncateFilename(name: string, max = 40): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max)}…`;
}

function CollateralDocRowIcon({ mimeType }: { mimeType: string }) {
  const label = getFileTypeLabel(mimeType);
  if (label === "PDF" || label === "DOC" || label === "DOCX") return <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />;
  if (label === "JPEG" || label === "PNG" || label === "HEIC" || label === "HEIF")
    return <Image className="size-5 shrink-0 text-muted-foreground" aria-hidden />;
  return <FileIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />;
}

function CollateralDocumentsUpload({
  collateralDocs,
  setCollateralDocs,
  touch,
  inputClass,
}: {
  collateralDocs: CollateralDoc[];
  setCollateralDocs: Dispatch<SetStateAction<CollateralDoc[]>>;
  touch: () => void;
  inputClass: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [encodingFilename, setEncodingFilename] = useState<string | null>(null);

  const encodePdfForAi = useCallback(
    async (docId: string, file: File) => {
      setEncodingFilename(file.name);
      setUploadNotice(`Preparing ${file.name} for AI summary…`);
      setUploadError(null);
      try {
        const pdfBase64 = await readFileAsBase64(file);         setCollateralDocs((list) =>
          list.map((doc) =>
            doc.id === docId
              ? { ...doc, pdfBase64, extractionStatus: "ready" as const }
              : doc
          )
        );
        setUploadNotice(`📄 ${file.name}: AI summary enabled`);
      } catch (error) {
        setCollateralDocs((list) =>
          list.map((doc) =>
            doc.id === docId ? { ...doc, pdfBase64: null, extractionStatus: "failed" as const } : doc
          )
        );
        setUploadError(
          `Could not read ${file.name} for AI summary. Add a manual summary or re-upload.`
        );
        console.error("Collateral PDF encoding failed:", error);
      } finally {
        setEncodingFilename(null);
      }
    },
    [setCollateralDocs]
  );

  const ingestFiles = useCallback(
    (fileList: File[]) => {
      touch();
      setUploadError(null);
      setUploadNotice(null);
      const files = fileList.filter((f) => f.size > 0 || f.name);
      if (files.length === 0) return;

      const additions: CollateralDoc[] = [];
      const pendingPdfReads: Array<{ id: string; file: File }> = [];
      let firstError: string | null = null;
      const setErr = (msg: string) => {
        if (!firstError) firstError = msg;
      };

      let count = 0;
      let bytes = 0;
      for (const file of files) {
        const mime = resolveCollateralMime(file);
        if (!mime) {
          setErr("This file type is not supported. Use PDF, JPG, PNG, HEIC, HEIF, DOC, or DOCX.");
          continue;
        }
        if (file.size > COLLATERAL_MAX_FILE_BYTES) {
          setErr("Each file must be 25 MB or smaller.");
          continue;
        }
        if (count >= COLLATERAL_MAX_FILES) {
          setErr("You can attach at most 20 collateral files.");
          break;
        }
        if (bytes + file.size > COLLATERAL_MAX_TOTAL_BYTES) {
          setErr("Total upload size cannot exceed 100 MB across all files.");
          break;
        }
        const id = newCollateralDocId();
        additions.push({
          id,
          filename: file.name,
          size: file.size,
          mimeType: mime,
          category: DEFAULT_DOC_CATEGORY,
          uploadedAt: new Date().toISOString(),
          pdfBase64: null,
          extractionStatus: "pending",
        });
        if (mime === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
          pendingPdfReads.push({ id, file });
        }
        count += 1;
        bytes += file.size;
      }

      if (firstError) setUploadError(firstError);
      if (additions.length === 0) return;

      setCollateralDocs((prev) => [...prev, ...additions]);

      for (const pending of pendingPdfReads) {
        void encodePdfForAi(pending.id, pending.file);
      }
    },
    [encodePdfForAi, setCollateralDocs, touch]
  );

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (list?.length) ingestFiles(Array.from(list));
    e.target.value = "";
  };

  const onDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    dragDepthRef.current = 0;
    setDragActive(false);
    if (e.dataTransfer.files?.length) ingestFiles(Array.from(e.dataTransfer.files));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Upload supporting reports and forms. PDFs are sent to Claude for AI summarisation during collateral generation. JPG, PNG, HEIC, and DOCX uploads are listed for manual summary only until a future release.
      </p>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={COLLATERAL_INPUT_ACCEPT}
        className="sr-only"
        onChange={onInputChange}
      />

      <button
        type="button"
        className={cn(
          "flex min-h-[130px] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          dragActive ? "border-primary bg-primary/5" : "border-border/80 bg-muted/20 hover:border-primary/60"
        )}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          dragDepthRef.current += 1;
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          dragDepthRef.current -= 1;
          if (dragDepthRef.current <= 0) {
            dragDepthRef.current = 0;
            setDragActive(false);
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={onDrop}
      >
        <Upload className="size-8 text-muted-foreground" aria-hidden />
        <span className="text-sm font-medium text-foreground">Drag files here or click to browse</span>
        <span className="text-xs text-muted-foreground">
          Accepted: PDF, JPG, PNG, HEIC, DOCX · Max 25 MB per file · Up to 20 files
        </span>
      </button>

      {uploadError ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {uploadError}
        </p>
      ) : null}

      {uploadNotice ? (
        <p
          className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            uploadNotice.includes("could not be parsed reliably")
              ? "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100"
              : "border-border/60 bg-muted/40 text-foreground"
          )}
          role="status"
        >
          {uploadNotice}
        </p>
      ) : null}

      {collateralDocs.length > 0 ? (
        <ul className="space-y-2">
          {collateralDocs.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-background px-3 py-2.5"
            >
              <CollateralDocRowIcon mimeType={doc.mimeType} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground" title={doc.filename}>
                  {truncateFilename(doc.filename)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(doc.size)} · {getFileTypeLabel(doc.mimeType)}
                  {encodingFilename === doc.filename ? " · Preparing…" : null}
                </p>
                <p className="text-xs text-muted-foreground">{collateralAiStatusLabel(doc)}</p>
              </div>
              <select
                className={cn(inputClass, "h-8 max-w-[min(100%,18rem)] shrink-0 py-0 text-xs sm:max-w-[22rem]")}
                value={doc.category}
                onChange={(e) => {
                  touch();
                  const category = e.target.value;
                  setCollateralDocs((list) => list.map((d) => (d.id === doc.id ? { ...d, category } : d)));
                }}
              >
                {DOC_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-muted-foreground"
                aria-label={`Remove ${doc.filename}`}
                onClick={() => {
                  touch();
                  setCollateralDocs((list) => list.filter((d) => d.id !== doc.id));
                }}
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type BackgroundSectionKey =
  | "pregnancyBirth"
  | "earlyDevelopment"
  | "educationalHistory"
  | "emotionalBehaviouralSensory";

type BackgroundState = {
  pregnancyBirthRaw: string;
  pregnancyBirth: string;
  earlyDevelopmentRaw: string;
  earlyDevelopment: string;
  educationalHistoryRaw: string;
  educationalHistory: string;
  emotionalBehaviouralSensoryRaw: string;
  emotionalBehaviouralSensory: string;
};

function emptyBackgroundState(): BackgroundState {
  return {
    pregnancyBirthRaw: "",
    pregnancyBirth: "",
    earlyDevelopmentRaw: "",
    earlyDevelopment: "",
    educationalHistoryRaw: "",
    educationalHistory: "",
    emotionalBehaviouralSensoryRaw: "",
    emotionalBehaviouralSensory: "",
  };
}

function migrateBackgroundFromStorage(raw: unknown): BackgroundState {
  const next = emptyBackgroundState();
  if (!raw || typeof raw !== "object") return next;
  const o = raw as Record<string, unknown>;
  for (const key of Object.keys(next) as (keyof BackgroundState)[]) {
    if (typeof o[key] === "string") next[key] = o[key];
  }
  return next;
}

export type TexlexReportDraftV1 = {
  engine?: "asd";
  patientDetails: PatientDetails;
  cliniko?: ClinikoDraftState | null;
  rawNotes: string;
  collateralDocs: CollateralDoc[];
  criteria: Record<CriterionCode, CriterionState>;
  presentingConcernsRaw: string;
  presentingConcerns: string;
  background: BackgroundState;
  collateralSummary: string;
  functionalImpactSummary: string;
  clinicalFormulation: string;
  recommendations: string;
  limitationsText: string;
  lastSaved: string;
  /** Clinician-set diagnostic framing for formulation + auto-rating caps. Omitted in older saves = inconclusive. */
  diagnosticConclusion?: TexlexDiagnosticConclusion;
};

const A_CRITERION_CODES = ["A1", "A2", "A3"] as const satisfies readonly CriterionCode[];
const B_CRITERION_CODES = ["B1", "B2", "B3", "B4"] as const satisfies readonly CriterionCode[];
const C_CRITERION_CODES = ["C", "D", "E"] as const satisfies readonly CriterionCode[];

function emptyCriterion(code: CriterionCode): CriterionState {
  return {
    code,
    rating: null,
    indicators: "",
    suggestedRating: null,
    markerCount: 0,
    lastGenerated: null,
  };
}

function initialCriteria(): Record<CriterionCode, CriterionState> {
  return {
    A1: emptyCriterion("A1"),
    A2: emptyCriterion("A2"),
    A3: emptyCriterion("A3"),
    B1: emptyCriterion("B1"),
    B2: emptyCriterion("B2"),
    B3: emptyCriterion("B3"),
    B4: emptyCriterion("B4"),
    C: emptyCriterion("C"),
    D: emptyCriterion("D"),
    E: emptyCriterion("E"),
  };
}

function omitLastSaved(p: TexlexReportDraftV1): Omit<TexlexReportDraftV1, "lastSaved"> {
  const { lastSaved: _ls, ...rest } = p;
  return rest;
}

/** Normalise a stored/partial draft to the same shape as `omitLastSaved(persistPayload)` for equality checks. */
function buildComparableDraftFromStorage(data: Partial<TexlexReportDraftV1>): Omit<TexlexReportDraftV1, "lastSaved"> {
  let criteriaMerged = initialCriteria();
  if (data.criteria) {
    for (const code of CRITERION_CODES) {
      const patch = data.criteria[code];
      if (patch) {
        criteriaMerged = {
          ...criteriaMerged,
          [code]: normalizeCriterionState({ ...criteriaMerged[code], ...patch, code }),
        };
      }
    }
  }

  return {
    patientDetails: data.patientDetails ? migratePatientDetails(data.patientDetails) : emptyPatientDetails(),
    cliniko: data.cliniko ?? null,
    rawNotes: typeof data.rawNotes === "string" ? data.rawNotes : "",
    collateralDocs: Array.isArray(data.collateralDocs)
      ? serialiseCollateralDocsForStorage(migrateCollateralDocsFromStorage(data.collateralDocs))
      : [],
    criteria: criteriaMerged,
    presentingConcernsRaw: typeof data.presentingConcernsRaw === "string" ? data.presentingConcernsRaw : "",
    presentingConcerns: typeof data.presentingConcerns === "string" ? data.presentingConcerns : "",
    background: data.background ? migrateBackgroundFromStorage(data.background) : emptyBackgroundState(),
    collateralSummary: typeof data.collateralSummary === "string" ? data.collateralSummary : "",
    functionalImpactSummary: typeof data.functionalImpactSummary === "string" ? data.functionalImpactSummary : "",
    clinicalFormulation: typeof data.clinicalFormulation === "string" ? data.clinicalFormulation : "",
    recommendations: typeof data.recommendations === "string" ? data.recommendations : "",
    limitationsText:
      typeof data.limitationsText === "string" ? data.limitationsText : TEXLEX_LIMITATIONS,
    diagnosticConclusion:
      data.diagnosticConclusion === "meets" ||
      data.diagnosticConclusion === "does_not_meet" ||
      data.diagnosticConclusion === "inconclusive"
        ? data.diagnosticConclusion
        : "inconclusive",
  };
}

function defaultDraft(): Omit<TexlexReportDraftV1, "lastSaved"> {
  return {
    patientDetails: emptyPatientDetails(),
    rawNotes: "",
    collateralDocs: [],
    criteria: initialCriteria(),
    presentingConcernsRaw: "",
    presentingConcerns: "",
    background: emptyBackgroundState(),
    collateralSummary: "",
    functionalImpactSummary: "",
    clinicalFormulation: "",
    recommendations: "",
    limitationsText: TEXLEX_LIMITATIONS,
    diagnosticConclusion: "inconclusive",
  };
}

function suggestedRatingFromMatrix(count: number, status: string): 0 | 1 | 2 | 3 | null {
  if (count === 0) return 0;
  if (count >= 1 && count <= 2 && status === "Partial") return 1;
  if (count >= 3 && count <= 5 && status === "Strong") return 2;
  if (count >= 6 && status === "Strong") return 3;
  return null;
}

function formatSavedAgo(iso: string | null, now: number): string {
  if (!iso) return "Not saved yet";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "Not saved yet";
  const sec = Math.max(0, Math.floor((now - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function countWords(s: string): number {
  const t = s.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function SectionCharWordCount({ text }: { text: string }) {
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      {text.length} characters · {countWords(text)} words
    </p>
  );
}

/** Max height cap (~60rem); overflow scroll only beyond cap. */
const REPORT_AUTOSIZE_MAX_PX = 60 * 16;

function autoResizeReportTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  const sh = el.scrollHeight;
  const capped = Math.min(sh, REPORT_AUTOSIZE_MAX_PX);
  el.style.height = `${capped}px`;
  el.style.overflowY = sh > REPORT_AUTOSIZE_MAX_PX ? "auto" : "hidden";
}

function ReportTextarea({
  value,
  onChange,
  rows,
  className,
  ...rest
}: Omit<ComponentProps<typeof Textarea>, "value" | "onChange"> & {
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    autoResizeReportTextarea(ref.current);
  }, [value]);

  return (
    <Textarea
      ref={ref}
      rows={rows}
      value={value}
      onChange={(e) => {
        onChange(e);
        requestAnimationFrame(() => autoResizeReportTextarea(e.currentTarget));
      }}
      className={cn("resize-none text-[15px] leading-[1.55] [field-sizing:content]", className)}
      {...rest}
    />
  );
}

const DIAGNOSTIC_CONCLUSION_FORMULATION_LABEL: Record<TexlexDiagnosticConclusion, string> = {
  meets: "Meets DSM-5-TR criteria for ASD",
  does_not_meet: "Does Not Meet",
  inconclusive: "Inconclusive — further evidence required",
};

function SectionModelHint({ modelName }: { modelName: string }) {
  return <p className="mt-1 text-xs text-muted-foreground">Draft assistant model: {modelName}</p>;
}

function GenerateRegenerateRow({
  sectionId,
  modelName,
  onGenerate,
  onRegenerate,
  generateDisabled,
  regenerateDisabled,
  generateLabel,
  topSlot,
  bottomSlot,
}: {
  sectionId: string;
  modelName: string;
  onGenerate?: () => void;
  onRegenerate?: () => void;
  generateDisabled?: boolean;
  regenerateDisabled?: boolean;
  generateLabel?: string;
  topSlot?: ReactNode;
  bottomSlot?: ReactNode;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
      {topSlot}
      <Button
        type="button"
        size="sm"
        className="bg-black text-white hover:bg-neutral-900 dark:bg-black dark:text-white dark:hover:bg-neutral-800"
        disabled={generateDisabled}
        onClick={() => {
          console.log(`Generate: ${sectionId}`);
          onGenerate?.();
        }}
      >
        {generateLabel ?? "Generate"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={regenerateDisabled}
        onClick={() => {
          console.log(`Regenerate: ${sectionId}`);
          onRegenerate?.();
        }}
      >
        Regenerate
      </Button>
      <TexlexModelPill modelName={modelName} />
      {bottomSlot}
    </div>
  );
}

function GenerateRegenerateRowDual({
  sectionId,
  generationModel,
  refinementModel,
  onGenerate,
  onRegenerate,
  generateDisabled,
  regenerateDisabled,
  generateLabel,
  topSlot,
  bottomSlot,
}: {
  sectionId: string;
  generationModel: string;
  refinementModel: string;
  onGenerate?: () => void;
  onRegenerate?: () => void;
  generateDisabled?: boolean;
  regenerateDisabled?: boolean;
  generateLabel?: string;
  topSlot?: ReactNode;
  bottomSlot?: ReactNode;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
      {topSlot}
      <Button
        type="button"
        size="sm"
        className="bg-black text-white hover:bg-neutral-900 dark:bg-black dark:text-white dark:hover:bg-neutral-800"
        disabled={generateDisabled}
        onClick={() => {
          console.log(`Generate: ${sectionId}`);
          onGenerate?.();
        }}
      >
        {generateLabel ?? "Generate"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={regenerateDisabled}
        onClick={() => {
          console.log(`Regenerate: ${sectionId}`);
          onRegenerate?.();
        }}
      >
        Regenerate
      </Button>
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <TexlexModelPill modelName={generationModel} />
        <TexlexModelPill modelName={refinementModel} />
      </span>
      {bottomSlot}
    </div>
  );
}

function CriterionCard({
  code,
  criterion,
  c,
  inputClass,
  touch,
  setCriteria,
  criterionGenerate,
}: {
  code: CriterionCode;
  criterion: (typeof TEXLEX_CRITERIA)[CriterionCode];
  c: CriterionState;
  inputClass: string;
  touch: () => void;
  setCriteria: Dispatch<SetStateAction<Record<CriterionCode, CriterionState>>>;
  criterionGenerate?: {
    onGenerate: () => void;
    onRegenerate: () => void;
    generateDisabled?: boolean;
    regenerateDisabled?: boolean;
    generateLabel?: string;
    topSlot?: ReactNode;
    bottomSlot?: ReactNode;
  };
}) {
  return (
    <Card className={TEXLEX_SECTION_CONTAINER_CLASS}>
      <CardContent className={cn(TEXLEX_SECTION_CONTENT_CLASS, "space-y-4")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">{criterion.title}</h3>
            <p className="mt-2 text-[15px] leading-[1.55] text-muted-foreground">{criterion.description}</p>
            <SectionModelHint
              modelName={`${TEXLEX_SECTION_MODELS.dsmCriterion.generation} · ${TEXLEX_SECTION_MODELS.dsmCriterion.refinement}`}
            />
          </div>
          <Badge variant="secondary" className="shrink-0">
            {c.markerCount} markers
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            Auto-suggested rating:{" "}
            <span className="font-medium text-foreground">
              {c.suggestedRating === null
                ? "—"
                : `${c.suggestedRating} (${TEXLEX_RATING_GUIDE.find((r) => r.value === c.suggestedRating)?.label ?? ""})`}
            </span>
          </span>
          <label className="flex items-center gap-2 font-medium">
            Clinician rating
            <select
              className={cn(inputClass, "h-8 min-w-[12rem] py-0")}
              value={c.rating === null ? "" : String(c.rating)}
              onChange={(e) => {
                touch();
                const v = e.target.value;
                setCriteria((prev) => ({
                  ...prev,
                  [code]: {
                    ...prev[code],
                    rating: v === "" ? null : (Number(v) as 0 | 1 | 2 | 3),
                  },
                }));
              }}
            >
              <option value="">—</option>
              {TEXLEX_RATING_GUIDE.map((r) => (
                <option key={r.value} value={String(r.value)}>
                  {r.value} — {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block space-y-1.5 text-sm font-medium">
          Indicators / evidence notes
          <ReportTextarea
            rows={6}
            value={c.indicators}
            onChange={(e) => {
              touch();
              setCriteria((prev) => ({
                ...prev,
                [code]: { ...prev[code], indicators: e.target.value },
              }));
            }}
            className="rounded-lg"
          />
          <SectionCharWordCount text={c.indicators} />
        </label>
        <GenerateRegenerateRowDual
          sectionId={`criterion-${code}`}
          generationModel={TEXLEX_SECTION_MODELS.dsmCriterion.generation}
          refinementModel={TEXLEX_SECTION_MODELS.dsmCriterion.refinement}
          onGenerate={criterionGenerate?.onGenerate}
          onRegenerate={criterionGenerate?.onRegenerate}
          generateDisabled={criterionGenerate?.generateDisabled}
          regenerateDisabled={criterionGenerate?.regenerateDisabled}
          generateLabel={criterionGenerate?.generateLabel}
          topSlot={criterionGenerate?.topSlot}
          bottomSlot={criterionGenerate?.bottomSlot}
        />
      </CardContent>
    </Card>
  );
}

export default function TexlexReportPage() {
  const base = defaultDraft();
  const [patientDetails, setPatientDetails] = useState(() => emptyPatientDetails());
  const [cliniko, setCliniko] = useState<ClinikoDraftState | null>(null);
  const [clinikoToast, setClinikoToast] = useState<string | null>(null);
  const [clinikoSyncNotice, setClinikoSyncNotice] = useState<string | null>(null);
  const [rawNotes, setRawNotes] = useState(base.rawNotes);
  const [collateralDocs, setCollateralDocs] = useState<CollateralDoc[]>(base.collateralDocs);
  const [criteria, setCriteria] = useState<Record<CriterionCode, CriterionState>>(base.criteria);
  const [presentingConcernsRaw, setPresentingConcernsRaw] = useState(base.presentingConcernsRaw);
  const [presentingConcerns, setPresentingConcerns] = useState(base.presentingConcerns);
  const [background, setBackground] = useState<BackgroundState>(base.background);
  const [collateralSummary, setCollateralSummary] = useState(base.collateralSummary);
  const [functionalImpactSummary, setFunctionalImpactSummary] = useState(base.functionalImpactSummary);
  const [clinicalFormulation, setClinicalFormulation] = useState(base.clinicalFormulation);
  const [recommendations, setRecommendations] = useState(base.recommendations);
  const [limitationsText, setLimitationsText] = useState(base.limitationsText);
  const [diagnosticConclusion, setDiagnosticConclusion] = useState<TexlexDiagnosticConclusion>(
    base.diagnosticConclusion ?? "inconclusive"
  );
  const [editLimitations, setEditLimitations] = useState(false);

  const [hydrated, setHydrated] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  /** Last successful Supabase confirmed-save — used for beforeunload dirty check. */
  const [lastCloudSavedAt, setLastCloudSavedAt] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [lastEditAt, setLastEditAt] = useState(0);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [saveToast, setSaveToast] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [clinikoSyncInProgress, setClinikoSyncInProgress] = useState(false);
  const [newReportModalOpen, setNewReportModalOpen] = useState(false);
  const [skipNewReportConfirmSession, setSkipNewReportConfirmSession] = useState(false);
  const [newReportToast, setNewReportToast] = useState(false);
  const [clinikoIntakeResetKey, setClinikoIntakeResetKey] = useState(0);
  const [localDraftRestoredNotice, setLocalDraftRestoredNotice] = useState<{
    lastSaved: string;
    storageKey: string;
  } | null>(null);
  const [draftResumePrompt, setDraftResumePrompt] = useState<{
    patientLabel: string;
    lastSavedLabel: string;
    stored: Partial<TexlexReportDraftV1>;
    activeKey: string;
  } | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const saveToastTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const clinikoToastTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const newReportToastTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const suppressAutosaveRef = useRef(false);
  const cloudResumeHandledPatientRef = useRef<string | null>(null);
  const debouncedRawNotes = useDebouncedValue(rawNotes, 400);
  const pipeline = useAsdEnginePipeline(debouncedRawNotes);

  const [generatingSectionId, setGeneratingSectionId] = useState<string | null>(null);
  const [sectionGenErrors, setSectionGenErrors] = useState<Partial<Record<string, string>>>({});
  const [voiceCriticBadgeBySection, setVoiceCriticBadgeBySection] = useState<
    Partial<Record<string, VoiceCriticBadgeKind>>
  >({});
  const [formulationTruncationWarning, setFormulationTruncationWarning] = useState<string | null>(
    null
  );

  const setSectionVoiceCriticBadge = useCallback(
    (sectionId: string, meta: VoiceCriticStreamMeta) => {
      setVoiceCriticBadgeBySection((prev) => {
        const next = { ...prev };
        if (meta.criticDisabled) next[sectionId] = "criticDisabled";
        else if (meta.criticApplied && !meta.fallbackToDraft) next[sectionId] = "criticApplied";
        else if (meta.fallbackToDraft) next[sectionId] = "fallbackToDraft";
        else delete next[sectionId];
        return next;
      });
    },
    []
  );
  const streamAbortRef = useRef<AbortController | null>(null);
  const genSessionRef = useRef(0);

  const applyLocalDraftData = useCallback((data: Partial<TexlexReportDraftV1>) => {
    if (data.patientDetails) setPatientDetails(() => migratePatientDetails(data.patientDetails));
    if ("cliniko" in data) setCliniko(data.cliniko ?? null);
    if (typeof data.rawNotes === "string") setRawNotes(data.rawNotes);
    if (Array.isArray(data.collateralDocs)) setCollateralDocs(migrateCollateralDocsFromStorage(data.collateralDocs));
    if (data.criteria) {
      setCriteria((c) => {
        const next = { ...c };
        for (const code of CRITERION_CODES) {
          const patch = data.criteria?.[code];
          if (patch) next[code] = normalizeCriterionState({ ...next[code], ...patch, code });
        }
        return next;
      });
    }
    if (typeof data.presentingConcernsRaw === "string") setPresentingConcernsRaw(data.presentingConcernsRaw);
    if (typeof data.presentingConcerns === "string") setPresentingConcerns(data.presentingConcerns);
    if (data.background) setBackground(() => migrateBackgroundFromStorage(data.background));
    if (typeof data.collateralSummary === "string") setCollateralSummary(data.collateralSummary);
    if (typeof data.functionalImpactSummary === "string") setFunctionalImpactSummary(data.functionalImpactSummary);
    if (typeof data.clinicalFormulation === "string") setClinicalFormulation(data.clinicalFormulation);
    if (typeof data.recommendations === "string") setRecommendations(data.recommendations);
    if (typeof data.limitationsText === "string") setLimitationsText(data.limitationsText);
    if (data.diagnosticConclusion === "meets" || data.diagnosticConclusion === "does_not_meet" || data.diagnosticConclusion === "inconclusive") {
      setDiagnosticConclusion(data.diagnosticConclusion);
    }
    if (typeof data.lastSaved === "string") setLastSavedAt(data.lastSaved);
  }, []);

  const a1MatrixRow = useMemo(() => {
    const m = pipeline.dsmMatrix as unknown;
    if (!Array.isArray(m)) return null;
    return (
      (m as Array<{ code: string; count?: number; status?: string; confidence?: string }>).find((r) => r.code === "A1") ??
      null
    );
  }, [pipeline.dsmMatrix]);

  const criterionEngineEvidenceAtLeast1 = useMemo(() => {
    const m = pipeline.dsmMatrix as unknown;
    if (!Array.isArray(m)) return 0;
    const rows = m as Array<{ code: string; count?: number; status?: string }>;
    let n = 0;
    for (const code of CRITERION_CODES) {
      const row = rows.find((r) => r.code === code);
      const count = sanitiseExtractedNumber(row?.count ?? 0) ?? 0;
      const status = row?.status ?? "Missing";
      const matrixRating = suggestedRatingFromMatrix(count, status);
      const merged = mergeCriterionSuggestedRating(code, criteria[code].indicators, matrixRating);
      if (merged !== null && merged >= 1) n++;
    }
    return n;
  }, [pipeline.dsmMatrix, criteria]);

  const showDiagnosticConclusionMismatch = useMemo(
    () =>
      resolveTexlexDiagnosticConclusion(diagnosticConclusion) === "does_not_meet" &&
      criterionEngineEvidenceAtLeast1 >= 4,
    [criterionEngineEvidenceAtLeast1, diagnosticConclusion]
  );

  const startCriterionGeneration = useCallback(
    async (code: CriterionCode): Promise<string | null> => {
      const sectionId = criterionSectionId(code);
      const sectionInput = criteria[code].indicators.trim();
      const masterInput = rawNotes.trim();
      const effectiveRaw = resolveGenerationRawNotes(sectionInput, masterInput);
      if (effectiveRaw.length < GENERATION_MIN_NOTES_CHARS) {
        setSectionGenErrors((p) => ({
          ...p,
          [sectionId]: GENERATION_MIN_NOTES_ERROR,
        }));
        return null;
      }

      streamAbortRef.current?.abort();
      const controller = new AbortController();
      streamAbortRef.current = controller;
      const session = ++genSessionRef.current;
      setGeneratingSectionId(sectionId);
      setSectionGenErrors((p) => {
        const next = { ...p };
        delete next[sectionId];
        return next;
      });

      const markersText = buildCriterionMarkersPayload(pipeline.markers, code);
      const effectiveConclusion = resolveTexlexDiagnosticConclusion(diagnosticConclusion);
      const body = buildCriterionApiBody(
        code,
        patientDetails,
        effectiveRaw,
        markersText,
        criteria,
        effectiveConclusion,
        background,
        functionalImpactSummary
      );

      setCriteria((prev) => ({ ...prev, [code]: { ...prev[code], indicators: "" } }));
      setVoiceCriticBadgeBySection((prev) => {
        const next = { ...prev };
        delete next[sectionId];
        return next;
      });

      let generated = "";
      try {
        generated = await streamTexlexWithCriticSse(
          `/api/generate/${code.toLowerCase()}`,
          body,
          (delta) => {
            setCriteria((prev) => ({
              ...prev,
              [code]: { ...prev[code], indicators: prev[code].indicators + delta },
            }));
          },
          (meta, finalContent) => {
            setCriteria((prev) => ({
              ...prev,
              [code]: { ...prev[code], indicators: finalContent },
            }));
            setSectionVoiceCriticBadge(sectionId, meta);
            logVoiceCriticComplete(`Criterion ${code}`, meta);
          },
          controller.signal
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return null;
        if (err instanceof Error && err.name === "AbortError") return null;
        console.error(`${code} generation error:`, err);
        if (genSessionRef.current === session) {
          setSectionGenErrors((p) => ({
            ...p,
            [sectionId]: err instanceof Error ? err.message : `${code} generation failed.`,
          }));
        }
        return null;
      } finally {
        if (genSessionRef.current === session) {
          setCriteria((prev) => {
            const current = prev[code];
            const conclusion = resolveTexlexDiagnosticConclusion(diagnosticConclusion);
            const merged = mergeCriterionSuggestedRating(
              code,
              generated || current.indicators,
              current.suggestedRating
            );
            const resolvedSuggested = capSuggestedRatingForDiagnosticConclusion(
              merged,
              conclusion,
              code
            );
            const nextCriterion = {
              ...current,
              indicators: generated || current.indicators,
              suggestedRating: resolvedSuggested,
            };
            if (code === "A2" && isInsufficientEvidenceNarrative(nextCriterion.indicators)) {
              return { ...prev, A2: { ...nextCriterion, rating: null } };
            }
            if (
              nextCriterion.rating === null &&
              resolvedSuggested !== null &&
              !isInsufficientEvidenceNarrative(nextCriterion.indicators)
            ) {
              return { ...prev, [code]: { ...nextCriterion, rating: resolvedSuggested } };
            }
            return { ...prev, [code]: nextCriterion };
          });
          setGeneratingSectionId(null);
          streamAbortRef.current = null;
        }
      }
      return generated;
    },
    [
      background,
      criteria,
      diagnosticConclusion,
      functionalImpactSummary,
      patientDetails,
      pipeline.markers,
      rawNotes,
      setSectionVoiceCriticBadge,
    ]
  );

  const handleGenerateCriterion = useCallback(
    (code: CriterionCode) => {
      const sid = criterionSectionId(code);
      if (generatingSectionId === sid) {
        streamAbortRef.current?.abort();
        return;
      }
      void startCriterionGeneration(code);
    },
    [generatingSectionId, startCriterionGeneration]
  );

  const handleRegenerateCriterion = useCallback(
    (code: CriterionCode) => {
      const sid = criterionSectionId(code);
      if (generatingSectionId === sid) return;
      void startCriterionGeneration(code);
    },
    [generatingSectionId, startCriterionGeneration]
  );

  const runPresentingConcernsStream = useCallback(async (): Promise<string | null> => {
    const sectionId = "presenting-concerns";
    const sectionInput = presentingConcernsRaw.trim();
    const masterInput = rawNotes.trim();
    const effectiveRaw = resolveGenerationRawNotes(sectionInput, masterInput);
    if (effectiveRaw.length < GENERATION_MIN_NOTES_CHARS) {
      setSectionGenErrors((p) => ({
        ...p,
        [sectionId]: GENERATION_MIN_NOTES_ERROR,
      }));
      return null;
    }
    streamAbortRef.current?.abort();
    const controller = new AbortController();
    streamAbortRef.current = controller;
    const session = ++genSessionRef.current;
    setGeneratingSectionId(sectionId);
    setSectionGenErrors((p) => {
      const n = { ...p };
      delete n[sectionId];
      return n;
    });
    setPresentingConcerns("");
    try {
      const generated = await streamTexlexSse(
        "/api/generate/presenting-concerns",
        {
          clientName: patientDetails.clientName,
          pronouns: patientDetails.pronouns,
          chronologicalAge: computeChronologicalAge(patientDetails.dob),
          yearLevel: patientDetails.yearLevel,
          rawNotes: effectiveRaw,
        },
        (delta) => setPresentingConcerns((prev) => prev + delta),
        controller.signal
      );
      return generated;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return null;
      if (err instanceof Error && err.name === "AbortError") return null;
      console.error("Presenting concerns generation error:", err);
      if (genSessionRef.current === session) {
        setSectionGenErrors((p) => ({
          ...p,
          [sectionId]: err instanceof Error ? err.message : "Presenting concerns generation failed.",
        }));
      }
      return null;
    } finally {
      if (genSessionRef.current === session) {
        setGeneratingSectionId(null);
        streamAbortRef.current = null;
      }
    }
  }, [patientDetails, presentingConcernsRaw, rawNotes]);

  const handleGeneratePresentingConcerns = useCallback(() => {
    const sectionId = "presenting-concerns";
    if (generatingSectionId === sectionId) {
      streamAbortRef.current?.abort();
      return;
    }
    void runPresentingConcernsStream();
  }, [generatingSectionId, runPresentingConcernsStream]);

  const handleRegeneratePresentingConcerns = useCallback(() => {
    if (generatingSectionId === "presenting-concerns") return;
    void runPresentingConcernsStream();
  }, [generatingSectionId, runPresentingConcernsStream]);

  const BACKGROUND_STREAM_SLUG: Record<BackgroundSectionKey, string> = {
    pregnancyBirth: "background-pregnancy-birth",
    earlyDevelopment: "background-early-development",
    educationalHistory: "background-educational-history",
    emotionalBehaviouralSensory: "background-emotional-behavioural-sensory",
  };

  const backgroundRawKey = (key: BackgroundSectionKey): keyof BackgroundState => {
    return `${key}Raw` as keyof BackgroundState;
  };

  const runBackgroundStream = useCallback(
    async (key: BackgroundSectionKey): Promise<string | null> => {
      const sectionId = BACKGROUND_STREAM_SLUG[key];
      const sectionInput = background[backgroundRawKey(key)].trim();
      const masterInput = rawNotes.trim();
      const effectiveRaw = resolveGenerationRawNotes(sectionInput, masterInput);
      if (effectiveRaw.length < GENERATION_MIN_NOTES_CHARS) {
        setSectionGenErrors((p) => ({
          ...p,
          [sectionId]: GENERATION_MIN_NOTES_ERROR,
        }));
        return null;
      }
      streamAbortRef.current?.abort();
      const controller = new AbortController();
      streamAbortRef.current = controller;
      const session = ++genSessionRef.current;
      setGeneratingSectionId(sectionId);
      setSectionGenErrors((p) => {
        const n = { ...p };
        delete n[sectionId];
        return n;
      });
      setBackground((b) => ({ ...b, [key]: "" }));
      try {
        const generated = await streamTexlexSse(
          `/api/generate/${sectionId}`,
          {
            clientName: patientDetails.clientName,
            pronouns: patientDetails.pronouns,
            chronologicalAge: computeChronologicalAge(patientDetails.dob),
            yearLevel: patientDetails.yearLevel,
            rawNotes: effectiveRaw,
          },
          (delta) => setBackground((b) => ({ ...b, [key]: b[key] + delta })),
          controller.signal
        );
        return generated;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return null;
        if (err instanceof Error && err.name === "AbortError") return null;
        console.error("Background generation error:", err);
        if (genSessionRef.current === session) {
          setSectionGenErrors((p) => ({
            ...p,
            [sectionId]: err instanceof Error ? err.message : "Background generation failed.",
          }));
        }
        return null;
      } finally {
        if (genSessionRef.current === session) {
          setGeneratingSectionId(null);
          streamAbortRef.current = null;
        }
      }
    },
    [background, patientDetails, rawNotes]
  );

  const handleGenerateBackground = useCallback(
    (key: BackgroundSectionKey) => {
      const sectionId = BACKGROUND_STREAM_SLUG[key];
      if (generatingSectionId === sectionId) {
        streamAbortRef.current?.abort();
        return;
      }
      void runBackgroundStream(key);
    },
    [generatingSectionId, runBackgroundStream]
  );

  const handleRegenerateBackground = useCallback(
    (key: BackgroundSectionKey) => {
      const sectionId = BACKGROUND_STREAM_SLUG[key];
      if (generatingSectionId === sectionId) return;
      void runBackgroundStream(key);
    },
    [generatingSectionId, runBackgroundStream]
  );

  const runCollateralSummaryStream = useCallback(async (): Promise<string | null> => {
    const sectionId = "collateral-summary";
    const collateralContent = collateralDocs.length
      ? buildCollateralManifestForApi(collateralDocs)
      : "";
    const pdfPayload = buildCollateralPdfPayload(collateralDocs);
    const hasReadyPdfs = pdfPayload.collateralPdfDocuments.length > 0;
    const masterInput = rawNotes.trim();
    if (
      !collateralContent.trim() &&
      !hasReadyPdfs &&
      masterInput.length < GENERATION_MIN_NOTES_CHARS
    ) {
      setSectionGenErrors((p) => ({
        ...p,
        [sectionId]: GENERATION_MIN_NOTES_ERROR,
      }));
      return null;
    }
    const contextNotes =
      masterInput.length >= GENERATION_MIN_NOTES_CHARS
        ? masterInput
        : collateralContent.trim().length >= GENERATION_MIN_NOTES_CHARS
          ? collateralContent
          : hasReadyPdfs
            ? collateralContent.trim() || "Collateral PDF documents attached for AI review."
            : "";
    if (contextNotes.length < GENERATION_MIN_NOTES_CHARS && !hasReadyPdfs) {
      setSectionGenErrors((p) => ({
        ...p,
        [sectionId]: GENERATION_MIN_NOTES_ERROR,
      }));
      return null;
    }
    streamAbortRef.current?.abort();
    const controller = new AbortController();
    streamAbortRef.current = controller;
    const session = ++genSessionRef.current;
    setGeneratingSectionId(sectionId);
    setSectionGenErrors((p) => {
      const n = { ...p };
      delete n[sectionId];
      return n;
    });
    setCollateralSummary("");
    setVoiceCriticBadgeBySection((prev) => {
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });
    const effectiveConclusion = resolveTexlexDiagnosticConclusion(diagnosticConclusion);
    const chronologicalAge = computeChronologicalAge(patientDetails.dob);
    try {
      const generated = await streamTexlexWithCriticSse(
        "/api/generate/collateral-summary",
        {
          clientName: patientDetails.clientName,
          pronouns: patientDetails.pronouns,
          chronologicalAge,
          yearLevel: patientDetails.yearLevel,
          rawNotes: contextNotes,
          collateralContent,
          ...pdfPayload,
          ...buildVoiceCriticPayloadExtras(patientDetails, criteria, effectiveConclusion),
        },
        (delta) => setCollateralSummary((prev) => prev + delta),
        (meta, finalContent) => {
          setCollateralSummary(finalContent);
          setSectionVoiceCriticBadge(sectionId, meta);
          logVoiceCriticComplete("Collateral summary", meta);
          if (meta.documentProcessing?.length) {
            const unsupported = meta.documentProcessing.filter((d) => d.status === "unsupported");
            const failed = meta.documentProcessing.filter((d) => d.status === "failed");
            if (unsupported.length || failed.length) {
              const parts: string[] = [];
              if (unsupported.length) {
                parts.push(
                  `${unsupported.length} file(s) not yet supported for AI summary (JPG/PNG/HEIC/DOCX)`
                );
              }
              if (failed.length) {
                parts.push(`${failed.length} PDF(s) could not be read by the model`);
              }
              console.info("[Texlex] Collateral document processing:", meta.documentProcessing);
            }
          }
        },
        controller.signal
      );
      return generated;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return null;
      if (err instanceof Error && err.name === "AbortError") return null;
      console.error("Collateral summary generation error:", err);
      if (genSessionRef.current === session) {
        setSectionGenErrors((p) => ({
          ...p,
          [sectionId]: err instanceof Error ? err.message : "Collateral summary generation failed.",
        }));
      }
      return null;
    } finally {
      if (genSessionRef.current === session) {
        setGeneratingSectionId(null);
        streamAbortRef.current = null;
      }
    }
  }, [collateralDocs, criteria, diagnosticConclusion, patientDetails, rawNotes, setSectionVoiceCriticBadge]);

  const handleGenerateCollateralSummary = useCallback(() => {
    const sectionId = "collateral-summary";
    if (generatingSectionId === sectionId) {
      streamAbortRef.current?.abort();
      return;
    }
    void runCollateralSummaryStream();
  }, [generatingSectionId, runCollateralSummaryStream]);

  const handleRegenerateCollateralSummary = useCallback(() => {
    if (generatingSectionId === "collateral-summary") return;
    void runCollateralSummaryStream();
  }, [generatingSectionId, runCollateralSummaryStream]);

  const runFunctionalImpactStream = useCallback(
    async (snapshot?: ReportGenerationSnapshot): Promise<string | null> => {
      const sectionId = "functional-impact-summary";
      const masterInput = rawNotes.trim();
      if (masterInput.length < GENERATION_MIN_NOTES_CHARS) {
        setSectionGenErrors((p) => ({
          ...p,
          [sectionId]: GENERATION_MIN_NOTES_ERROR,
        }));
        return null;
      }
      const source = snapshot ?? {
        presentingConcerns,
        background,
        collateralSummary,
        criteria,
        clinicalFormulation,
        diagnosticConclusion: resolveTexlexDiagnosticConclusion(diagnosticConclusion),
      };
      streamAbortRef.current?.abort();
      const controller = new AbortController();
      streamAbortRef.current = controller;
      const session = ++genSessionRef.current;
      setGeneratingSectionId(sectionId);
      setSectionGenErrors((p) => {
        const n = { ...p };
        delete n[sectionId];
        return n;
      });
      setFunctionalImpactSummary("");
      setVoiceCriticBadgeBySection((prev) => {
        const next = { ...prev };
        delete next[sectionId];
        return next;
      });
      const criteriaState = buildCriteriaStateBlock(source.criteria);
      const backgroundText = buildBackgroundTextBlock(source.background);
      const effectiveConclusion = resolveTexlexDiagnosticConclusion(source.diagnosticConclusion);
      const chronologicalAge = computeChronologicalAge(patientDetails.dob);
      const payload = {
        clientName: patientDetails.clientName,
        clientFirstName: clientFirstName(patientDetails.clientName),
        pronouns: patientDetails.pronouns,
        chronologicalAge,
        yearLevel: patientDetails.yearLevel,
        school: patientDetails.school,
        rawNotes: masterInput,
        presentingConcerns: source.presentingConcerns.trim(),
        backgroundText,
        criteriaState,
        collateralSummary: source.collateralSummary.trim(),
        clinicalFormulation: source.clinicalFormulation.trim(),
        ...buildVoiceCriticPayloadExtras(patientDetails, source.criteria, effectiveConclusion),
      };
      const payloadPreview = JSON.stringify(payload);
      console.log(
        `FUNCTIONAL_IMPACT: prompt input received: ${payloadPreview.length} chars`,
        payloadPreview.slice(0, 500)
      );
      try {
        const generated = await streamTexlexWithCriticSse(
          "/api/generate/functional-impact",
          payload,
          (delta) => setFunctionalImpactSummary((prev) => prev + delta),
          (meta, finalContent) => {
            setFunctionalImpactSummary(finalContent);
            setSectionVoiceCriticBadge(sectionId, meta);
            logVoiceCriticComplete("Functional Impact", meta);
          },
          controller.signal
        );
        console.log(
          `FUNCTIONAL_IMPACT: model response received: ${generated.length} chars`,
          generated.slice(0, 500)
        );
        if (genSessionRef.current === session) {
          if (isTexlexSubsectionEmpty(generated)) {
            throw new Error("Functional impact model returned no prose");
          }
          setFunctionalImpactSummary(generated);
          console.log(
            `FUNCTIONAL_IMPACT: returning to renderer: ${generated.length} chars`,
            generated.slice(0, 500)
          );
        }
        return generated;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return null;
        if (err instanceof Error && err.name === "AbortError") return null;
        console.error("Functional impact generation error:", err);
        if (genSessionRef.current === session) {
          setFunctionalImpactSummary(FUNCTIONAL_IMPACT_RENDER_FALLBACK);
          setSectionGenErrors((p) => ({
            ...p,
            [sectionId]: err instanceof Error ? err.message : "Functional impact generation failed.",
          }));
        }
        return null;
      } finally {
        if (genSessionRef.current === session) {
          setGeneratingSectionId(null);
          streamAbortRef.current = null;
        }
      }
    },
    [
      background,
      clinicalFormulation,
      collateralSummary,
      criteria,
      diagnosticConclusion,
      patientDetails,
      presentingConcerns,
      rawNotes,
      setSectionVoiceCriticBadge,
    ]
  );

  const handleGenerateFunctionalImpact = useCallback(() => {
    const sectionId = "functional-impact-summary";
    if (generatingSectionId === sectionId) {
      streamAbortRef.current?.abort();
      return;
    }
    void runFunctionalImpactStream();
  }, [generatingSectionId, runFunctionalImpactStream]);

  const handleRegenerateFunctionalImpact = useCallback(() => {
    if (generatingSectionId === "functional-impact-summary") return;
    void runFunctionalImpactStream();
  }, [generatingSectionId, runFunctionalImpactStream]);

  const runFormulationStream = useCallback(
    async (snapshot?: ReportGenerationSnapshot): Promise<string | null> => {
    const sectionId = "clinical-formulation";
    const masterInput = rawNotes.trim();
    if (masterInput.length < GENERATION_MIN_NOTES_CHARS) {
      setSectionGenErrors((p) => ({
        ...p,
        [sectionId]: GENERATION_MIN_NOTES_ERROR,
      }));
      return null;
    }
    const source = snapshot ?? {
      presentingConcerns,
      background,
      collateralSummary,
      criteria,
      clinicalFormulation,
      diagnosticConclusion: resolveTexlexDiagnosticConclusion(diagnosticConclusion),
    };
    const effectiveConclusion = resolveTexlexDiagnosticConclusion(source.diagnosticConclusion);
    const criteriaLock = criteriaSnapshotForFormulationLock(source.criteria);
    const los = pipeline.levelOfSupport;
    // Use engine when determinable; otherwise fall back to clinician-set criterion ratings.
    const engineDetermined = Boolean(los?.determinable) && los?.levelA != null && los?.levelB != null;
    const fallback = engineDetermined ? null : deriveLevelsFromCriterionRatings(source.criteria);
    const resolvedLevelA = engineDetermined ? (los?.levelA ?? null) : (fallback?.levelA ?? null);
    const resolvedLevelB = engineDetermined ? (los?.levelB ?? null) : (fallback?.levelB ?? null);
    const resolvedDeterminable = engineDetermined || Boolean(fallback?.determinable);

    if (effectiveConclusion === "meets" && (!resolvedDeterminable || resolvedLevelA == null || resolvedLevelB == null)) {
      setSectionGenErrors((p) => ({
        ...p,
        [sectionId]:
          "Cannot generate formulation: diagnostic conclusion is 'meets' but Level A and/or Level B cannot be determined. Set criterion ratings (rating 1–3) for at least one A criterion and one B criterion.",
      }));
      return null;
    }
    const lockedOpening = buildLockedFormulationOpening({
      conclusion: effectiveConclusion,
      clientName: patientDetails.clientName,
      criteria: criteriaLock,
      levelA: resolvedLevelA,
      levelB: resolvedLevelB,
      determinable: resolvedDeterminable,
    });
    streamAbortRef.current?.abort();
    const controller = new AbortController();
    streamAbortRef.current = controller;
    const session = ++genSessionRef.current;
    setGeneratingSectionId(sectionId);
    setSectionGenErrors((p) => {
      const n = { ...p };
      delete n[sectionId];
      return n;
    });
    setClinicalFormulation("");
    setVoiceCriticBadgeBySection((prev) => {
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });
    setFormulationTruncationWarning(null);
    const criteriaState = buildCriteriaStateBlock(source.criteria);
    const chronologicalAge = computeChronologicalAge(patientDetails.dob);
    try {
      const generated = await streamTexlexWithCriticSse(
        "/api/generate/formulation",
        {
          clientName: patientDetails.clientName,
          pronouns: patientDetails.pronouns,
          chronologicalAge,
          yearLevel: patientDetails.yearLevel,
          referringPractitioner: patientDetails.referringPractitioner,
          referringPractitionerType: patientDetails.referringPractitionerType,
          school: patientDetails.school,
          rawNotes: masterInput,
          criteriaState,
          collateralSummary: source.collateralSummary.trim(),
          functionalImpactSummary: functionalImpactSummary.trim(),
          diagnosticConclusion: effectiveConclusion,
          lockedFormulationOpening: lockedOpening,
          overallLevel: resolvedDeterminable && resolvedLevelA != null && resolvedLevelB != null
            ? Math.max(resolvedLevelA, resolvedLevelB)
            : (pipeline.levelOfSupport?.overallLevel ?? null),
          levelA: resolvedLevelA,
          levelB: resolvedLevelB,
          determinable: resolvedDeterminable,
          patientDetails: buildFormulationPatientDetailsForCritic(patientDetails, chronologicalAge),
          ratingsAssigned: buildRatingsAssignedSnapshot(source.criteria),
        },
        (delta) => setClinicalFormulation((prev) => prev + delta),
        (meta, finalContent) => {
          setClinicalFormulation(finalContent);
          setSectionVoiceCriticBadge(sectionId, meta);
          setFormulationTruncationWarning(meta.truncationWarning);
          logVoiceCriticComplete("Formulation", meta);
        },
        controller.signal
      );
      return generated;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return null;
      if (err instanceof Error && err.name === "AbortError") return null;
      console.error("Formulation generation error:", err);
      if (genSessionRef.current === session) {
        setSectionGenErrors((p) => ({
          ...p,
          [sectionId]: err instanceof Error ? err.message : "Formulation generation failed.",
        }));
      }
      return null;
    } finally {
      if (genSessionRef.current === session) {
        setGeneratingSectionId(null);
        streamAbortRef.current = null;
      }
    }
  },
    [
      background,
      collateralSummary,
      criteria,
      diagnosticConclusion,
      functionalImpactSummary,
      patientDetails,
      pipeline.levelOfSupport,
      presentingConcerns,
      rawNotes,
      setSectionVoiceCriticBadge,
    ]
  );

  const handleGenerateFormulation = useCallback(() => {
    const sectionId = "clinical-formulation";
    if (generatingSectionId === sectionId) {
      streamAbortRef.current?.abort();
      return;
    }
    void runFormulationStream();
  }, [generatingSectionId, runFormulationStream]);

  const handleRegenerateFormulation = useCallback(() => {
    if (generatingSectionId === "clinical-formulation") return;
    void runFormulationStream();
  }, [generatingSectionId, runFormulationStream]);

  const runRecommendationsStream = useCallback(async () => {
    const sectionId = "recommendations";
    const masterInput = rawNotes.trim();
    if (masterInput.length < GENERATION_MIN_NOTES_CHARS) {
      setSectionGenErrors((p) => ({
        ...p,
        [sectionId]: GENERATION_MIN_NOTES_ERROR,
      }));
      return;
    }
    streamAbortRef.current?.abort();
    const controller = new AbortController();
    streamAbortRef.current = controller;
    const session = ++genSessionRef.current;
    setGeneratingSectionId(sectionId);
    setSectionGenErrors((p) => {
      const n = { ...p };
      delete n[sectionId];
      return n;
    });
    setRecommendations("");
    setVoiceCriticBadgeBySection((prev) => {
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });
    const criteriaState = buildCriteriaStateBlock(criteria);
    const effectiveConclusion = resolveTexlexDiagnosticConclusion(diagnosticConclusion);
    const chronologicalAge = computeChronologicalAge(patientDetails.dob);
    try {
      await streamTexlexWithCriticSse(
        "/api/generate/recommendations",
        {
          clientName: patientDetails.clientName,
          pronouns: patientDetails.pronouns,
          chronologicalAge,
          yearLevel: patientDetails.yearLevel,
          referringPractitioner: patientDetails.referringPractitioner,
          referringPractitionerType: patientDetails.referringPractitionerType,
          school: patientDetails.school,
          rawNotes: masterInput,
          criteriaState,
          formulation: clinicalFormulation.trim(),
          functionalImpactSummary: functionalImpactSummary.trim(),
          ...buildVoiceCriticPayloadExtras(patientDetails, criteria, effectiveConclusion),
        },
        (delta) => setRecommendations((prev) => prev + delta),
        (meta, finalContent) => {
          setRecommendations(finalContent);
          setSectionVoiceCriticBadge(sectionId, meta);
          logVoiceCriticComplete("Recommendations", meta);
        },
        controller.signal
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("Recommendations generation error:", err);
      if (genSessionRef.current === session) {
        setSectionGenErrors((p) => ({
          ...p,
          [sectionId]: err instanceof Error ? err.message : "Recommendations generation failed.",
        }));
      }
    } finally {
      if (genSessionRef.current === session) {
        setGeneratingSectionId(null);
        streamAbortRef.current = null;
      }
    }
  }, [
    clinicalFormulation,
    criteria,
    diagnosticConclusion,
    functionalImpactSummary,
    patientDetails,
    rawNotes,
    setSectionVoiceCriticBadge,
  ]);

  const handleGenerateRecommendations = useCallback(() => {
    const sectionId = "recommendations";
    if (generatingSectionId === sectionId) {
      streamAbortRef.current?.abort();
      return;
    }
    void runRecommendationsStream();
  }, [generatingSectionId, runRecommendationsStream]);

  const handleRegenerateRecommendations = useCallback(() => {
    if (generatingSectionId === "recommendations") return;
    void runRecommendationsStream();
  }, [generatingSectionId, runRecommendationsStream]);

  const runFullReportGeneration = useCallback(async () => {
    const masterInput = rawNotes.trim();
    if (masterInput.length < GENERATION_MIN_NOTES_CHARS) {
      setSectionGenErrors((p) => ({
        ...p,
        "report-generation": GENERATION_MIN_NOTES_ERROR,
      }));
      return;
    }

    setSectionGenErrors((p) => {
      const next = { ...p };
      delete next["report-generation"];
      return next;
    });

    try {
      const snapshot: ReportGenerationSnapshot = {
        presentingConcerns,
        background: cloneBackgroundState(background),
        collateralSummary,
        criteria: cloneCriteriaState(criteria),
        clinicalFormulation,
        diagnosticConclusion: resolveTexlexDiagnosticConclusion(diagnosticConclusion),
      };

      const presentingGenerated = await runPresentingConcernsStream();
      if (presentingGenerated) snapshot.presentingConcerns = presentingGenerated;

      const backgroundKeys: BackgroundSectionKey[] = [
        "pregnancyBirth",
        "earlyDevelopment",
        "educationalHistory",
        "emotionalBehaviouralSensory",
      ];
      for (const key of backgroundKeys) {
        const generated = await runBackgroundStream(key);
        if (generated) snapshot.background[key] = generated;
      }

      const collateralGenerated = await runCollateralSummaryStream();
      if (collateralGenerated) snapshot.collateralSummary = collateralGenerated;

      const applyCriterionNarrative = async (code: CriterionCode) => {
        const narrative = await startCriterionGeneration(code);
        if (!narrative) return;
        const resolvedSuggested = capSuggestedRatingForDiagnosticConclusion(
          mergeCriterionSuggestedRating(code, narrative, snapshot.criteria[code].suggestedRating),
          snapshot.diagnosticConclusion,
          code
        );
        snapshot.criteria[code] = {
          ...snapshot.criteria[code],
          indicators: narrative,
          suggestedRating: resolvedSuggested,
          rating: snapshot.criteria[code].rating ?? resolvedSuggested,
        };
      };

      for (const code of [...A_CRITERION_CODES, ...B_CRITERION_CODES]) {
        await applyCriterionNarrative(code);
      }

      const functionalImpactGenerated = await runFunctionalImpactStream(snapshot);
      if (!functionalImpactGenerated) {
        throw new Error("Functional impact generation did not return prose");
      }

      for (const code of C_CRITERION_CODES) {
        await applyCriterionNarrative(code);
      }

      const formulationGenerated = await runFormulationStream(snapshot);
      if (formulationGenerated) snapshot.clinicalFormulation = formulationGenerated;

      await runRecommendationsStream();
    } catch (err) {
      console.error("Full report generation error:", err);
      setSectionGenErrors((p) => ({
        ...p,
        "report-generation": err instanceof Error ? err.message : "Full report generation failed.",
      }));
    }
  }, [
    rawNotes,
    runBackgroundStream,
    runCollateralSummaryStream,
    runFormulationStream,
    runFunctionalImpactStream,
    runPresentingConcernsStream,
    runRecommendationsStream,
    startCriterionGeneration,
    diagnosticConclusion,
  ]);

  const handleGenerateReport = useCallback(() => {
    if (generatingSectionId) {
      streamAbortRef.current?.abort();
      return;
    }
    void runFullReportGeneration();
  }, [generatingSectionId, runFullReportGeneration]);

  const getCriterionGenerateProps = useCallback(
    (code: CriterionCode) => {
      const sid = criterionSectionId(code);
      const active = generatingSectionId === sid;
      return {
        onGenerate: () => handleGenerateCriterion(code),
        onRegenerate: () => handleRegenerateCriterion(code),
        regenerateDisabled: active,
        generateLabel: active ? ("Stop" as const) : ("Generate" as const),
        topSlot: active ? (
          <span className="inline-flex w-full basis-full items-center gap-1.5 text-xs text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            Generating…
          </span>
        ) : undefined,
        bottomSlot: (
          <>
            <VoiceCriticBadge kind={voiceCriticBadgeBySection[sid] ?? null} />
            {sectionGenErrors[sid] ? (
              <p className="mt-2 w-full basis-full text-sm text-destructive" role="alert">
                {sectionGenErrors[sid]}
              </p>
            ) : null}
            {code === "A1" && a1MatrixRow ? (
              <p className="mt-2 w-full basis-full text-xs text-muted-foreground">
                Engine advisory: {a1MatrixRow.count ?? 0} A1 markers · {String(a1MatrixRow.status ?? "—")} pattern ·{" "}
                {String(a1MatrixRow.confidence ?? "—")} detector confidence
              </p>
            ) : null}
          </>
        ),
      };
    },
    [
      a1MatrixRow,
      generatingSectionId,
      handleGenerateCriterion,
      handleRegenerateCriterion,
      sectionGenErrors,
      voiceCriticBadgeBySection,
    ]
  );

  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
    };
  }, []);

  const touch = useCallback(() => {
    setLastEditAt(Date.now());
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    return () => {
      if (saveToastTimerRef.current) clearTimeout(saveToastTimerRef.current);
      if (clinikoToastTimerRef.current) clearTimeout(clinikoToastTimerRef.current);
      if (newReportToastTimerRef.current) clearTimeout(newReportToastTimerRef.current);
    };
  }, []);

  const showClinikoLoadedToast = useCallback((message: string) => {
    setClinikoToast(message);
    if (clinikoToastTimerRef.current) clearTimeout(clinikoToastTimerRef.current);
    clinikoToastTimerRef.current = globalThis.setTimeout(() => {
      setClinikoToast(null);
      clinikoToastTimerRef.current = null;
    }, 3000);
  }, []);

  const showClinikoErrorToast = useCallback((message: string) => {
    setClinikoToast(message);
    if (clinikoToastTimerRef.current) clearTimeout(clinikoToastTimerRef.current);
    clinikoToastTimerRef.current = globalThis.setTimeout(() => {
      setClinikoToast(null);
      clinikoToastTimerRef.current = null;
    }, 4000);
  }, []);

  useEffect(() => {
    migrateAsdLegacyLocalDrafts();
    const activeKey =
      readEngineActiveDraftKey("asd") ?? engineLocalDraftKey("asd", null);
    const draft = readLocalEngineDraft<Partial<TexlexReportDraftV1>>(activeKey);
    if (draft && draftMatchesStorageKey("asd", activeKey, draft)) {
      const comparable = buildComparableDraftFromStorage(draft);
      if (!isTexlexDraftEffectivelyEmpty(comparable)) {
        suppressAutosaveRef.current = true;
        applyLocalDraftData(draft);
        // Local restore is not a Supabase confirmed-save — keep tab-close warning armed.
        setLastEditAt(Date.now());
        setLocalDraftRestoredNotice({
          lastSaved: draft.lastSaved ?? new Date().toISOString(),
          storageKey: activeKey,
        });
        if (draft.cliniko?.patientId) {
          cloudResumeHandledPatientRef.current = draft.cliniko.patientId;
        }
      }
    }
    setHydrated(true);
  }, [applyLocalDraftData]);

  useEffect(() => {
    const conclusion = resolveTexlexDiagnosticConclusion(diagnosticConclusion);
    setCriteria((prev) => {
      const next = { ...prev };
      for (const code of CRITERION_CODES) {
        const row = pipeline.dsmMatrix.find((r: { code: string }) => r.code === code) as
          | { count: number; status: string }
          | undefined;
        const count = sanitiseExtractedNumber(row?.count ?? 0) ?? 0;
        const status = row?.status ?? "Missing";
        const matrixRating = suggestedRatingFromMatrix(count, status);
        const merged = mergeCriterionSuggestedRating(code, prev[code].indicators, matrixRating);
        const capped = capSuggestedRatingForDiagnosticConclusion(merged, conclusion, code);
        next[code] = {
          ...prev[code],
          markerCount: count,
          suggestedRating: capped,
        };
      }
      return next;
    });
  }, [pipeline.dsmMatrix, diagnosticConclusion]);

  const persistPayload = useMemo((): TexlexReportDraftV1 => {
    const lastSaved = new Date().toISOString();
    return {
      engine: "asd",
      patientDetails,
      cliniko,
      rawNotes,
      collateralDocs: serialiseCollateralDocsForStorage(collateralDocs),
      criteria,
      presentingConcernsRaw,
      presentingConcerns,
      background,
      collateralSummary,
      functionalImpactSummary,
      clinicalFormulation,
      recommendations,
      limitationsText,
      lastSaved,
      diagnosticConclusion: resolveTexlexDiagnosticConclusion(diagnosticConclusion),
    };
  }, [
    patientDetails,
    cliniko,
    rawNotes,
    collateralDocs,
    criteria,
    presentingConcernsRaw,
    presentingConcerns,
    background,
    collateralSummary,
    functionalImpactSummary,
    clinicalFormulation,
    recommendations,
    limitationsText,
    diagnosticConclusion,
  ]);

  const draftIsEffectivelyEmpty = useMemo(
    () =>
      isTexlexDraftEffectivelyEmpty({
        patientDetails,
        rawNotes,
        collateralDocs,
        criteria,
        presentingConcernsRaw,
        presentingConcerns,
        background,
        collateralSummary,
        functionalImpactSummary,
        clinicalFormulation,
        recommendations,
        limitationsText,
        cliniko,
        diagnosticConclusion,
      }),
    [
      patientDetails,
      rawNotes,
      collateralDocs,
      criteria,
      presentingConcernsRaw,
      presentingConcerns,
      background,
      collateralSummary,
      functionalImpactSummary,
      clinicalFormulation,
      recommendations,
      limitationsText,
      cliniko,
      diagnosticConclusion,
    ]
  );

  const asdClinicalSnapshotRef = useRef({
    rawNotes,
    collateralDocs,
    criteria,
    presentingConcernsRaw,
    presentingConcerns,
    background,
    collateralSummary,
    functionalImpactSummary,
    clinicalFormulation,
    recommendations,
    limitationsText,
    diagnosticConclusion,
  });
  asdClinicalSnapshotRef.current = {
    rawNotes,
    collateralDocs,
    criteria,
    presentingConcernsRaw,
    presentingConcerns,
    background,
    collateralSummary,
    functionalImpactSummary,
    clinicalFormulation,
    recommendations,
    limitationsText,
    diagnosticConclusion,
  };

  // Supabase resume only when a Cliniko patient is linked and no matching local draft was restored.
  useEffect(() => {
    if (!hydrated) return;
    const patientId = cliniko?.patientId;
    if (!patientId) {
      setDraftResumePrompt(null);
      return;
    }
    if (cloudResumeHandledPatientRef.current === patientId) return;

    const localKey = engineLocalDraftKey("asd", patientId);
    const localDraft = readLocalEngineDraft<Partial<TexlexReportDraftV1>>(localKey);
    if (
      localDraft &&
      draftMatchesStorageKey("asd", localKey, localDraft) &&
      !isTexlexDraftEffectivelyEmpty(buildComparableDraftFromStorage(localDraft))
    ) {
      // Restore patient local draft only when clinical UI is still empty (never overwrite in-progress notes).
      if (!texlexHasClinicalWorkingContent(asdClinicalSnapshotRef.current)) {
        suppressAutosaveRef.current = true;
        applyLocalDraftData(localDraft);
        setLocalDraftRestoredNotice({
          lastSaved: localDraft.lastSaved ?? new Date().toISOString(),
          storageKey: localKey,
        });
      }
      cloudResumeHandledPatientRef.current = patientId;
      return;
    }

    let cancelled = false;
    void (async () => {
      const remote = await fetchReportStateFromSupabase(patientId);
      if (cancelled) return;
      cloudResumeHandledPatientRef.current = patientId;
      if (!remote) return;
      const patientLabel =
        patientDetails.clientName.trim() || cliniko?.connectedName?.trim() || "this patient";
      const lastSavedLabel =
        typeof remote.lastSaved === "string"
          ? formatSavedAgo(remote.lastSaved, Date.now())
          : "saved in Cliniko/cloud";
      setDraftResumePrompt({
        patientLabel,
        lastSavedLabel,
        stored: remote,
        activeKey: localKey,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    applyLocalDraftData,
    cliniko?.connectedName,
    cliniko?.patientId,
    hydrated,
    patientDetails.clientName,
  ]);

  const startNewReport = useCallback(() => {
    streamAbortRef.current?.abort();
    genSessionRef.current += 1;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const patientId = cliniko?.patientId ?? null;
    clearLocalEngineDraft(engineLocalDraftKey("asd", patientId));
    clearLocalEngineDraft(engineLocalDraftKey("asd", null));
    clearEngineActiveDraftPointer("asd");
    clearAsdLegacyLocalDraftKeys(patientId, patientDetails.clientName);
    suppressAutosaveRef.current = true;
    cloudResumeHandledPatientRef.current = null;

    setDraftResumePrompt(null);
    setLocalDraftRestoredNotice(null);

    const fresh = defaultDraft();
    setPatientDetails(patientDetailsAfterNewReport());
    setCliniko(null);
    setClinikoIntakeResetKey((key) => key + 1);
    setClinikoToast(null);
    setClinikoSyncNotice(null);
    setRawNotes(fresh.rawNotes);
    setCollateralDocs(fresh.collateralDocs);
    setCriteria(fresh.criteria);
    setPresentingConcernsRaw(fresh.presentingConcernsRaw);
    setPresentingConcerns(fresh.presentingConcerns);
    setBackground(fresh.background);
    setCollateralSummary(fresh.collateralSummary);
    setFunctionalImpactSummary(fresh.functionalImpactSummary);
    setClinicalFormulation(fresh.clinicalFormulation);
    setRecommendations(fresh.recommendations);
    setLimitationsText(fresh.limitationsText);
    setDiagnosticConclusion(fresh.diagnosticConclusion ?? "inconclusive");
    setEditLimitations(false);
    setGeneratingSectionId(null);
    setSectionGenErrors({});
    setLastSavedAt(null);
    setLastCloudSavedAt(null);
    setSaveFailed(false);
    setSaveToast(false);
    setLastEditAt(0);
    window.scrollTo({ top: 0, behavior: "auto" });
    setNewReportToast(true);
    if (newReportToastTimerRef.current) clearTimeout(newReportToastTimerRef.current);
    newReportToastTimerRef.current = globalThis.setTimeout(() => {
      setNewReportToast(false);
      newReportToastTimerRef.current = null;
    }, 2000);
  }, [cliniko, patientDetails]);

  const handleNewReportClick = useCallback(() => {
    if (pdfDownloading) return;
    if (draftIsEffectivelyEmpty) {
      startNewReport();
      return;
    }
    if (skipNewReportConfirmSession && !clinikoSyncInProgress) {
      startNewReport();
      return;
    }
    setNewReportModalOpen(true);
  }, [clinikoSyncInProgress, draftIsEffectivelyEmpty, pdfDownloading, skipNewReportConfirmSession, startNewReport]);

  const handleConfirmNewReport = useCallback(() => {
    if (clinikoSyncInProgress) return;
    startNewReport();
    setNewReportModalOpen(false);
  }, [clinikoSyncInProgress, startNewReport]);

  const saveDraftNow = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const activeKey = engineLocalDraftKey(
      "asd",
      persistPayload.cliniko?.patientId ?? null
    );
    try {
      const payload = { ...persistPayload, lastSaved: new Date().toISOString() };
      if (draftMatchesStorageKey("asd", activeKey, payload)) {
        const written = writeLocalEngineDraft("asd", activeKey, payload);
        if (written.ok) {
          setLastSavedAt(written.lastSaved);
          if (payload.cliniko?.patientId) {
            clearLocalEngineDraft(engineLocalDraftKey("asd", null));
          }
        }
      }
      const uploaded = await uploadStateToCliniko(payload);
      if (!uploaded) {
        // Local safety-net still saved; only fail the confirmed cloud path when linked.
        if (payload.cliniko?.patientId) {
          setSaveFailed(true);
          return;
        }
        setSaveFailed(false);
        setSaveToast(true);
        if (saveToastTimerRef.current) clearTimeout(saveToastTimerRef.current);
        saveToastTimerRef.current = globalThis.setTimeout(() => {
          setSaveToast(false);
          saveToastTimerRef.current = null;
        }, 2000);
        return;
      }
      setLastCloudSavedAt(payload.lastSaved);
      setSaveFailed(false);
      setSaveToast(true);
      if (saveToastTimerRef.current) clearTimeout(saveToastTimerRef.current);
      saveToastTimerRef.current = globalThis.setTimeout(() => {
        setSaveToast(false);
        saveToastTimerRef.current = null;
      }, 2000);
    } catch {
      setSaveFailed(true);
    }
  }, [persistPayload]);

  const handleDownloadPdf = useCallback(async () => {
    setPdfDownloading(true);
    setClinikoSyncNotice(null);
    if (cliniko?.patientId && cliniko.syncEnabled) {
      setClinikoSyncInProgress(true);
      try {
        const response = await fetch("/api/cliniko/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId: cliniko.patientId,
            baseline: cliniko.baseline,
            patientDetails: {
              clientName: patientDetails.clientName,
              parent1: patientDetails.parent1,
              parent2: patientDetails.parent2,
              parent1Relationship: patientDetails.parent1Relationship,
              parent2Relationship: patientDetails.parent2Relationship,
              dob: patientDetails.dob,
              referringPractitioner: patientDetails.referringPractitioner,
              referringPractitionerType: patientDetails.referringPractitionerType,
              referringPractitionerEmail: patientDetails.referringPractitionerEmail,
              assessmentType: patientDetails.assessmentType,
              school: patientDetails.school,
              yearLevel: patientDetails.yearLevel,
              phone: patientDetails.phone,
              address: patientDetails.address,
            },
          }),
        });
        const data = (await response.json()) as { updatedCount?: number; error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "Cliniko sync failed.");
        }
        if ((data.updatedCount ?? 0) > 0) {
          setClinikoSyncNotice(`Updated ${data.updatedCount} field(s) in Cliniko`);
        }
      } catch (error) {
        console.error("Cliniko sync failed:", error);
        setClinikoToast("Couldn't sync to Cliniko — your changes are still in the report.");
        if (clinikoToastTimerRef.current) clearTimeout(clinikoToastTimerRef.current);
        clinikoToastTimerRef.current = globalThis.setTimeout(() => {
          setClinikoToast(null);
          clinikoToastTimerRef.current = null;
        }, 4000);
      } finally {
        setClinikoSyncInProgress(false);
      }
    }
    try {
      const [{ pdf }, { TexlexPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./pdf/TexlexPdfDocument"),
      ]);
      const { lastSaved: _lastSaved, rawNotes: _rawNotes, collateralDocs: _collateralDocs, ...draft } =
        persistPayload;
      const sanitised = sanitiseForPdf(draft);
      const cleanDraft = buildPdfRenderDraftFromSanitized(sanitised);
      const logoSrc = resolveTexlexPublicAsset(TEXLEX_LOGO_PATH);
      let signatureSrc = await resolveTexlexSignatureSrc();
      let blob: Blob;
      try {
        blob = await pdf(
          <TexlexPdfDocument draft={cleanDraft} logoSrc={logoSrc} signatureSrc={signatureSrc} />
        ).toBlob();
      } catch (firstError) {
        console.warn("Texlex PDF export: first attempt failed, retrying without signature image.", firstError);
        signatureSrc = null;
        blob = await pdf(
          <TexlexPdfDocument draft={cleanDraft} logoSrc={logoSrc} signatureSrc={signatureSrc} />
        ).toBlob();
      }
      const stem = safeFilenamePart(draft.patientDetails.clientName);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${stem}-ASDReport-${draft.patientDetails.reportDate}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      const finalisePatientId = cliniko?.patientId;
      if (finalisePatientId) {
        try {
          const buf = await blob.arrayBuffer();
          let binary = "";
          const bytes = new Uint8Array(buf);
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
          const base64 = btoa(binary);
          const dateStamp = new Date().toISOString().slice(0, 10);
          await fetch("/api/cliniko/files", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              patientId: finalisePatientId,
              filename: `${stem}-ASDReport-${draft.patientDetails.reportDate}.pdf`,
              content: base64,
              contentType: "application/pdf",
              encoding: "base64",
              description: "Texlex finalised report",
            }),
          });
          setClinikoSyncNotice("Report saved to Cliniko");
        } catch (uploadErr) {
          console.error("Cliniko PDF upload failed (download succeeded):", uploadErr);
        }
      }
    } catch (error) {
      console.error("Texlex PDF export failed:", error);
      window.alert("Could not prepare the PDF. Please try again.");
    } finally {
      setPdfDownloading(false);
    }
  }, [cliniko, patientDetails, persistPayload]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveDraftNow();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveDraftNow]);

  const persistPayloadRef = useRef(persistPayload);
  persistPayloadRef.current = persistPayload;

  const writeAsdLocalDraft = useCallback((payload: TexlexReportDraftV1) => {
    const activeKey = engineLocalDraftKey("asd", payload.cliniko?.patientId ?? null);
    if (!draftMatchesStorageKey("asd", activeKey, payload)) return false;
    if (isTexlexDraftEffectivelyEmpty(omitLastSaved(payload))) return true;
    const written = writeLocalEngineDraft("asd", activeKey, payload);
    if (!written.ok) {
      setSaveFailed(true);
      return false;
    }
    setLastSavedAt(written.lastSaved);
    setSaveFailed(false);
    if (payload.cliniko?.patientId) {
      clearLocalEngineDraft(engineLocalDraftKey("asd", null));
    }
    return true;
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (suppressAutosaveRef.current) {
      suppressAutosaveRef.current = false;
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        writeAsdLocalDraft(persistPayload);
      } catch {
        setSaveFailed(true);
      }
    }, AUTO_SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [hydrated, persistPayload, writeAsdLocalDraft]);

  // Flush pending edits on unmount (SPA nav) so the debounce window cannot drop the last keystrokes.
  useEffect(() => {
    return () => {
      try {
        writeAsdLocalDraft(persistPayloadRef.current);
      } catch {
        /* ignore */
      }
    };
  }, [writeAsdLocalDraft]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (lastEditAt <= 0) return;
      const cloudMs = lastCloudSavedAt ? Date.parse(lastCloudSavedAt) : 0;
      if (!Number.isFinite(cloudMs) || lastEditAt > cloudMs) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [lastCloudSavedAt, lastEditAt]);

  const discardLocalDraftRestored = useCallback(() => {
    if (localDraftRestoredNotice) {
      clearLocalEngineDraft(localDraftRestoredNotice.storageKey);
    }
    clearLocalEngineDraft(engineLocalDraftKey("asd", cliniko?.patientId ?? null));
    clearLocalEngineDraft(engineLocalDraftKey("asd", null));
    clearEngineActiveDraftPointer("asd");
    startNewReport();
  }, [cliniko?.patientId, localDraftRestoredNotice, startNewReport]);

  const editing = nowTick - lastEditAt < 2000 && lastEditAt > 0;
  const statusLabel = saveFailed
    ? "Save failed — retry"
    : editing
      ? "Editing..."
      : `Saved ${formatSavedAgo(lastSavedAt, nowTick)}`;

  const inputClass =
    "flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-[15px] leading-[1.55] shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="min-h-screen bg-[var(--bg-page)] font-[family-name:var(--font-geist-sans,system-ui,Inter,sans-serif)] text-foreground">
      <TexlexReportHeader
        clientName={patientDetails.clientName}
        statusLabel={statusLabel}
        saveFailed={saveFailed}
        editing={editing}
        pdfDownloading={pdfDownloading}
        onDownloadPdf={() => void handleDownloadPdf()}
        onNewReport={handleNewReportClick}
        onSaveDraft={() => saveDraftNow()}
        statusExtras={
          <>
            {saveToast ? (
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-500" aria-live="polite">
                Saved
              </span>
            ) : null}
            {clinikoToast ? (
              <span className="text-xs font-medium text-foreground" aria-live="polite">
                {clinikoToast}
              </span>
            ) : null}
            {clinikoSyncNotice ? (
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-500" aria-live="polite">
                {clinikoSyncNotice}
              </span>
            ) : null}
            {newReportToast ? (
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-500" aria-live="polite">
                Started new report
              </span>
            ) : null}
          </>
        }
      />

      {localDraftRestoredNotice ? (
        <div className="border-b border-border/60 bg-muted/30 px-5 py-2">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground" aria-live="polite">
              Draft restored — last saved{" "}
              {formatLocalDraftClockTime(localDraftRestoredNotice.lastSaved)}
            </p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={discardLocalDraftRestored}
            >
              Discard
            </Button>
          </div>
        </div>
      ) : null}

      {draftResumePrompt ? (
        <div
          className="border-b border-amber-300/60 bg-amber-50 px-5 py-3 dark:border-amber-800/60 dark:bg-amber-950/30"
          role="dialog"
          aria-label="Resume draft"
        >
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-foreground">
              Resume previous draft for {draftResumePrompt.patientLabel}? Last saved {draftResumePrompt.lastSavedLabel}.
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={() => {
                  applyLocalDraftData(draftResumePrompt.stored);
                  if (typeof draftResumePrompt.stored.lastSaved === "string") {
                    setLastCloudSavedAt(draftResumePrompt.stored.lastSaved);
                  }
                  if (
                    draftMatchesStorageKey("asd", draftResumePrompt.activeKey, draftResumePrompt.stored)
                  ) {
                    writeLocalEngineDraft("asd", draftResumePrompt.activeKey, {
                      ...draftResumePrompt.stored,
                      engine: "asd",
                    });
                    clearLocalEngineDraft(engineLocalDraftKey("asd", null));
                  }
                  setDraftResumePrompt(null);
                }}
              >
                Resume
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setDraftResumePrompt(null);
                }}
              >
                Discard
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mx-auto flex max-w-[1600px] gap-6 bg-[var(--bg-page)] px-5 py-8">
        <TexlexReportSidebarNav />

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[760px] space-y-[14px] text-[15px] leading-[1.55]">
            <section id="report-header">
              <Card className={TEXLEX_SECTION_CONTAINER_CLASS}>
                <CardContent className={cn(TEXLEX_SECTION_CONTENT_CLASS, "space-y-3 text-center md:text-left")}>
                  <Badge variant="outline" className="font-semibold tracking-wide">
                    {TEXLEX_HEADER.confidential}
                  </Badge>
                  <p className="text-base font-semibold leading-snug text-foreground">{TEXLEX_HEADER.reportType}</p>
                  <p className="text-sm text-muted-foreground">{TEXLEX_HEADER.pathway}</p>
                </CardContent>
              </Card>
            </section>

            <section id="assessment-context">
              <TexlexSectionHeading className="mb-3">Assessment context</TexlexSectionHeading>
              <Card className={TEXLEX_SECTION_CONTAINER_CLASS}>
                <CardContent className={TEXLEX_SECTION_CONTENT_CLASS}>
                  <div className="whitespace-pre-wrap text-[15px] leading-[1.55] text-muted-foreground">
                    {TEXLEX_ASSESSMENT_CONTEXT}
                  </div>
                </CardContent>
              </Card>
            </section>

            <section id="consent">
              <TexlexSectionHeading className="mb-3">Consent and use of report</TexlexSectionHeading>
              <Card className={TEXLEX_SECTION_CONTAINER_CLASS}>
                <CardContent className={TEXLEX_SECTION_CONTENT_CLASS}>
                  <div className="whitespace-pre-wrap text-[15px] leading-[1.55] text-muted-foreground">
                    {TEXLEX_CONSENT}
                  </div>
                </CardContent>
              </Card>
            </section>

            <ClinikoIntakeCard
              key={clinikoIntakeResetKey}
              inputClass={inputClass}
              patientDetails={patientDetails}
              setPatientDetails={setPatientDetails}
              cliniko={cliniko}
              setCliniko={setCliniko}
              onTouch={touch}
              onLoaded={showClinikoLoadedToast}
              onError={showClinikoErrorToast}
            />

            <section id="patient-details">
              <TexlexSectionHeading className="mb-3">Client details</TexlexSectionHeading>
              <Card className={TEXLEX_SECTION_CONTAINER_CLASS}>
                <CardContent className={TEXLEX_SECTION_CONTENT_CLASS}>
                  {(() => {
                    const parentsLine = formatParentsCarers(patientDetails.parent1, patientDetails.parent2);
                    const datesLine = formatAssessmentDatesDisplay(patientDetails.assessmentDates);
                    const bits = [patientDetails.clientName.trim(), parentsLine, datesLine].filter(Boolean);
                    if (!bits.length) return null;
                    return (
                      <p className="mb-3 text-xs text-muted-foreground">
                        {bits.join(" · ")}
                      </p>
                    );
                  })()}
                  <div className="overflow-x-auto rounded-lg border border-border/80">
                    <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                      <tbody>
                        <tr className="border-b border-border/80">
                          <td className="w-1/2 border-r border-border/80 p-3 align-top">
                            <label className="block space-y-1.5 font-medium text-foreground">
                              <span className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
                                Client Name
                              </span>
                              <input
                                maxLength={METADATA_INPUT_MAX_LENGTH}
                                className={cn(inputClass, "w-full")}
                                value={patientDetails.clientName}
                                onChange={(e) => {
                                  touch();
                                  setPatientDetails((p) => ({ ...p, clientName: e.target.value }));
                                }}
                              />
                            </label>
                          </td>
                          <td className="w-1/2 p-3 align-top">
                            <label className="block space-y-1.5 font-medium text-foreground">
                              <span className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
                                Parent/Carer 1
                              </span>
                              <input
                                maxLength={METADATA_INPUT_MAX_LENGTH}
                                className={cn(inputClass, "w-full")}
                                value={patientDetails.parent1}
                                onChange={(e) => {
                                  touch();
                                  setPatientDetails((p) => ({ ...p, parent1: e.target.value }));
                                }}
                              />
                              <select
                                className={cn(inputClass, "w-full")}
                                value={patientDetails.parent1Relationship}
                                onChange={(e) => {
                                  touch();
                                  setPatientDetails((p) => ({ ...p, parent1Relationship: e.target.value }));
                                }}
                              >
                                <option value="">Relationship (optional)</option>
                                <option value="mother">mother</option>
                                <option value="father">father</option>
                                <option value="carer">carer</option>
                                <option value="guardian">guardian</option>
                                <option value="other">other</option>
                              </select>
                            </label>
                          </td>
                        </tr>
                        <tr className="border-b border-border/80">
                          <td className="border-r border-border/80 bg-muted/5 p-3 align-top" aria-hidden="true" />
                          <td className="p-3 align-top">
                            <label className="block space-y-1.5 font-medium text-foreground">
                              <span className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
                                Parent/Carer 2
                              </span>
                              <input
                                maxLength={METADATA_INPUT_MAX_LENGTH}
                                className={cn(inputClass, "w-full")}
                                value={patientDetails.parent2}
                                placeholder="Optional"
                                onChange={(e) => {
                                  touch();
                                  setPatientDetails((p) => ({ ...p, parent2: e.target.value }));
                                }}
                              />
                              <select
                                className={cn(inputClass, "w-full")}
                                value={patientDetails.parent2Relationship}
                                onChange={(e) => {
                                  touch();
                                  setPatientDetails((p) => ({ ...p, parent2Relationship: e.target.value }));
                                }}
                              >
                                <option value="">Relationship (optional)</option>
                                <option value="mother">mother</option>
                                <option value="father">father</option>
                                <option value="carer">carer</option>
                                <option value="guardian">guardian</option>
                                <option value="other">other</option>
                              </select>
                            </label>
                          </td>
                        </tr>
                        <tr className="border-b border-border/80">
                          <td className="border-r border-border/80 p-3 align-top">
                            <div className="space-y-3 font-medium text-foreground">
                              <label className="block space-y-1.5">
                                <span className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
                                  Date of Birth
                                </span>
                                <input
                                  type="date"
                                  className={cn(inputClass, "w-full")}
                                  value={patientDetails.dob}
                                  onChange={(e) => {
                                    touch();
                                    setPatientDetails((p) => ({ ...p, dob: e.target.value }));
                                  }}
                                />
                              </label>
                              <div className="space-y-1.5">
                                <span className="block text-xs font-normal uppercase tracking-wide text-muted-foreground">
                                  Chronological Age
                                </span>
                                <input
                                  readOnly
                                  tabIndex={-1}
                                  aria-readonly="true"
                                  className={cn(
                                    inputClass,
                                    "w-full cursor-default bg-muted/40 text-muted-foreground"
                                  )}
                                  value={computeChronologicalAge(patientDetails.dob)}
                                  placeholder="—"
                                />
                              </div>
                            </div>
                          </td>
                          <td className="p-3 align-top">
                            <label className="block space-y-1.5 font-medium text-foreground">
                              <span className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
                                Referring Practitioner
                              </span>
                              <input
                                maxLength={METADATA_INPUT_MAX_LENGTH}
                                className={cn(inputClass, "w-full")}
                                value={patientDetails.referringPractitioner}
                                onChange={(e) => {
                                  touch();
                                  setPatientDetails((p) => ({ ...p, referringPractitioner: e.target.value }));
                                }}
                              />
                              <input
                                maxLength={METADATA_INPUT_MAX_LENGTH}
                                className={cn(inputClass, "w-full")}
                                placeholder="Referrer type (optional)"
                                value={patientDetails.referringPractitionerType}
                                onChange={(e) => {
                                  touch();
                                  setPatientDetails((p) => ({ ...p, referringPractitionerType: e.target.value }));
                                }}
                              />
                              <input
                                type="email"
                                maxLength={METADATA_INPUT_MAX_LENGTH}
                                className={cn(inputClass, "w-full")}
                                placeholder="Referrer email (optional)"
                                value={patientDetails.referringPractitionerEmail}
                                onChange={(e) => {
                                  touch();
                                  setPatientDetails((p) => ({ ...p, referringPractitionerEmail: e.target.value }));
                                }}
                              />
                            </label>
                          </td>
                        </tr>
                        <tr className="border-b border-border/80">
                          <td className="border-r border-border/80 p-3 align-top" colSpan={1}>
                            <div className="font-medium text-foreground">
                              <span className="block text-xs font-normal uppercase tracking-wide text-muted-foreground">
                                Date(s) of Assessment
                              </span>
                              <div className="mt-2 space-y-2">
                                {patientDetails.assessmentDates.map((ad, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <input
                                      type="date"
                                      className={cn(inputClass, "min-w-0 flex-1")}
                                      value={ad}
                                      onChange={(e) => {
                                        touch();
                                        const v = e.target.value;
                                        setPatientDetails((p) => ({
                                          ...p,
                                          assessmentDates: p.assessmentDates.map((x, i) => (i === idx ? v : x)),
                                        }));
                                      }}
                                    />
                                    {idx > 0 ? (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="shrink-0 text-muted-foreground"
                                        aria-label="Remove date"
                                        onClick={() => {
                                          touch();
                                          setPatientDetails((p) => ({
                                            ...p,
                                            assessmentDates:
                                              p.assessmentDates.length > 1
                                                ? p.assessmentDates.filter((_, i) => i !== idx)
                                                : [""],
                                          }));
                                        }}
                                      >
                                        <X className="size-4" />
                                      </Button>
                                    ) : null}
                                  </div>
                                ))}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="mt-1 w-fit text-xs"
                                  onClick={() => {
                                    touch();
                                    setPatientDetails((p) => ({
                                      ...p,
                                      assessmentDates: [...p.assessmentDates, ""],
                                    }));
                                  }}
                                >
                                  + Add another date
                                </Button>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 align-top">
                            <label className="block space-y-1.5 font-medium text-foreground">
                              <span className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
                                Date of Report
                              </span>
                              <input
                                type="date"
                                className={cn(inputClass, "w-full")}
                                value={patientDetails.reportDate}
                                onChange={(e) => {
                                  touch();
                                  setPatientDetails((p) => ({ ...p, reportDate: e.target.value }));
                                }}
                              />
                            </label>
                          </td>
                        </tr>
                        <tr className="border-b border-border/80">
                          <td className="border-r border-border/80 p-3 align-top">
                            <label className="block space-y-1.5 font-medium text-foreground">
                              <span className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
                                School
                              </span>
                              <input
                                maxLength={METADATA_INPUT_MAX_LENGTH}
                                className={cn(inputClass, "w-full")}
                                value={patientDetails.school}
                                onChange={(e) => {
                                  touch();
                                  setPatientDetails((p) => ({ ...p, school: e.target.value }));
                                }}
                              />
                            </label>
                          </td>
                          <td className="p-3 align-top">
                            <label className="block space-y-1.5 font-medium text-foreground">
                              <span className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
                                Year Level
                              </span>
                              <input
                                maxLength={METADATA_INPUT_MAX_LENGTH}
                                className={cn(inputClass, "w-full")}
                                value={patientDetails.yearLevel}
                                placeholder="e.g. Year 10"
                                onChange={(e) => {
                                  touch();
                                  setPatientDetails((p) => ({ ...p, yearLevel: e.target.value }));
                                }}
                              />
                              <select
                                className={cn(inputClass, "w-full")}
                                value={patientDetails.assessmentType}
                                onChange={(e) => {
                                  touch();
                                  setPatientDetails((p) => ({ ...p, assessmentType: e.target.value }));
                                }}
                              >
                                <option value="">Assessment type (optional)</option>
                                <option value="ADHD">ADHD</option>
                                <option value="ASD">ASD</option>
                                <option value="SLD">SLD</option>
                              </select>
                            </label>
                          </td>
                        </tr>
                        <tr className="border-b border-border/80">
                          <td className="border-r border-border/80 p-3 align-top">
                            <label className="block space-y-1.5 font-medium text-foreground">
                              <span className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
                                Phone
                              </span>
                              <input
                                maxLength={METADATA_INPUT_MAX_LENGTH}
                                className={cn(inputClass, "w-full")}
                                value={patientDetails.phone}
                                onChange={(e) => {
                                  touch();
                                  setPatientDetails((p) => ({ ...p, phone: e.target.value }));
                                }}
                              />
                            </label>
                          </td>
                          <td className="p-3 align-top">
                            <label className="block space-y-1.5 font-medium text-foreground">
                              <span className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
                                Address
                              </span>
                              <input
                                maxLength={METADATA_INPUT_MAX_LENGTH}
                                className={cn(inputClass, "w-full")}
                                value={patientDetails.address}
                                onChange={(e) => {
                                  touch();
                                  setPatientDetails((p) => ({ ...p, address: e.target.value }));
                                }}
                              />
                            </label>
                          </td>
                        </tr>
                        <tr>
                          <td className="border-r border-border/80 p-3 align-top">
                            <label className="block space-y-1.5 font-medium text-foreground">
                              <span className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
                                Assessor
                              </span>
                              <input
                                maxLength={METADATA_INPUT_MAX_LENGTH}
                                className={cn(inputClass, "w-full")}
                                value={patientDetails.assessor}
                                onChange={(e) => {
                                  touch();
                                  setPatientDetails((p) => ({ ...p, assessor: e.target.value }));
                                }}
                              />
                            </label>
                          </td>
                          <td className="p-3 align-top">
                            <label className="block space-y-1.5 font-medium text-foreground">
                              <span className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
                                Pronouns
                              </span>
                              <input
                                maxLength={METADATA_INPUT_MAX_LENGTH}
                                className={cn(inputClass, "w-full")}
                                value={patientDetails.pronouns}
                                onChange={(e) => {
                                  touch();
                                  setPatientDetails((p) => ({ ...p, pronouns: e.target.value }));
                                }}
                              />
                            </label>
                          </td>
                        </tr>
                    </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section id="diagnostic-conclusion">
              <TexlexSectionHeading className="mb-3">Diagnostic conclusion</TexlexSectionHeading>
              <Card className={TEXLEX_SECTION_CONTAINER_CLASS}>
                <CardContent className={cn(TEXLEX_SECTION_CONTENT_CLASS, "space-y-3")}>
                  <p className="text-sm text-muted-foreground">
                    This setting controls the Clinical Formulation opening statement. Set this before generating the
                    Formulation.
                  </p>
                  <fieldset>
                    <legend className="sr-only">Diagnostic conclusion</legend>
                    <div className="flex flex-col gap-3">
                      {(
                        [
                          ["meets", "Meets DSM-5-TR criteria for ASD"],
                          ["does_not_meet", "Does not meet DSM-5-TR criteria for ASD"],
                          ["inconclusive", "Inconclusive — further evidence required"],
                        ] as const
                      ).map(([value, label]) => (
                        <label
                          key={value}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors",
                            diagnosticConclusion === value
                              ? "border-primary bg-primary/5"
                              : "border-border/80 hover:bg-muted/30"
                          )}
                        >
                          <input
                            type="radio"
                            name="texlex-diagnostic-conclusion"
                            value={value}
                            checked={diagnosticConclusion === value}
                            onChange={() => {
                              touch();
                              setDiagnosticConclusion(value);
                            }}
                            className="mt-0.5"
                          />
                          <span className="font-medium leading-snug">{label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </CardContent>
              </Card>
            </section>

            <section id="raw-notes">
              <TexlexSectionHeading className="mb-3">Raw clinical notes</TexlexSectionHeading>
              <Card className={TEXLEX_SECTION_CONTAINER_CLASS}>
                <CardContent className={TEXLEX_SECTION_CONTENT_CLASS}>
                  <ReportTextarea
                    rows={12}
                    value={rawNotes}
                    onChange={(e) => {
                      touch();
                      setRawNotes(e.target.value);
                    }}
                    placeholder="Paste or type assessment notes…"
                    className="rounded-lg"
                  />
                  <SectionCharWordCount text={rawNotes} />
                  <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
                    <Button
                      type="button"
                      size="lg"
                      className="px-5 text-sm font-semibold"
                      onClick={handleGenerateReport}
                      disabled={Boolean(generatingSectionId)}
                    >
                      {generatingSectionId ? "Stop generation" : "Generate Report"}
                    </Button>
                  </div>
                  {sectionGenErrors["report-generation"] ? (
                    <p className="mt-2 text-right text-sm text-destructive" role="alert">
                      {sectionGenErrors["report-generation"]}
                    </p>
                  ) : null}
                  <p className="mt-2 text-right text-xs text-muted-foreground">
                    Click to populate all editable sections from the raw notes above. Each section can also be generated
                    or regenerated individually.
                  </p>
                </CardContent>
              </Card>
            </section>

            <section id="presenting-concerns">
              <TexlexSectionHeading className="mb-1">Presenting concerns</TexlexSectionHeading>
              <Card className={cn(TEXLEX_SECTION_CONTAINER_CLASS, "mt-2")}>
                <CardContent className={TEXLEX_SECTION_CONTENT_CLASS}>
                  <TexlexSectionRawNotesField>
                    <ReportTextarea
                      rows={4}
                      value={presentingConcernsRaw}
                      onChange={(e) => {
                        touch();
                        setPresentingConcernsRaw(e.target.value);
                      }}
                      placeholder="Type or paste focused notes for this section. If empty, the master Raw Clinical Notes will be used."
                      className="rounded-lg"
                    />
                    <SectionCharWordCount text={presentingConcernsRaw} />
                  </TexlexSectionRawNotesField>
                  <GenerateRegenerateRow
                    sectionId="presenting-concerns"
                    modelName={TEXLEX_SECTION_MODELS.presentingConcerns}
                    onGenerate={handleGeneratePresentingConcerns}
                    onRegenerate={handleRegeneratePresentingConcerns}
                    regenerateDisabled={generatingSectionId === "presenting-concerns"}
                    generateLabel={generatingSectionId === "presenting-concerns" ? "Stop" : "Generate"}
                    topSlot={
                      generatingSectionId === "presenting-concerns" ? (
                        <span className="inline-flex w-full basis-full items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                          </span>
                          Generating…
                        </span>
                      ) : undefined
                    }
                    bottomSlot={
                      sectionGenErrors["presenting-concerns"] ? (
                        <p className="mt-2 w-full basis-full text-sm text-destructive" role="alert">
                          {sectionGenErrors["presenting-concerns"]}
                        </p>
                      ) : null
                    }
                  />
                  <label className="mt-4 block space-y-1.5 text-sm font-medium">
                    Generated section
                    <ReportTextarea
                      rows={8}
                      value={presentingConcerns}
                      onChange={(e) => {
                        touch();
                        setPresentingConcerns(e.target.value);
                      }}
                      className="rounded-lg"
                    />
                    <SectionCharWordCount text={presentingConcerns} />
                  </label>
                </CardContent>
              </Card>
            </section>

            <section id="background" className="space-y-[14px]">
              <TexlexSectionHeading className="mb-1">Background</TexlexSectionHeading>
              {(
                [
                  ["pregnancyBirth", "Pregnancy & birth", "background-pregnancy-birth", TEXLEX_SECTION_MODELS.pregnancyBirth],
                  ["earlyDevelopment", "Early development", "background-early-development", TEXLEX_SECTION_MODELS.earlyDevelopment],
                  ["educationalHistory", "Educational history", "background-educational-history", TEXLEX_SECTION_MODELS.educationalHistory],
                  [
                    "emotionalBehaviouralSensory",
                    "Emotional, behavioural & sensory",
                    "background-emotional-behavioural-sensory",
                    TEXLEX_SECTION_MODELS.emotionalBehaviouralSensory,
                  ],
                ] as const satisfies ReadonlyArray<
                  readonly [BackgroundSectionKey, string, string, string]
                >
              ).map(([key, label, sectionId, modelName]) => {
                const rawKey = backgroundRawKey(key);
                const subsectionValue = background[key];
                const showPreview =
                  key === "emotionalBehaviouralSensory" && isTexlexSubsectionEmpty(subsectionValue);
                const previewText =
                  key === "emotionalBehaviouralSensory" && isTexlexSubsectionEmpty(subsectionValue)
                    ? BACKGROUND_EMOTIONAL_EMPTY_FALLBACK
                    : subsectionValue;
                return (
                <Card key={key} id={sectionId} className={TEXLEX_SECTION_CONTAINER_CLASS}>
                  <CardContent className={TEXLEX_SECTION_CONTENT_CLASS}>
                    <h3 className="text-base font-semibold">{label}</h3>
                    <TexlexSectionRawNotesField className="mt-2">
                      <ReportTextarea
                        rows={4}
                        value={background[rawKey]}
                        onChange={(e) => {
                          touch();
                          setBackground((b) => ({ ...b, [rawKey]: e.target.value }));
                        }}
                        placeholder="Type or paste focused notes for this section. If empty, the master Raw Clinical Notes will be used."
                        className="rounded-lg"
                      />
                      <SectionCharWordCount text={background[rawKey]} />
                    </TexlexSectionRawNotesField>
                    <GenerateRegenerateRow
                      sectionId={sectionId}
                      modelName={modelName}
                      onGenerate={() => handleGenerateBackground(key)}
                      onRegenerate={() => handleRegenerateBackground(key)}
                      regenerateDisabled={generatingSectionId === sectionId}
                      generateLabel={generatingSectionId === sectionId ? "Stop" : "Generate"}
                      topSlot={
                        generatingSectionId === sectionId ? (
                          <span className="inline-flex w-full basis-full items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="relative flex h-2 w-2">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                            </span>
                            Generating…
                          </span>
                        ) : undefined
                      }
                      bottomSlot={
                        sectionGenErrors[sectionId] ? (
                          <p className="mt-2 w-full basis-full text-sm text-destructive" role="alert">
                            {sectionGenErrors[sectionId]}
                          </p>
                        ) : null
                      }
                    />
                    <label className="mt-4 block space-y-1.5 text-sm font-medium">
                      Generated subsection
                      <ReportTextarea
                        rows={6}
                        value={background[key]}
                        onChange={(e) => {
                          touch();
                          setBackground((b) => ({ ...b, [key]: e.target.value }));
                        }}
                        className="rounded-lg"
                      />
                      <SectionCharWordCount text={background[key]} />
                    </label>
                    {showPreview ? (
                      <div className="mt-4 whitespace-pre-wrap rounded-lg border border-border/60 bg-muted/20 p-4 text-[15px] leading-[1.55] text-muted-foreground">
                        {previewText}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
              })}
            </section>

            <section id="collateral" className="space-y-[14px]">
              <TexlexSectionHeading className="mb-1">Collateral documents</TexlexSectionHeading>
              <Card className={TEXLEX_SECTION_CONTAINER_CLASS}>
                <CardContent className={TEXLEX_SECTION_CONTENT_CLASS}>
                  <CollateralDocumentsUpload
                    collateralDocs={collateralDocs}
                    setCollateralDocs={setCollateralDocs}
                    touch={touch}
                    inputClass={inputClass}
                  />
                </CardContent>
              </Card>
              <Card className={TEXLEX_SECTION_CONTAINER_CLASS}>
                <CardContent className={TEXLEX_SECTION_CONTENT_CLASS}>
                  <h3 className="text-[11pt] font-semibold text-[#0e7c8a]">Collateral Rating Scales and Reports</h3>
                  <ReportTextarea
                    rows={10}
                    value={collateralSummary}
                    onChange={(e) => {
                      touch();
                      setCollateralSummary(e.target.value);
                    }}
                    className="mt-2 rounded-lg"
                  />
                  <SectionCharWordCount text={collateralSummary} />
                  <GenerateRegenerateRow
                    sectionId="collateral-summary"
                    modelName={TEXLEX_SECTION_MODELS.collateralSummary}
                    onGenerate={handleGenerateCollateralSummary}
                    onRegenerate={handleRegenerateCollateralSummary}
                    regenerateDisabled={generatingSectionId === "collateral-summary"}
                    generateLabel={generatingSectionId === "collateral-summary" ? "Stop" : "Generate"}
                    topSlot={
                      generatingSectionId === "collateral-summary" ? (
                        <span className="inline-flex w-full basis-full items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                          </span>
                          Generating…
                        </span>
                      ) : undefined
                    }
                    bottomSlot={
                      <>
                        <VoiceCriticBadge kind={voiceCriticBadgeBySection["collateral-summary"] ?? null} />
                        {sectionGenErrors["collateral-summary"] ? (
                          <p className="mt-2 w-full basis-full text-sm text-destructive" role="alert">
                            {sectionGenErrors["collateral-summary"]}
                          </p>
                        ) : null}
                      </>
                    }
                  />
                  {!isTexlexSubsectionEmpty(collateralSummary) ? (
                    <div className="mt-4 whitespace-pre-wrap rounded-lg border border-border/60 bg-muted/20 p-4 text-[15px] leading-[1.55] text-muted-foreground">
                      {collateralSummary}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </section>

            <section id="dsm-criteria" className="space-y-[14px]">
              <TexlexSectionHeading>DSM-5-TR criteria (A &amp; B)</TexlexSectionHeading>
              <div className="whitespace-pre-wrap text-sm text-muted-foreground">{TEXLEX_DSM_INTRO}</div>
              <p className="text-sm text-muted-foreground">
                Auto-suggested ratings derive from the live marker matrix in the engine assistant. Use the clinician
                rating to override when indicated.
              </p>
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <p className="mb-2 text-sm font-semibold text-foreground">Rating scale</p>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {TEXLEX_RATING_GUIDE.map((r) => (
                    <li key={r.value}>
                      <span className="font-mono tabular-nums text-foreground">{r.value}</span>
                      <span className="mx-2 text-border">—</span>
                      {r.label}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2 rounded-xl border border-border/60 bg-muted/10 p-4">
                <h3 className="text-base font-semibold text-foreground">{TEXLEX_CRITERION_A_HEADER.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{TEXLEX_CRITERION_A_HEADER.description}</p>
              </div>
              {A_CRITERION_CODES.map((code) => (
                <CriterionCard
                  key={code}
                  code={code}
                  criterion={TEXLEX_CRITERIA[code]}
                  c={criteria[code]}
                  inputClass={inputClass}
                  touch={touch}
                  setCriteria={setCriteria}
                  criterionGenerate={getCriterionGenerateProps(code)}
                />
              ))}

              <div className="space-y-2 rounded-xl border border-border/60 bg-muted/10 p-4">
                <h3 className="text-base font-semibold text-foreground">{TEXLEX_CRITERION_B_HEADER.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{TEXLEX_CRITERION_B_HEADER.description}</p>
              </div>
              {B_CRITERION_CODES.map((code) => (
                <CriterionCard
                  key={code}
                  code={code}
                  criterion={TEXLEX_CRITERIA[code]}
                  c={criteria[code]}
                  inputClass={inputClass}
                  touch={touch}
                  setCriteria={setCriteria}
                  criterionGenerate={getCriterionGenerateProps(code)}
                />
              ))}

              <div className="space-y-2 rounded-xl border border-border/60 bg-muted/10 p-4">
                <h3 className="text-base font-semibold text-foreground">{TEXLEX_CRITERION_C_HEADER.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {TEXLEX_CRITERION_C_HEADER.description}
                </p>
              </div>
              {C_CRITERION_CODES.map((code) => (
                <CriterionCard
                  key={code}
                  code={code}
                  criterion={TEXLEX_CRITERIA[code]}
                  c={criteria[code]}
                  inputClass={inputClass}
                  touch={touch}
                  setCriteria={setCriteria}
                  criterionGenerate={getCriterionGenerateProps(code)}
                />
              ))}
            </section>

            <section id="functional-impact">
              <TexlexSectionHeading className="mb-3">Functional impact summary</TexlexSectionHeading>
              <Card className={TEXLEX_SECTION_CONTAINER_CLASS}>
                <CardContent className={TEXLEX_SECTION_CONTENT_CLASS}>
                  <ReportTextarea
                    rows={10}
                    value={functionalImpactSummary}
                    onChange={(e) => {
                      touch();
                      setFunctionalImpactSummary(e.target.value);
                    }}
                    className="rounded-lg"
                    placeholder="Describe functional impact across settings…"
                  />
                  <SectionCharWordCount text={functionalImpactSummary} />
                  <GenerateRegenerateRowDual
                    sectionId="functional-impact-summary"
                    generationModel={TEXLEX_SECTION_MODELS.functionalImpactSummary.generation}
                    refinementModel={TEXLEX_SECTION_MODELS.functionalImpactSummary.refinement}
                    onGenerate={handleGenerateFunctionalImpact}
                    onRegenerate={handleRegenerateFunctionalImpact}
                    regenerateDisabled={generatingSectionId === "functional-impact-summary"}
                    generateLabel={generatingSectionId === "functional-impact-summary" ? "Stop" : "Generate"}
                    topSlot={
                      generatingSectionId === "functional-impact-summary" ? (
                        <span className="inline-flex w-full basis-full items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                          </span>
                          Generating…
                        </span>
                      ) : undefined
                    }
                    bottomSlot={
                      <>
                        <VoiceCriticBadge kind={voiceCriticBadgeBySection["functional-impact-summary"] ?? null} />
                        {sectionGenErrors["functional-impact-summary"] ? (
                          <p className="mt-2 w-full basis-full text-sm text-destructive" role="alert">
                            {sectionGenErrors["functional-impact-summary"]}
                          </p>
                        ) : null}
                      </>
                    }
                  />
                  <div className="mt-4 whitespace-pre-wrap rounded-lg border border-border/60 bg-muted/20 p-4 text-[15px] leading-[1.55] text-muted-foreground">
                    {resolveFunctionalImpactDisplay(functionalImpactSummary)}
                  </div>
                </CardContent>
              </Card>
            </section>

            <section id="formulation">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
                <TexlexSectionHeading>Clinical formulation and consensus opinion</TexlexSectionHeading>
                <span className="text-xs text-muted-foreground sm:text-right">
                  Generating with:{" "}
                  {DIAGNOSTIC_CONCLUSION_FORMULATION_LABEL[resolveTexlexDiagnosticConclusion(diagnosticConclusion)]}
                </span>
              </div>
              {showDiagnosticConclusionMismatch ? (
                <div
                  className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50"
                  role="status"
                >
                  ⚠ Diagnostic conclusion (&quot;Does Not Meet&quot;) may not align with narrative content. Multiple
                  criteria show emerging features. Review before generating.
                </div>
              ) : null}
              <Card className={TEXLEX_SECTION_CONTAINER_CLASS}>
                <CardContent className={TEXLEX_SECTION_CONTENT_CLASS}>
                  <ReportTextarea
                    rows={12}
                    value={clinicalFormulation}
                    onChange={(e) => {
                      touch();
                      setClinicalFormulation(e.target.value);
                    }}
                    className="rounded-lg"
                    placeholder="Working formulation and consensus opinion…"
                  />
                  <SectionCharWordCount text={clinicalFormulation} />
                  <GenerateRegenerateRowDual
                    sectionId="clinical-formulation"
                    generationModel={TEXLEX_SECTION_MODELS.clinicalFormulation.generation}
                    refinementModel={TEXLEX_SECTION_MODELS.clinicalFormulation.refinement}
                    onGenerate={handleGenerateFormulation}
                    onRegenerate={handleRegenerateFormulation}
                    regenerateDisabled={generatingSectionId === "clinical-formulation"}
                    generateLabel={generatingSectionId === "clinical-formulation" ? "Stop" : "Generate"}
                    topSlot={
                      generatingSectionId === "clinical-formulation" ? (
                        <span className="inline-flex w-full basis-full items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                          </span>
                          Generating…
                        </span>
                      ) : undefined
                    }
                    bottomSlot={
                      <>
                        <VoiceCriticBadge kind={voiceCriticBadgeBySection["clinical-formulation"] ?? null} />
                        {formulationTruncationWarning ? (
                          <p className="mt-1 w-full basis-full text-xs text-muted-foreground" role="status">
                            {formulationTruncationWarning}
                          </p>
                        ) : null}
                        {sectionGenErrors["clinical-formulation"] ? (
                          <p className="mt-2 w-full basis-full text-sm text-destructive" role="alert">
                            {sectionGenErrors["clinical-formulation"]}
                          </p>
                        ) : null}
                      </>
                    }
                  />
                </CardContent>
              </Card>
            </section>

            <section id="recommendations">
              <TexlexSectionHeading className="mb-3">Recommendations</TexlexSectionHeading>
              <Card className={TEXLEX_SECTION_CONTAINER_CLASS}>
                <CardContent className={TEXLEX_SECTION_CONTENT_CLASS}>
                  <ReportTextarea
                    rows={10}
                    value={recommendations}
                    onChange={(e) => {
                      touch();
                      setRecommendations(e.target.value);
                    }}
                    className="rounded-lg"
                    placeholder="Recommendations for supports, follow-up, and monitoring…"
                  />
                  <SectionCharWordCount text={recommendations} />
                  <GenerateRegenerateRowDual
                    sectionId="recommendations"
                    generationModel={TEXLEX_SECTION_MODELS.recommendations.generation}
                    refinementModel={TEXLEX_SECTION_MODELS.recommendations.refinement}
                    onGenerate={handleGenerateRecommendations}
                    onRegenerate={handleRegenerateRecommendations}
                    regenerateDisabled={generatingSectionId === "recommendations"}
                    generateLabel={generatingSectionId === "recommendations" ? "Stop" : "Generate"}
                    topSlot={
                      generatingSectionId === "recommendations" ? (
                        <span className="inline-flex w-full basis-full items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                          </span>
                          Generating…
                        </span>
                      ) : undefined
                    }
                    bottomSlot={
                      <>
                        <VoiceCriticBadge kind={voiceCriticBadgeBySection["recommendations"] ?? null} />
                        {sectionGenErrors["recommendations"] ? (
                          <p className="mt-2 w-full basis-full text-sm text-destructive" role="alert">
                            {sectionGenErrors["recommendations"]}
                          </p>
                        ) : null}
                      </>
                    }
                  />
                </CardContent>
              </Card>
            </section>

            <section id="limitations">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <TexlexSectionHeading>Limitations</TexlexSectionHeading>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => {
                    touch();
                    setEditLimitations((v) => !v);
                  }}
                >
                  {editLimitations ? "Lock boilerplate" : "Edit boilerplate"}
                </Button>
              </div>
              <Card className={TEXLEX_SECTION_CONTAINER_CLASS}>
                <CardContent className={TEXLEX_SECTION_CONTENT_CLASS}>
                  {editLimitations ? (
                    <>
                      <ReportTextarea
                        rows={10}
                        value={limitationsText}
                        onChange={(e) => {
                          touch();
                          setLimitationsText(e.target.value);
                        }}
                        className="rounded-lg"
                      />
                      <SectionCharWordCount text={limitationsText} />
                    </>
                  ) : (
                    <div className="whitespace-pre-wrap text-[15px] leading-[1.55] text-muted-foreground">
                      {limitationsText}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            <section id="signature">
              <TexlexSectionHeading className="mb-3">Signature block</TexlexSectionHeading>
              <Card className={TEXLEX_SECTION_CONTAINER_CLASS}>
                <CardContent className={TEXLEX_SECTION_CONTENT_CLASS}>
                  <blockquote className="space-y-3 border-l-2 border-border pl-4 text-[15px] leading-[1.55] text-muted-foreground">
                    <p>{TEXLEX_SIGNATURE.closing}</p>
                    <p className="text-foreground">{TEXLEX_SIGNATURE.signaturePlaceholder}</p>
                    <p className="text-foreground">
                      <span className="font-semibold">{TEXLEX_SIGNATURE.name}</span>
                      <br />
                      {TEXLEX_SIGNATURE.title}
                      <br />
                      {TEXLEX_SIGNATURE.registration}
                      <br />
                      {TEXLEX_SIGNATURE.practice}
                    </p>
                  </blockquote>
                </CardContent>
              </Card>
            </section>
          </div>
        </main>

        <aside className="hidden shrink-0 lg:block">
          <div className="sticky top-24 w-[380px] overflow-y-auto pb-10" style={{ maxHeight: "calc(100vh - 6rem)" }}>
            <div className="rounded-xl border border-border/80 bg-muted/30 p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Engine assistant</p>
              <EngineAssistant rawNotes={rawNotes} compact />
            </div>
          </div>
        </aside>
      </div>
      <NewReportConfirmModal
        open={newReportModalOpen}
        clinikoSyncInProgress={clinikoSyncInProgress}
        onCancel={() => setNewReportModalOpen(false)}
        onConfirm={handleConfirmNewReport}
        skipConfirmThisSession={skipNewReportConfirmSession}
        onSkipConfirmThisSessionChange={setSkipNewReportConfirmSession}
      />
    </div>
  );
}

// ─── Cliniko durable state save ───────────────────────────────────
async function uploadStateToCliniko(payload: TexlexReportDraftV1): Promise<boolean> {
  const patientId = payload.cliniko?.patientId;
  if (!patientId) return false;
  try {
    return await saveReportStateForEngine("asd", patientId, { ...payload, engine: "asd" });
  } catch (err) {
    console.error("[texlex] Supabase state save failed (local save unaffected):", err);
  }
  return false;
}

// ─── Resume-from-Supabase fallback ────────────────────────────────
async function fetchReportStateFromSupabase(
  patientId: string
): Promise<Partial<TexlexReportDraftV1> | null> {
  try {
    const remote = await fetchReportStateForEngine<Partial<TexlexReportDraftV1> & { engine?: string }>(
      "asd",
      patientId
    );
    if (!remote) return null;
    return remote.state;
  } catch {
    return null;
  }
}
