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
import Link from "next/link";
import { File as FileIcon, FileText, Image, Upload, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { EngineAssistant } from "../components/EngineAssistant";
import { useAsdEnginePipeline } from "../asd-engine-core";
import {
  TEXLEX_ASSESSMENT_CONTEXT,
  TEXLEX_CONSENT,
  TEXLEX_CRITERIA,
  TEXLEX_CRITERION_A_HEADER,
  TEXLEX_CRITERION_B_HEADER,
  TEXLEX_DSM_INTRO,
  TEXLEX_HEADER,
  TEXLEX_LIMITATIONS,
  TEXLEX_RATING_GUIDE,
  TEXLEX_SECTION_MODELS,
  TEXLEX_SIGNATURE,
} from "./constants/texlexBoilerplate";
import { resolveTexlexPublicAsset, resolveTexlexSignatureSrc, TEXLEX_LOGO_PATH } from "./pdf/assets";
import { isInsufficientEvidenceNarrative, safeFilenamePart } from "./pdf/utils";

const STORAGE_KEY = "texlex-report-draft-v1";
const AUTO_SAVE_DEBOUNCE_MS = 2000;
const METADATA_INPUT_MAX_LENGTH = 500;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

function computeChronologicalAge(dobString: string): string {
  if (!dobString) return "";
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return "";
  const today = new Date();
  let years = today.getFullYear() - dob.getFullYear();
  let months = today.getMonth() - dob.getMonth();
  if (today.getDate() < dob.getDate()) months--;
  if (months < 0) {
    years--;
    months += 12;
  }
  return `${years}y ${months}m`;
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

const CRITERION_CODES = ["A1", "A2", "A3", "B1", "B2", "B3", "B4"] as const;
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
  dob: string;
  referringPractitioner: string;
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

function emptyPatientDetails(): PatientDetails {
  return {
    clientName: "",
    parent1: "",
    parent2: "",
    dob: "",
    referringPractitioner: "",
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
      dob: typeof r.dob === "string" ? r.dob : next.dob,
      referringPractitioner:
        typeof r.referringPractitioner === "string" ? r.referringPractitioner : next.referringPractitioner,
      assessmentDates: assessmentDatesMerged,
      school: typeof r.school === "string" ? r.school : next.school,
      reportDate: typeof r.reportDate === "string" && r.reportDate ? r.reportDate : next.reportDate,
      yearLevel: typeof r.yearLevel === "string" ? r.yearLevel : next.yearLevel,
      assessor: typeof r.assessor === "string" && r.assessor ? r.assessor : next.assessor,
      phone: typeof r.phone === "string" ? r.phone : next.phone,
      address: typeof r.address === "string" ? r.address : next.address,
      pronouns: typeof r.pronouns === "string" ? r.pronouns : next.pronouns,
    };
  }
  return {
    ...next,
    clientName: typeof r.fullName === "string" ? r.fullName : typeof r.clientName === "string" ? r.clientName : "",
    parent1,
    parent2,
    dob:
      typeof r.dob === "string"
        ? r.dob
        : typeof r.dateOfBirth === "string"
          ? r.dateOfBirth
          : "",
    referringPractitioner:
      typeof r.referringPractitioner === "string"
        ? r.referringPractitioner
        : typeof r.referrer === "string"
          ? r.referrer
          : "",
    assessmentDates: assessmentDatesMerged,
    school: typeof r.school === "string" ? r.school : "",
    reportDate: typeof r.reportDate === "string" && r.reportDate ? r.reportDate : next.reportDate,
    yearLevel: typeof r.yearLevel === "string" ? r.yearLevel : "",
    assessor: typeof r.assessor === "string" && r.assessor ? r.assessor : next.assessor,
    phone: typeof r.phone === "string" ? r.phone : "",
    address: typeof r.address === "string" ? r.address : "",
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

function buildCollateralContentForApi(docs: CollateralDoc[]): string {
  if (!docs.length) return "";
  return docs
    .map((d) => {
      const title = d.filename.trim() || "Collateral document";
      const body = d.content?.trim() ?? "";
      return body ? `${title}: ${body}` : `${title}:`;
    })
    .join("\n");
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

async function streamTexlexSse(
  url: string,
  body: unknown,
  onDelta: (text: string) => void,
  abortSignal: AbortSignal
): Promise<void> {
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
      if (data === "[DONE]") return;
      try {
        const parsed = JSON.parse(data) as { delta?: string; error?: string; done?: boolean };
        if (parsed.error) throw new Error(parsed.error);
        if (typeof parsed.delta === "string" && parsed.delta.length) onDelta(parsed.delta);
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
}

function buildCriterionApiBody(
  code: CriterionCode,
  patientDetails: PatientDetails,
  rawNotesForModel: string,
  markersText: string
): Record<string, unknown> {
  const base = {
    clientName: patientDetails.clientName,
    pronouns: patientDetails.pronouns,
    chronologicalAge: computeChronologicalAge(patientDetails.dob),
    yearLevel: patientDetails.yearLevel,
    rawNotes: rawNotesForModel,
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
      out.push({
        id,
        filename: o.filename,
        size: typeof o.size === "number" && Number.isFinite(o.size) && o.size >= 0 ? o.size : 0,
        mimeType: o.mimeType,
        category,
        uploadedAt: typeof o.uploadedAt === "string" ? o.uploadedAt : new Date().toISOString(),
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

  const ingestFiles = useCallback(
    (fileList: File[]) => {
      touch();
      setUploadError(null);
      const files = fileList.filter((f) => f.size > 0 || f.name);
      if (files.length === 0) return;

      let capturedError: string | null = null;
      setCollateralDocs((prev) => {
        const additions: CollateralDoc[] = [];
        let firstError: string | null = null;
        let count = prev.length;
        let bytes = sumCollateralBytes(prev);

        const setErr = (msg: string) => {
          if (!firstError) firstError = msg;
        };

        for (const file of files) {
          const mime = resolveCollateralMime(file);
          if (!mime) {
            setErr(
              "This file type is not supported. Use PDF, JPG, PNG, HEIC, HEIF, DOC, or DOCX."
            );
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
          additions.push({
            id: newCollateralDocId(),
            filename: file.name,
            size: file.size,
            mimeType: mime,
            category: DEFAULT_DOC_CATEGORY,
            uploadedAt: new Date().toISOString(),
          });
          count += 1;
          bytes += file.size;
        }

        capturedError = firstError;
        if (additions.length === 0) return prev;
        return [...prev, ...additions];
      });
      if (capturedError) setUploadError(capturedError);
    },
    [setCollateralDocs, touch]
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
        Upload supporting reports and forms. Names, sizes, and categories are saved with this draft; file contents are
        not stored yet — after a refresh, re-upload files when you connect extraction.
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
                </p>
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
  lastSaved: string;
};

const A_CRITERION_CODES = ["A1", "A2", "A3"] as const satisfies readonly CriterionCode[];
const B_CRITERION_CODES = ["B1", "B2", "B3", "B4"] as const satisfies readonly CriterionCode[];

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

const NAV = [
  { id: "report-header", label: "Report header" },
  { id: "assessment-context", label: "Assessment context" },
  { id: "consent", label: "Consent" },
  { id: "patient-details", label: "Patient details" },
  { id: "raw-notes", label: "Raw notes" },
  { id: "presenting-concerns", label: "Presenting concerns" },
  { id: "background", label: "Background" },
  { id: "collateral", label: "Collateral" },
  { id: "dsm-criteria", label: "DSM-5-TR criteria" },
  { id: "functional-impact", label: "Functional impact" },
  { id: "formulation", label: "Formulation" },
  { id: "recommendations", label: "Recommendations" },
  { id: "limitations", label: "Limitations" },
  { id: "signature", label: "Signature" },
] as const;

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
      <span className="text-xs text-muted-foreground">Generation model: {modelName}</span>
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
      <span className="text-xs text-muted-foreground">
        Generation model: {generationModel} · Refinement: {refinementModel}
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
    <Card className="rounded-xl border border-border/80 shadow-sm transition-all hover:-translate-y-px hover:shadow-md">
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">{criterion.title}</h3>
            <p className="mt-2 text-[15px] leading-[1.55] text-muted-foreground">{criterion.description}</p>
            <SectionModelHint modelName={TEXLEX_SECTION_MODELS.dsmCriterion} />
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
        <GenerateRegenerateRow
          sectionId={`criterion-${code}`}
          modelName={TEXLEX_SECTION_MODELS.dsmCriterion}
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
  const [editLimitations, setEditLimitations] = useState(false);

  const [hydrated, setHydrated] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [lastEditAt, setLastEditAt] = useState(0);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [saveToast, setSaveToast] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const saveToastTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const debouncedRawNotes = useDebouncedValue(rawNotes, 400);
  const pipeline = useAsdEnginePipeline(debouncedRawNotes);

  const [generatingSectionId, setGeneratingSectionId] = useState<string | null>(null);
  const [sectionGenErrors, setSectionGenErrors] = useState<Partial<Record<string, string>>>({});
  const streamAbortRef = useRef<AbortController | null>(null);
  const genSessionRef = useRef(0);

  const a1MatrixRow = useMemo(() => {
    const m = pipeline.dsmMatrix as unknown;
    if (!Array.isArray(m)) return null;
    return (
      (m as Array<{ code: string; count?: number; status?: string; confidence?: string }>).find((r) => r.code === "A1") ??
      null
    );
  }, [pipeline.dsmMatrix]);

  const startCriterionGeneration = useCallback(
    async (code: CriterionCode) => {
      const sectionId = criterionSectionId(code);
      const sectionInput = criteria[code].indicators.trim();
      const masterInput = rawNotes.trim();
      const effectiveRaw = resolveGenerationRawNotes(sectionInput, masterInput);
      if (effectiveRaw.length < GENERATION_MIN_NOTES_CHARS) {
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
        const next = { ...p };
        delete next[sectionId];
        return next;
      });

      const markersText = buildCriterionMarkersPayload(pipeline.markers, code);
      const body = buildCriterionApiBody(code, patientDetails, effectiveRaw, markersText);

      setCriteria((prev) => ({ ...prev, [code]: { ...prev[code], indicators: "" } }));

      try {
        await streamTexlexSse(
          `/api/generate/${code.toLowerCase()}`,
          body,
          (delta) => {
            setCriteria((prev) => ({
              ...prev,
              [code]: { ...prev[code], indicators: prev[code].indicators + delta },
            }));
          },
          controller.signal
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (err instanceof Error && err.name === "AbortError") return;
        console.error(`${code} generation error:`, err);
        if (genSessionRef.current === session) {
          setSectionGenErrors((p) => ({
            ...p,
            [sectionId]: err instanceof Error ? err.message : `${code} generation failed.`,
          }));
        }
      } finally {
        if (genSessionRef.current === session) {
          if (code === "A2") {
            setCriteria((prev) => {
              if (!isInsufficientEvidenceNarrative(prev.A2.indicators)) return prev;
              return { ...prev, A2: { ...prev.A2, rating: null } };
            });
          }
          setGeneratingSectionId(null);
          streamAbortRef.current = null;
        }
      }
    },
    [criteria, patientDetails, pipeline.markers, rawNotes]
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

  const runPresentingConcernsStream = useCallback(async () => {
    const sectionId = "presenting-concerns";
    const sectionInput = presentingConcernsRaw.trim();
    const masterInput = rawNotes.trim();
    const effectiveRaw = resolveGenerationRawNotes(sectionInput, masterInput);
    if (effectiveRaw.length < GENERATION_MIN_NOTES_CHARS) {
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
    setPresentingConcerns("");
    try {
      await streamTexlexSse(
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
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("Presenting concerns generation error:", err);
      if (genSessionRef.current === session) {
        setSectionGenErrors((p) => ({
          ...p,
          [sectionId]: err instanceof Error ? err.message : "Presenting concerns generation failed.",
        }));
      }
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
    async (key: BackgroundSectionKey) => {
      const sectionId = BACKGROUND_STREAM_SLUG[key];
      const sectionInput = background[backgroundRawKey(key)].trim();
      const masterInput = rawNotes.trim();
      const effectiveRaw = resolveGenerationRawNotes(sectionInput, masterInput);
      if (effectiveRaw.length < GENERATION_MIN_NOTES_CHARS) {
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
      setBackground((b) => ({ ...b, [key]: "" }));
      try {
        await streamTexlexSse(
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
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("Background generation error:", err);
        if (genSessionRef.current === session) {
          setSectionGenErrors((p) => ({
            ...p,
            [sectionId]: err instanceof Error ? err.message : "Background generation failed.",
          }));
        }
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

  const runCollateralSummaryStream = useCallback(async () => {
    const sectionId = "collateral-summary";
    const collateralContent = collateralDocs.length ? buildCollateralContentForApi(collateralDocs) : "";
    const masterInput = rawNotes.trim();
    if (!collateralContent.trim() && masterInput.length < GENERATION_MIN_NOTES_CHARS) {
      setSectionGenErrors((p) => ({
        ...p,
        [sectionId]: GENERATION_MIN_NOTES_ERROR,
      }));
      return;
    }
    const contextNotes =
      masterInput.length >= GENERATION_MIN_NOTES_CHARS
        ? masterInput
        : collateralContent.trim().length >= GENERATION_MIN_NOTES_CHARS
          ? collateralContent
          : "";
    if (contextNotes.length < GENERATION_MIN_NOTES_CHARS) {
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
    setCollateralSummary("");
    try {
      await streamTexlexSse(
        "/api/generate/collateral-summary",
        {
          clientName: patientDetails.clientName,
          pronouns: patientDetails.pronouns,
          chronologicalAge: computeChronologicalAge(patientDetails.dob),
          yearLevel: patientDetails.yearLevel,
          rawNotes: contextNotes,
          collateralContent,
        },
        (delta) => setCollateralSummary((prev) => prev + delta),
        controller.signal
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("Collateral summary generation error:", err);
      if (genSessionRef.current === session) {
        setSectionGenErrors((p) => ({
          ...p,
          [sectionId]: err instanceof Error ? err.message : "Collateral summary generation failed.",
        }));
      }
    } finally {
      if (genSessionRef.current === session) {
        setGeneratingSectionId(null);
        streamAbortRef.current = null;
      }
    }
  }, [collateralDocs, patientDetails, rawNotes]);

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

  const runFunctionalImpactStream = useCallback(async () => {
    const sectionId = "functional-impact-summary";
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
    setFunctionalImpactSummary("");
    const criteriaState = buildCriteriaStateBlock(criteria);
    try {
      await streamTexlexSse(
        "/api/generate/functional-impact",
        {
          clientName: patientDetails.clientName,
          pronouns: patientDetails.pronouns,
          chronologicalAge: computeChronologicalAge(patientDetails.dob),
          yearLevel: patientDetails.yearLevel,
          rawNotes: masterInput,
          criteriaState,
          collateralSummary: collateralSummary.trim(),
        },
        (delta) => setFunctionalImpactSummary((prev) => prev + delta),
        controller.signal
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("Functional impact generation error:", err);
      if (genSessionRef.current === session) {
        setSectionGenErrors((p) => ({
          ...p,
          [sectionId]: err instanceof Error ? err.message : "Functional impact generation failed.",
        }));
      }
    } finally {
      if (genSessionRef.current === session) {
        setGeneratingSectionId(null);
        streamAbortRef.current = null;
      }
    }
  }, [collateralSummary, criteria, patientDetails, rawNotes]);

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

  const runFormulationStream = useCallback(async () => {
    const sectionId = "clinical-formulation";
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
    setClinicalFormulation("");
    const criteriaState = buildCriteriaStateBlock(criteria);
    try {
      await streamTexlexSse(
        "/api/generate/formulation",
        {
          clientName: patientDetails.clientName,
          pronouns: patientDetails.pronouns,
          chronologicalAge: computeChronologicalAge(patientDetails.dob),
          yearLevel: patientDetails.yearLevel,
          referringPractitioner: patientDetails.referringPractitioner,
          rawNotes: masterInput,
          criteriaState,
          collateralSummary: collateralSummary.trim(),
          functionalImpactSummary: functionalImpactSummary.trim(),
        },
        (delta) => setClinicalFormulation((prev) => prev + delta),
        controller.signal
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("Formulation generation error:", err);
      if (genSessionRef.current === session) {
        setSectionGenErrors((p) => ({
          ...p,
          [sectionId]: err instanceof Error ? err.message : "Formulation generation failed.",
        }));
      }
    } finally {
      if (genSessionRef.current === session) {
        setGeneratingSectionId(null);
        streamAbortRef.current = null;
      }
    }
  }, [collateralSummary, criteria, functionalImpactSummary, patientDetails, rawNotes]);

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
    const criteriaState = buildCriteriaStateBlock(criteria);
    try {
      await streamTexlexSse(
        "/api/generate/recommendations",
        {
          clientName: patientDetails.clientName,
          pronouns: patientDetails.pronouns,
          chronologicalAge: computeChronologicalAge(patientDetails.dob),
          yearLevel: patientDetails.yearLevel,
          referringPractitioner: patientDetails.referringPractitioner,
          rawNotes: masterInput,
          criteriaState,
          formulation: clinicalFormulation.trim(),
          functionalImpactSummary: functionalImpactSummary.trim(),
        },
        (delta) => setRecommendations((prev) => prev + delta),
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
  }, [clinicalFormulation, criteria, functionalImpactSummary, patientDetails, rawNotes]);

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
    [a1MatrixRow, generatingSectionId, handleGenerateCriterion, handleRegenerateCriterion, sectionGenErrors]
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
    };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setHydrated(true);
        return;
      }
      const data = JSON.parse(raw) as Partial<TexlexReportDraftV1>;
      if (data.patientDetails) setPatientDetails(() => migratePatientDetails(data.patientDetails));
      if (typeof data.rawNotes === "string") setRawNotes(data.rawNotes);
      if (Array.isArray(data.collateralDocs)) setCollateralDocs(migrateCollateralDocsFromStorage(data.collateralDocs));
      if (data.criteria) {
        setCriteria((c) => {
          const next = { ...c };
          for (const code of CRITERION_CODES) {
            const patch = data.criteria?.[code];
            if (patch) next[code] = { ...next[code], ...patch, code };
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
      if (typeof data.lastSaved === "string") setLastSavedAt(data.lastSaved);
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    setCriteria((prev) => {
      const next = { ...prev };
      for (const code of CRITERION_CODES) {
        const row = pipeline.dsmMatrix.find((r: { code: string }) => r.code === code) as
          | { count: number; status: string }
          | undefined;
        const count = row?.count ?? 0;
        const status = row?.status ?? "Missing";
        next[code] = {
          ...prev[code],
          markerCount: count,
          suggestedRating: suggestedRatingFromMatrix(count, status),
        };
      }
      return next;
    });
  }, [pipeline.dsmMatrix]);

  const persistPayload = useMemo((): TexlexReportDraftV1 => {
    const lastSaved = new Date().toISOString();
    return {
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
      lastSaved,
    };
  }, [
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
  ]);

  const saveDraftNow = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    try {
      const payload = { ...persistPayload, lastSaved: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      setLastSavedAt(payload.lastSaved);
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
    try {
      const [{ pdf }, { TexlexPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./pdf/TexlexPdfDocument"),
      ]);
      const { lastSaved: _lastSaved, rawNotes: _rawNotes, collateralDocs: _collateralDocs, ...draft } =
        persistPayload;
      const logoSrc = resolveTexlexPublicAsset(TEXLEX_LOGO_PATH);
      const signatureSrc = await resolveTexlexSignatureSrc();
      const blob = await pdf(
        <TexlexPdfDocument draft={draft} logoSrc={logoSrc} signatureSrc={signatureSrc} />
      ).toBlob();
      const stem = safeFilenamePart(draft.patientDetails.clientName);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${stem}-Texlex-Report.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Texlex PDF export failed:", error);
      window.alert("Could not prepare the PDF. Please try again.");
    } finally {
      setPdfDownloading(false);
    }
  }, [persistPayload]);

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

  useEffect(() => {
    if (!hydrated) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        const payload = { ...persistPayload, lastSaved: new Date().toISOString() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        setLastSavedAt(payload.lastSaved);
        setSaveFailed(false);
      } catch {
        setSaveFailed(true);
      }
    }, AUTO_SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [hydrated, persistPayload]);

  const editing = nowTick - lastEditAt < 2000 && lastEditAt > 0;
  const statusLabel = saveFailed
    ? "Save failed — retry"
    : editing
      ? "Editing..."
      : `Saved ${formatSavedAgo(lastSavedAt, nowTick)}`;

  const inputClass =
    "flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-[15px] leading-[1.55] shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="min-h-screen bg-background font-[family-name:var(--font-geist-sans,system-ui,Inter,sans-serif)] text-foreground">
      <header className="sticky top-0 z-10 border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-5 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight">Texlex Live Report Generator</h1>
              <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                Draft
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Clinician report surface · engine assistant in the right pane · auto-saves locally
            </p>
          </div>
          <div className="flex max-w-full shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span
                className={cn(
                  "text-sm text-muted-foreground",
                  saveFailed && "font-medium text-destructive",
                  editing && !saveFailed && "text-foreground"
                )}
              >
                {statusLabel}
              </span>
              {saveToast ? (
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-500" aria-live="polite">
                  Saved
                </span>
              ) : null}
              {saveFailed ? (
                <Button type="button" variant="outline" size="sm" onClick={() => saveDraftNow()}>
                  Retry
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button type="button" variant="default" size="sm" onClick={() => saveDraftNow()}>
                Save Draft
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleDownloadPdf()}
                disabled={pdfDownloading}
              >
                {pdfDownloading ? "Preparing PDF…" : "Download PDF"}
              </Button>
              <span className="inline-flex" title="Available after report sections are generated">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled
                  className="cursor-not-allowed bg-muted/60 text-muted-foreground opacity-80"
                >
                  Download DOCX
                </Button>
              </span>
              <span className="inline-flex" title="Available after report sections are generated">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled
                  className="cursor-not-allowed bg-muted/60 text-muted-foreground opacity-80"
                >
                  Email
                </Button>
              </span>
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/asd-engine">Engine dashboard</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px] gap-6 px-5 py-8">
        <nav className="hidden w-44 shrink-0 lg:block">
          <div className="sticky top-24 space-y-1 text-sm">
            {NAV.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="block rounded-lg px-2 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[760px] space-y-7 text-[15px] leading-[1.55]">
            <section id="report-header">
              <Card className="rounded-xl border border-border/80 bg-card shadow-sm">
                <CardContent className="space-y-3 p-6 text-center md:text-left">
                  <Badge variant="outline" className="font-semibold tracking-wide">
                    {TEXLEX_HEADER.confidential}
                  </Badge>
                  <p className="text-base font-semibold leading-snug text-foreground">{TEXLEX_HEADER.reportType}</p>
                  <p className="text-sm text-muted-foreground">{TEXLEX_HEADER.pathway}</p>
                </CardContent>
              </Card>
            </section>

            <section id="assessment-context">
              <h2 className="mb-3 text-lg font-semibold leading-tight">Assessment context</h2>
              <Card className="rounded-xl border border-border/80 bg-card shadow-sm">
                <CardContent className="p-6">
                  <div className="whitespace-pre-wrap text-[15px] leading-[1.55] text-muted-foreground">
                    {TEXLEX_ASSESSMENT_CONTEXT}
                  </div>
                </CardContent>
              </Card>
            </section>

            <section id="consent">
              <h2 className="mb-3 text-lg font-semibold leading-tight">Consent and use of report</h2>
              <Card className="rounded-xl border border-border/80 bg-card shadow-sm">
                <CardContent className="p-6">
                  <div className="whitespace-pre-wrap text-[15px] leading-[1.55] text-muted-foreground">
                    {TEXLEX_CONSENT}
                  </div>
                </CardContent>
              </Card>
            </section>

            <section id="patient-details">
              <h2 className="mb-3 text-lg font-semibold leading-tight">Patient details</h2>
              <Card className="rounded-xl border border-border/80 shadow-sm transition-shadow hover:shadow-md">
                <CardContent className="p-4 sm:p-6">
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

            <section id="raw-notes">
              <h2 className="mb-3 text-lg font-semibold leading-tight">Raw clinical notes</h2>
              <Card className="rounded-xl border border-border/80 shadow-sm transition-shadow hover:shadow-md">
                <CardContent className="p-6">
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
                      onClick={() => console.log("Generate Report from raw notes — triggers all sections")}
                    >
                      Generate Report
                    </Button>
                  </div>
                  <p className="mt-2 text-right text-xs text-muted-foreground">
                    Click to populate all editable sections from the raw notes above. Each section can also be generated
                    or regenerated individually.
                  </p>
                </CardContent>
              </Card>
            </section>

            <section id="presenting-concerns">
              <h2 className="mb-1 text-lg font-semibold leading-tight">Presenting concerns</h2>
              <Card className="mt-2 rounded-xl border border-border/80 shadow-sm transition-shadow hover:shadow-md">
                <CardContent className="p-6">
                  <label className="block space-y-1.5 text-sm font-medium">
                    Raw notes for this section (optional)
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
                  </label>
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

            <section id="background" className="space-y-4">
              <h2 className="mb-1 text-lg font-semibold leading-tight">Background</h2>
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
                return (
                <Card key={key} className="rounded-xl border border-border/80 shadow-sm transition-shadow hover:shadow-md">
                  <CardContent className="p-6">
                    <h3 className="text-base font-semibold">{label}</h3>
                    <label className="mt-2 block space-y-1.5 text-sm font-medium">
                      Raw notes for this section (optional)
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
                    </label>
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
                  </CardContent>
                </Card>
              );
              })}
            </section>

            <section id="collateral" className="space-y-4">
              <h2 className="mb-1 text-lg font-semibold leading-tight">Collateral documents</h2>
              <Card className="rounded-xl border border-border/80 shadow-sm transition-shadow hover:shadow-md">
                <CardContent className="p-6">
                  <CollateralDocumentsUpload
                    collateralDocs={collateralDocs}
                    setCollateralDocs={setCollateralDocs}
                    touch={touch}
                    inputClass={inputClass}
                  />
                </CardContent>
              </Card>
              <Card className="rounded-xl border border-border/80 shadow-sm transition-shadow hover:shadow-md">
                <CardContent className="p-6">
                  <h3 className="text-base font-semibold">Collateral summary</h3>
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
                      sectionGenErrors["collateral-summary"] ? (
                        <p className="mt-2 w-full basis-full text-sm text-destructive" role="alert">
                          {sectionGenErrors["collateral-summary"]}
                        </p>
                      ) : null
                    }
                  />
                </CardContent>
              </Card>
            </section>

            <section id="dsm-criteria" className="space-y-6">
              <h2 className="text-lg font-semibold leading-tight">DSM-5-TR criteria (A &amp; B)</h2>
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
            </section>

            <section id="functional-impact">
              <h2 className="mb-3 text-lg font-semibold leading-tight">Functional impact summary</h2>
              <Card className="rounded-xl border border-border/80 shadow-sm transition-shadow hover:shadow-md">
                <CardContent className="p-6">
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
                      sectionGenErrors["functional-impact-summary"] ? (
                        <p className="mt-2 w-full basis-full text-sm text-destructive" role="alert">
                          {sectionGenErrors["functional-impact-summary"]}
                        </p>
                      ) : null
                    }
                  />
                </CardContent>
              </Card>
            </section>

            <section id="formulation">
              <h2 className="mb-3 text-lg font-semibold leading-tight">Clinical formulation and consensus opinion</h2>
              <Card className="rounded-xl border border-border/80 shadow-sm transition-shadow hover:shadow-md">
                <CardContent className="p-6">
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
                      sectionGenErrors["clinical-formulation"] ? (
                        <p className="mt-2 w-full basis-full text-sm text-destructive" role="alert">
                          {sectionGenErrors["clinical-formulation"]}
                        </p>
                      ) : null
                    }
                  />
                </CardContent>
              </Card>
            </section>

            <section id="recommendations">
              <h2 className="mb-3 text-lg font-semibold leading-tight">Recommendations</h2>
              <Card className="rounded-xl border border-border/80 shadow-sm transition-shadow hover:shadow-md">
                <CardContent className="p-6">
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
                      sectionGenErrors["recommendations"] ? (
                        <p className="mt-2 w-full basis-full text-sm text-destructive" role="alert">
                          {sectionGenErrors["recommendations"]}
                        </p>
                      ) : null
                    }
                  />
                </CardContent>
              </Card>
            </section>

            <section id="limitations">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold leading-tight">Limitations</h2>
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
              <Card className="rounded-xl border border-border/80 bg-card shadow-sm">
                <CardContent className="p-6">
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
              <h2 className="mb-3 text-lg font-semibold leading-tight">Signature block</h2>
              <Card className="rounded-xl border border-border/80 bg-card shadow-sm">
                <CardContent className="p-6">
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
    </div>
  );
}
