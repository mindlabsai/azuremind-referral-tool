"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { SignOutButton } from "@/components/SignOutButton";
import { cn } from "@/lib/utils";
import type { ClinikoDraftState } from "@/lib/texlex-cliniko-sync";
import {
  clearEngineActiveDraftPointer,
  clearLocalEngineDraft,
  draftMatchesStorageKey,
  engineLocalDraftKey,
  formatLocalDraftClockTime,
  readEngineActiveDraftKey,
  readLocalEngineDraft,
  writeLocalEngineDraft,
} from "@/lib/engine-draft-storage";
import {
  fetchReportStateForEngine,
  formatDraftSavedAgo,
  saveReportStateForEngine,
} from "@/lib/texlex-report-state";
import { ClinikoIntakeCard } from "../../asd-engine/report/components/ClinikoIntakeCard";
import {
  CollateralDocumentsUpload,
  migrateCollateralDocsFromStorage,
  serialiseCollateralDocsForStorage,
  type CollateralDoc,
} from "../../asd-engine/report/components/CollateralDocumentsUpload";
import { NewReportConfirmModal } from "../../asd-engine/report/components/NewReportConfirmModal";
import { TexlexSectionHeading } from "../../asd-engine/report/components/TexlexSectionHeading";
import { ADHD_CRITERIA } from "../../asd-engine/adhd-engine-core";
import {
  useAdhdEnginePipeline,
  type AdhdClinicianInput,
  type AdhdCriterionState,
  type DivaState,
} from "../../asd-engine/adhd-pipeline";
import { formatExpandedRecommendations, parseRecommendationShorthand } from "../../asd-engine/adhd-recommendations";
import type { PatientDetails as AsdPatientDetails } from "../../asd-engine/report/page";
import {
  buildCollateralManifestForApi,
  buildCollateralPdfPayload,
} from "@/lib/collateral/collateral-docs-client";
import { TEXLEX_LIMITATIONS } from "@/app/asd-engine/report/constants/texlexBoilerplate";
import {
  resolveTexlexPublicAsset,
  resolveTexlexSignatureSrc,
  TEXLEX_LOGO_PATH,
} from "@/app/asd-engine/report/pdf/assets";
import { safeFilenamePart } from "@/app/asd-engine/report/pdf/utils";
import type { AdhdPdfDraft, AssessmentModality } from "./pdf/types";

type AttendingParent = "mother" | "father";

function possessiveFromPronouns(pronouns: string): string {
  const p = pronouns.trim().toLowerCase();
  if (p.includes("she") || p.includes("her")) return "her";
  if (p.includes("they") || p.includes("them")) return "their";
  return "his";
}

function formatAttendingParentsPhrase(
  attending: AttendingParent[],
  pronouns: string
): string {
  const poss = possessiveFromPronouns(pronouns);
  const hasMother = attending.includes("mother");
  const hasFather = attending.includes("father");
  if (hasMother && hasFather) return `${poss} mother and father`;
  if (hasMother) return `${poss} mother`;
  if (hasFather) return `${poss} father`;
  return "";
}

function modalityLabel(modality: AssessmentModality): string {
  if (modality === "in-clinic") return "In-clinic";
  if (modality === "virtual") return "Virtual (video)";
  return "";
}

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
  school: string;
  reportDate: string;
  yearLevel: string;
  assessor: string;
  phone: string;
  address: string;
  pronouns: string;
  assessmentDates: string[];
};

const DEFAULT_ASSESSOR =
  "Vishal Maharaj, Registered Psychologist, PSY0001579010, Azure Mind";

const AUTO_SAVE_DEBOUNCE_MS = 1500;

const INPUT_CLASS =
  "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-base leading-[1.55] shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const NARRATIVE_SECTIONS = [
  {
    id: "presenting-concerns",
    label: "Presenting concerns",
    route: "/api/generate/presenting-concerns",
  },
  {
    id: "background-pregnancy-birth",
    label: "Background: pregnancy and birth",
    route: "/api/generate/background-pregnancy-birth",
  },
  {
    id: "background-early-development",
    label: "Background: early development",
    route: "/api/generate/background-early-development",
  },
  {
    id: "background-educational-history",
    label: "Background: educational history",
    route: "/api/generate/background-educational-history",
  },
  {
    id: "background-emotional-behavioural-sensory",
    label: "Background: emotional, behavioural and sensory",
    route: "/api/generate/background-emotional-behavioural-sensory",
  },
  {
    id: "collateral-summary",
    label: "Collateral summary",
    route: "/api/generate/collateral-summary",
  },
] as const;

const RECOMMENDATIONS_SECTION = {
  id: "recommendations",
  label: "Recommendations",
  route: "/api/generate/recommendations",
} as const;

const SHARED_SECTIONS = [...NARRATIVE_SECTIONS, RECOMMENDATIONS_SECTION] as const;

type SectionId = (typeof SHARED_SECTIONS)[number]["id"];

function todayIso(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
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
    assessmentType: "ADHD",
    assessmentDates: [],
    school: "",
    reportDate: todayIso(),
    yearLevel: "",
    assessor: DEFAULT_ASSESSOR,
    phone: "",
    address: "",
    pronouns: "",
  };
}

/** Fresh demographics after New report / Change patient — preserve assessor + report date only. */
function patientDetailsAfterNewReport(): PatientDetails {
  return {
    ...emptyPatientDetails(),
    assessor: DEFAULT_ASSESSOR,
    reportDate: todayIso(),
  };
}

function emptySectionGenerating(): Record<SectionId, boolean> {
  return {
    "presenting-concerns": false,
    "background-pregnancy-birth": false,
    "background-early-development": false,
    "background-educational-history": false,
    "background-emotional-behavioural-sensory": false,
    "collateral-summary": false,
    recommendations: false,
  };
}

function isAdhdDraftEffectivelyEmpty(args: {
  patientDetails: PatientDetails;
  cliniko: ClinikoDraftState | null;
  rawNotes: string;
  collateralDocs: CollateralDoc[];
  divaState: DivaState;
  criteriaStates: Record<string, AdhdCriterionState>;
  severityStated: string;
  asdActive: boolean;
  clinicianStatedFraming: string;
  mentalHealthFraming: string;
  mentalHealthGreenLight: boolean;
  recommendationShorthand: string;
  medicationWanted: boolean;
  assessmentDate: string;
  assessmentModality: AssessmentModality;
  attendingParents: AttendingParent[];
  formulation: string;
  sectionTexts: Record<SectionId, string>;
}): boolean {
  const {
    patientDetails,
    cliniko,
    rawNotes,
    collateralDocs,
    divaState,
    criteriaStates,
    severityStated,
    asdActive,
    clinicianStatedFraming,
    mentalHealthFraming,
    mentalHealthGreenLight,
    recommendationShorthand,
    medicationWanted,
    assessmentDate,
    assessmentModality,
    attendingParents,
    formulation,
    sectionTexts,
  } = args;

  if (cliniko) return false;
  if (rawNotes.trim()) return false;
  if (collateralDocs.length > 0) return false;
  if (divaState !== "not-administered") return false;
  if (Object.values(criteriaStates).some((state) => state !== "unset")) return false;
  if (severityStated.trim()) return false;
  if (asdActive) return false;
  if (clinicianStatedFraming.trim()) return false;
  if (mentalHealthFraming.trim()) return false;
  if (mentalHealthGreenLight) return false;
  if (recommendationShorthand.trim()) return false;
  if (medicationWanted) return false;
  if (assessmentDate.trim()) return false;
  if (assessmentModality) return false;
  if (attendingParents.length > 0) return false;
  if (formulation.trim()) return false;
  if (Object.values(sectionTexts).some((text) => text.trim())) return false;

  const d = patientDetails;
  if (
    d.clientName.trim() ||
    d.parent1.trim() ||
    d.parent2.trim() ||
    d.parent1Relationship.trim() ||
    d.parent2Relationship.trim() ||
    d.dob.trim() ||
    d.referringPractitioner.trim() ||
    d.referringPractitionerType.trim() ||
    d.referringPractitionerEmail.trim() ||
    d.school.trim() ||
    d.yearLevel.trim() ||
    d.phone.trim() ||
    d.address.trim() ||
    d.pronouns.trim()
  ) {
    return false;
  }

  return true;
}

function AdhdHeaderOverflowMenu({
  pdfDownloading,
  bulkRunning,
  onNewReport,
  onSaveDraft,
}: {
  pdfDownloading: boolean;
  bulkRunning: boolean;
  onNewReport: () => void;
  onSaveDraft: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="More actions"
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-border/80 bg-background px-2 text-base leading-none text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        ···
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 min-w-[11rem] rounded-md border border-border/80 bg-background py-1 shadow-md"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={pdfDownloading || bulkRunning}
            onClick={() => {
              setOpen(false);
              onNewReport();
            }}
          >
            New Report
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={bulkRunning}
            onClick={() => {
              setOpen(false);
              onSaveDraft();
            }}
          >
            Save Draft
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ageYearsFromDob(dob: string): number {
  if (!dob) return 0;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const mo = now.getMonth() - d.getMonth();
  if (mo < 0 || (mo === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

function chronologicalAgeLabel(dob: string): string {
  const years = ageYearsFromDob(dob);
  if (!dob || years <= 0) return "";
  return `${years} years`;
}

async function streamSse(
  url: string,
  body: Record<string, unknown>,
  onDelta: (delta: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
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
        const parsed = JSON.parse(data) as { delta?: string; error?: string };
        if (parsed.error) throw new Error(parsed.error);
        if (typeof parsed.delta === "string" && parsed.delta.length) {
          onDelta(parsed.delta);
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
}

function CriterionRow({
  code,
  label,
  state,
  onChange,
}: {
  code: string;
  label: string;
  state: AdhdCriterionState;
  onChange: (s: AdhdCriterionState) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 py-2">
      <div className="min-w-0">
        <span className="text-base font-medium text-foreground">{code}</span>
        <span className="ml-2 text-base text-muted-foreground">{label}</span>
      </div>
      <div className="flex shrink-0 gap-1">
        {(["met", "not-met", "unset"] as AdhdCriterionState[]).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              "rounded px-2 py-0.5 text-xs",
              state === opt
                ? opt === "met"
                  ? "bg-emerald-600 text-white"
                  : opt === "not-met"
                    ? "bg-slate-600 text-white"
                    : "bg-muted text-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            {opt === "met" ? "Met" : opt === "not-met" ? "Not met" : "Unset"}
          </button>
        ))}
      </div>
    </div>
  );
}

function DetailField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1 text-base">
      <span className="text-muted-foreground">{label}</span>
      <input
        className={INPUT_CLASS}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

type AdhdSavedState = {
  engine?: string;
  patientDetails?: Partial<PatientDetails>;
  cliniko?: ClinikoDraftState | null;
  rawNotes?: string;
  divaState?: DivaState;
  criteriaStates?: Record<string, AdhdCriterionState>;
  severityStated?: string;
  asdActive?: boolean;
  clinicianStatedFraming?: string;
  mentalHealthFraming?: string;
  mentalHealthGreenLight?: boolean;
  recommendationShorthand?: string;
  medicationWanted?: boolean;
  assessmentDate?: string;
  assessmentModality?: AssessmentModality;
  attendingParents?: AttendingParent[];
  formulation?: string;
  sectionTexts?: Partial<Record<SectionId, string>>;
  sectionText?: Partial<Record<SectionId, string>>;
  collateralDocs?: unknown;
  lastSaved?: string;
};

function adhdSavedStateHasResumableContent(state: AdhdSavedState): boolean {
  if (typeof state.rawNotes === "string" && state.rawNotes.trim()) return true;
  if (typeof state.formulation === "string" && state.formulation.trim()) return true;
  if (typeof state.recommendationShorthand === "string" && state.recommendationShorthand.trim()) {
    return true;
  }
  if (typeof state.severityStated === "string" && state.severityStated.trim()) return true;
  if (typeof state.clinicianStatedFraming === "string" && state.clinicianStatedFraming.trim()) {
    return true;
  }
  if (typeof state.mentalHealthFraming === "string" && state.mentalHealthFraming.trim()) return true;
  if (state.divaState && state.divaState !== "not-administered") return true;
  if (state.asdActive || state.mentalHealthGreenLight || state.medicationWanted) return true;
  if (typeof state.assessmentDate === "string" && state.assessmentDate.trim()) return true;
  if (state.assessmentModality) return true;
  if (Array.isArray(state.attendingParents) && state.attendingParents.length > 0) return true;
  if (
    state.criteriaStates &&
    Object.values(state.criteriaStates).some((value) => value && value !== "unset")
  ) {
    return true;
  }
  const sections = state.sectionTexts ?? state.sectionText;
  if (sections && Object.values(sections).some((text) => typeof text === "string" && text.trim())) {
    return true;
  }
  if (Array.isArray(state.collateralDocs) && state.collateralDocs.length > 0) return true;
  if (state.cliniko?.patientId) return true;
  const d = state.patientDetails;
  if (
    d &&
    (d.clientName?.trim() ||
      d.parent1?.trim() ||
      d.dob?.trim() ||
      d.school?.trim() ||
      d.yearLevel?.trim())
  ) {
    return true;
  }
  return false;
}

/** Clinical working content only — ignores Cliniko link and demographics. */
function adhdHasClinicalWorkingContent(args: {
  rawNotes: string;
  collateralDocs: CollateralDoc[];
  divaState: DivaState;
  criteriaStates: Record<string, AdhdCriterionState>;
  severityStated: string;
  asdActive: boolean;
  clinicianStatedFraming: string;
  mentalHealthFraming: string;
  mentalHealthGreenLight: boolean;
  recommendationShorthand: string;
  medicationWanted: boolean;
  assessmentDate: string;
  assessmentModality: AssessmentModality;
  attendingParents: AttendingParent[];
  formulation: string;
  sectionTexts: Record<SectionId, string>;
}): boolean {
  if (args.rawNotes.trim()) return true;
  if (args.collateralDocs.length > 0) return true;
  if (args.divaState !== "not-administered") return true;
  if (Object.values(args.criteriaStates).some((state) => state && state !== "unset")) return true;
  if (args.severityStated.trim()) return true;
  if (args.asdActive) return true;
  if (args.clinicianStatedFraming.trim()) return true;
  if (args.mentalHealthFraming.trim()) return true;
  if (args.mentalHealthGreenLight) return true;
  if (args.recommendationShorthand.trim()) return true;
  if (args.medicationWanted) return true;
  if (args.assessmentDate.trim()) return true;
  if (args.assessmentModality) return true;
  if (args.attendingParents.length > 0) return true;
  if (args.formulation.trim()) return true;
  if (Object.values(args.sectionTexts).some((text) => text.trim())) return true;
  return false;
}

function emptySectionTexts(): Record<SectionId, string> {
  return {
    "presenting-concerns": "",
    "background-pregnancy-birth": "",
    "background-early-development": "",
    "background-educational-history": "",
    "background-emotional-behavioural-sensory": "",
    "collateral-summary": "",
    recommendations: "",
  };
}

export default function AdhdReportPage() {
  const [patientDetails, setPatientDetails] = useState<PatientDetails>(emptyPatientDetails);
  const [cliniko, setCliniko] = useState<ClinikoDraftState | null>(null);
  const [rawNotes, setRawNotes] = useState("");
  const [collateralDocs, setCollateralDocs] = useState<CollateralDoc[]>([]);
  const [clinikoNotice, setClinikoNotice] = useState<string | null>(null);
  const [clinikoIntakeResetKey, setClinikoIntakeResetKey] = useState(0);

  const [sectionTexts, setSectionTexts] = useState<Record<SectionId, string>>(emptySectionTexts);
  const [sectionGenerating, setSectionGenerating] =
    useState<Record<SectionId, boolean>>(emptySectionGenerating);
  const sectionAbortRef = useRef<AbortController | null>(null);
  const lastHydratedPatientIdRef = useRef<string | null>(null);

  const [divaState, setDivaState] = useState<DivaState>("not-administered");
  const [criteriaStates, setCriteriaStates] = useState<Record<string, AdhdCriterionState>>({});
  const [severityStated, setSeverityStated] = useState("");
  const [asdActive, setAsdActive] = useState(false);
  const [clinicianStatedFraming, setClinicianStatedFraming] = useState("");
  const [mentalHealthFraming, setMentalHealthFraming] = useState("");
  const [mentalHealthGreenLight, setMentalHealthGreenLight] = useState(false);
  const [recommendationShorthand, setRecommendationShorthand] = useState("");
  const [medicationWanted, setMedicationWanted] = useState(false);
  const [assessmentDate, setAssessmentDate] = useState("");
  const [assessmentModality, setAssessmentModality] = useState<AssessmentModality>("");
  const [attendingParents, setAttendingParents] = useState<AttendingParent[]>([]);

  const [formulation, setFormulation] = useState("");
  const [formulationGenerating, setFormulationGenerating] = useState(false);

  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkLabel, setBulkLabel] = useState("");
  const [pdfDownloading, setPdfDownloading] = useState(false);

  const [saveFailed, setSaveFailed] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [lastEditAt, setLastEditAt] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  /** Last successful Supabase confirmed-save — used for beforeunload dirty check. */
  const [lastCloudSavedAt, setLastCloudSavedAt] = useState<string | null>(null);
  const [localDraftRestoredNotice, setLocalDraftRestoredNotice] = useState<{
    lastSaved: string;
    storageKey: string;
  } | null>(null);
  const [newReportModalOpen, setNewReportModalOpen] = useState(false);
  const [skipNewReportConfirmSession, setSkipNewReportConfirmSession] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [draftResumePrompt, setDraftResumePrompt] = useState<{
    patientLabel: string;
    lastSavedLabel: string;
    stored: AdhdSavedState;
    patientId: string;
  } | null>(null);
  const localDraftHydratedRef = useRef(false);
  const suppressAutosaveRef = useRef(false);
  const localDraftKeyRef = useRef(engineLocalDraftKey("adhd", null));

  const touch = useCallback(() => setLastEditAt(Date.now()), []);

  const draftIsEffectivelyEmpty = useMemo(
    () =>
      isAdhdDraftEffectivelyEmpty({
        patientDetails,
        cliniko,
        rawNotes,
        collateralDocs,
        divaState,
        criteriaStates,
        severityStated,
        asdActive,
        clinicianStatedFraming,
        mentalHealthFraming,
        mentalHealthGreenLight,
        recommendationShorthand,
        medicationWanted,
        assessmentDate,
        assessmentModality,
        attendingParents,
        formulation,
        sectionTexts,
      }),
    [
      patientDetails,
      cliniko,
      rawNotes,
      collateralDocs,
      divaState,
      criteriaStates,
      severityStated,
      asdActive,
      clinicianStatedFraming,
      mentalHealthFraming,
      mentalHealthGreenLight,
      recommendationShorthand,
      medicationWanted,
      assessmentDate,
      assessmentModality,
      attendingParents,
      formulation,
      sectionTexts,
    ]
  );

  const input = useMemo<AdhdClinicianInput>(
    () => ({
      childName: patientDetails.clientName || "the child",
      ageYears: ageYearsFromDob(patientDetails.dob),
      chronologicalAgeLabel: chronologicalAgeLabel(patientDetails.dob),
      yearLevel: patientDetails.yearLevel,
      school: patientDetails.school,
      parent1: patientDetails.parent1,
      parent2: patientDetails.parent2,
      parent1Relationship: patientDetails.parent1Relationship,
      parent2Relationship: patientDetails.parent2Relationship,
      attendingParents,
      assessmentDate,
      assessmentModality: modalityLabel(assessmentModality),
      divaState,
      criteriaStates,
      severityStated: severityStated.trim() || null,
      asdActive,
      clinicianStatedFraming,
      mentalHealthFraming: mentalHealthFraming.trim() || null,
      recommendationShorthand: parseRecommendationShorthand(recommendationShorthand),
      medicationWanted,
      mentalHealthGreenLight,
    }),
    [
      patientDetails.clientName,
      patientDetails.dob,
      patientDetails.yearLevel,
      patientDetails.school,
      patientDetails.parent1,
      patientDetails.parent2,
      patientDetails.parent1Relationship,
      patientDetails.parent2Relationship,
      attendingParents,
      assessmentDate,
      assessmentModality,
      divaState,
      criteriaStates,
      severityStated,
      asdActive,
      clinicianStatedFraming,
      mentalHealthFraming,
      recommendationShorthand,
      medicationWanted,
      mentalHealthGreenLight,
    ]
  );

  const pipeline = useAdhdEnginePipeline(rawNotes, input);

  const inattention = useMemo(
    () => ADHD_CRITERIA.filter((c) => /^IA/i.test(c.code)),
    []
  );
  const hyperactivity = useMemo(
    () => ADHD_CRITERIA.filter((c) => /^HI/i.test(c.code)),
    []
  );

  const setCriterion = useCallback((code: string, state: AdhdCriterionState) => {
    touch();
    setCriteriaStates((prev) => ({ ...prev, [code]: state }));
  }, [touch]);

  const collateralPayload = useMemo(
    () => ({
      collateralContent: buildCollateralManifestForApi(collateralDocs),
      ...buildCollateralPdfPayload(collateralDocs),
    }),
    [collateralDocs]
  );

  const generationBody = useMemo(
    () => ({
      clientName: patientDetails.clientName,
      pronouns: patientDetails.pronouns,
      chronologicalAge: chronologicalAgeLabel(patientDetails.dob),
      yearLevel: patientDetails.yearLevel,
      school: patientDetails.school,
      parent1: patientDetails.parent1,
      parent2: patientDetails.parent2,
      parent1Relationship: patientDetails.parent1Relationship,
      parent2Relationship: patientDetails.parent2Relationship,
      attendingParents,
      assessmentDate,
      assessmentModality: modalityLabel(assessmentModality),
      dob: patientDetails.dob,
      rawNotes,
      ...collateralPayload,
    }),
    [
      patientDetails.clientName,
      patientDetails.pronouns,
      patientDetails.dob,
      patientDetails.yearLevel,
      patientDetails.school,
      patientDetails.parent1,
      patientDetails.parent2,
      patientDetails.parent1Relationship,
      patientDetails.parent2Relationship,
      attendingParents,
      assessmentDate,
      assessmentModality,
      rawNotes,
      collateralPayload,
    ]
  );

  const clinicianLock = useMemo(
    () => ({
      childName: patientDetails.clientName,
      chronologicalAge: chronologicalAgeLabel(patientDetails.dob),
      ageYears: ageYearsFromDob(patientDetails.dob),
      yearLevel: patientDetails.yearLevel,
      school: patientDetails.school,
      parent1: patientDetails.parent1,
      parent2: patientDetails.parent2,
      parent1Relationship: patientDetails.parent1Relationship,
      parent2Relationship: patientDetails.parent2Relationship,
      attendingParents,
      assessmentDate,
      assessmentModality: modalityLabel(assessmentModality),
      divaState,
      presentation:
        divaState === "negative"
          ? "ADHD not met"
          : divaState === "not-administered"
            ? null
            : pipeline.presentation.presentation,
      severityStated: severityStated.trim() || null,
      criteriaStates,
      inattentionMet: pipeline.counts.inattentionMet,
      inattentionTotal: pipeline.counts.inattentionTotal,
      hyperactivityMet: pipeline.counts.hyperactivityMet,
      hyperactivityTotal: pipeline.counts.hyperactivityTotal,
      threshold: pipeline.presentation.threshold,
    }),
    [
      patientDetails.clientName,
      patientDetails.dob,
      patientDetails.yearLevel,
      patientDetails.school,
      patientDetails.parent1,
      patientDetails.parent2,
      patientDetails.parent1Relationship,
      patientDetails.parent2Relationship,
      attendingParents,
      assessmentDate,
      assessmentModality,
      divaState,
      severityStated,
      criteriaStates,
      pipeline.presentation.presentation,
      pipeline.presentation.threshold,
      pipeline.counts.inattentionMet,
      pipeline.counts.inattentionTotal,
      pipeline.counts.hyperactivityMet,
      pipeline.counts.hyperactivityTotal,
    ]
  );

  const generateSection = useCallback(
    async (sectionId: SectionId, route: string) => {
      sectionAbortRef.current?.abort();
      const controller = new AbortController();
      sectionAbortRef.current = controller;

      setSectionGenerating((prev) => ({ ...prev, [sectionId]: true }));
      setSectionTexts((prev) => ({ ...prev, [sectionId]: "" }));

      try {
        await streamSse(
          route,
          generationBody,
          (delta) => {
            setSectionTexts((prev) => ({
              ...prev,
              [sectionId]: prev[sectionId] + delta,
            }));
          },
          controller.signal
        );
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Generation failed";
        setSectionTexts((prev) => ({
          ...prev,
          [sectionId]: prev[sectionId] || message,
        }));
      } finally {
        setSectionGenerating((prev) => ({ ...prev, [sectionId]: false }));
      }
    },
    [generationBody]
  );

  const generateFormulation = useCallback(async () => {
    setFormulationGenerating(true);
    setFormulation("");
    try {
      const res = await fetch("/api/generate/adhd-formulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: pipeline.formulationPrompt,
          clientName: patientDetails.clientName,
          rawNotes,
          clinicianLock,
          ...collateralPayload,
        }),
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || data.error) {
        throw new Error(data.error || "Formulation generation failed");
      }
      if (data.text) setFormulation(data.text);
    } catch (err) {
      setFormulation(err instanceof Error ? err.message : "Formulation generation failed");
    } finally {
      setFormulationGenerating(false);
    }
  }, [
    clinicianLock,
    collateralPayload,
    pipeline.formulationPrompt,
    patientDetails.clientName,
    rawNotes,
  ]);

  const generateRecommendationsFromShorthand = useCallback(() => {
    const items = pipeline.recommendations;
    if (!items.length) {
      setClinikoNotice(
        "Enter recommendation shorthand first (comma or line separated). Output will contain exactly those items only."
      );
      return;
    }
    touch();
    setSectionTexts((prev) => ({
      ...prev,
      recommendations: formatExpandedRecommendations(items),
    }));
    setClinikoNotice(
      `Expanded exactly ${items.length} recommendation item(s) from your shorthand. Nothing else was added.`
    );
  }, [pipeline.recommendations, touch]);

  const generateAllSections = useCallback(async () => {
    const hasReadyPdf = collateralPayload.collateralPdfDocuments.length > 0;
    if (rawNotes.trim().length < 20 && !hasReadyPdf) {
      setClinikoNotice(
        "Raw clinical notes need at least 20 characters, or upload a ready PDF, before generating."
      );
      return;
    }
    const totalSteps = NARRATIVE_SECTIONS.length + 2;
    setBulkRunning(true);
    setBulkLabel(`Generating 1 of ${totalSteps} - ${NARRATIVE_SECTIONS[0]!.label}`);
    try {
      for (let i = 0; i < NARRATIVE_SECTIONS.length; i++) {
        const section = NARRATIVE_SECTIONS[i]!;
        setBulkLabel(`Generating ${i + 1} of ${totalSteps} - ${section.label}`);
        await generateSection(section.id, section.route);
      }
      setBulkLabel(`Generating ${NARRATIVE_SECTIONS.length + 1} of ${totalSteps} - Formulation`);
      await generateFormulation();
      setBulkLabel(`Generating ${totalSteps} of ${totalSteps} - Recommendations`);
      generateRecommendationsFromShorthand();
    } catch (err) {
      setClinikoNotice(err instanceof Error ? err.message : "Generate all failed");
    } finally {
      setBulkRunning(false);
      setBulkLabel("");
    }
  }, [
    collateralPayload.collateralPdfDocuments.length,
    generateFormulation,
    generateRecommendationsFromShorthand,
    generateSection,
    rawNotes,
  ]);

  const buildSaveState = useCallback(
    () => ({
      engine: "adhd" as const,
      patientDetails,
      cliniko,
      rawNotes,
      collateralDocs: serialiseCollateralDocsForStorage(collateralDocs),
      sectionTexts,
      sectionText: sectionTexts,
      divaState,
      criteriaStates,
      severityStated,
      asdActive,
      clinicianStatedFraming,
      mentalHealthFraming,
      mentalHealthGreenLight,
      recommendationShorthand,
      medicationWanted,
      assessmentDate,
      assessmentModality,
      attendingParents,
      formulation,
      lastSaved: new Date().toISOString(),
    }),
    [
      patientDetails,
      cliniko,
      rawNotes,
      collateralDocs,
      sectionTexts,
      divaState,
      criteriaStates,
      severityStated,
      asdActive,
      clinicianStatedFraming,
      mentalHealthFraming,
      mentalHealthGreenLight,
      recommendationShorthand,
      medicationWanted,
      assessmentDate,
      assessmentModality,
      attendingParents,
      formulation,
    ]
  );

  const persistLocalDraftNow = useCallback(
    (state: ReturnType<typeof buildSaveState> = buildSaveState()) => {
      const key = engineLocalDraftKey("adhd", state.cliniko?.patientId ?? cliniko?.patientId);
      // Never write a linked patient's state into the unassigned key, or vice versa.
      if (!draftMatchesStorageKey("adhd", key, state)) return false;
      if (!adhdSavedStateHasResumableContent(state)) {
        return true;
      }
      const result = writeLocalEngineDraft("adhd", key, state);
      if (result.ok) {
        localDraftKeyRef.current = key;
        setLastSavedAt(result.lastSaved);
        setSaveFailed(false);
        // When work is keyed to a patient, drop the unassigned safety net so remount
        // cannot restore a stale pre-link draft.
        if (state.cliniko?.patientId) {
          clearLocalEngineDraft(engineLocalDraftKey("adhd", null));
        }
      } else {
        setSaveFailed(true);
      }
      return result.ok;
    },
    [buildSaveState, cliniko?.patientId]
  );

  const saveReport = useCallback(async (): Promise<boolean> => {
    const patientId = cliniko?.patientId;
    if (!patientId) {
      setSaveFailed(true);
      setSaveStatus("idle");
      setClinikoNotice("Load a Cliniko patient before saving the draft.");
      return false;
    }
    setSaveStatus("saving");
    try {
      const state = buildSaveState();
      persistLocalDraftNow(state);
      const ok = await saveReportStateForEngine("adhd", patientId, state);
      if (!ok) {
        setSaveFailed(true);
        setSaveStatus("idle");
        return false;
      }
      setSaveFailed(false);
      setSaveStatus("saved");
      setLastSavedAt(state.lastSaved);
      setLastCloudSavedAt(state.lastSaved);
      return true;
    } catch {
      setSaveFailed(true);
      setSaveStatus("idle");
      return false;
    }
  }, [buildSaveState, cliniko?.patientId, persistLocalDraftNow]);

  /** Persist current draft when a Cliniko patient is linked; no-op success if none. */
  const persistDraftBeforeSwitch = useCallback(async (): Promise<boolean> => {
    if (!cliniko?.patientId) return true;
    return saveReport();
  }, [cliniko?.patientId, saveReport]);

  /**
   * Complete state reset — every clinical field back to empty/defaults.
   * Assessor and report date are preserved (ASD New Report behaviour).
   */
  const clearRelevantLocalDraftKeys = useCallback((patientId: string | null | undefined) => {
    clearLocalEngineDraft(engineLocalDraftKey("adhd", patientId));
    clearLocalEngineDraft(engineLocalDraftKey("adhd", null));
    clearEngineActiveDraftPointer("adhd");
    localDraftKeyRef.current = engineLocalDraftKey("adhd", null);
  }, []);

  const resetAllReportState = useCallback(() => {
    sectionAbortRef.current?.abort();
    sectionAbortRef.current = null;
    lastHydratedPatientIdRef.current = null;
    suppressAutosaveRef.current = true;

    setPatientDetails(patientDetailsAfterNewReport());
    setCliniko(null);
    setClinikoIntakeResetKey((key) => key + 1);
    setRawNotes("");
    setCollateralDocs([]);
    setSectionTexts(emptySectionTexts());
    setSectionGenerating(emptySectionGenerating());
    setDivaState("not-administered");
    setCriteriaStates({});
    setSeverityStated("");
    setAsdActive(false);
    setClinicianStatedFraming("");
    setMentalHealthFraming("");
    setMentalHealthGreenLight(false);
    setRecommendationShorthand("");
    setMedicationWanted(false);
    setAssessmentDate("");
    setAssessmentModality("");
    setAttendingParents([]);
    setFormulation("");
    setFormulationGenerating(false);
    setBulkRunning(false);
    setBulkLabel("");
    setSaveFailed(false);
    setSaveStatus("idle");
    setLastEditAt(0);
    setLastSavedAt(null);
    setLastCloudSavedAt(null);
    setLocalDraftRestoredNotice(null);
    setDraftResumePrompt(null);
    setClinikoNotice(null);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const startNewReport = useCallback(async () => {
    setWorkflowBusy(true);
    const hadLinkedPatient = Boolean(cliniko?.patientId);
    const previousPatientId = cliniko?.patientId ?? null;
    try {
      const saved = await persistDraftBeforeSwitch();
      if (!saved) {
        setClinikoNotice(
          "Could not save the current draft. Fix save or retry before starting a new report."
        );
        return;
      }
      // Cloud save keeps the prior patient draft; clear local safety-net keys for a clean slate.
      clearRelevantLocalDraftKeys(previousPatientId);
      resetAllReportState();
      setClinikoNotice(
        hadLinkedPatient
          ? "New report started. Previous draft saved for the prior Cliniko patient."
          : "New report started."
      );
    } finally {
      setWorkflowBusy(false);
    }
  }, [
    clearRelevantLocalDraftKeys,
    cliniko?.patientId,
    persistDraftBeforeSwitch,
    resetAllReportState,
  ]);

  const handleNewReportClick = useCallback(() => {
    if (pdfDownloading || bulkRunning || workflowBusy) return;
    if (draftIsEffectivelyEmpty) {
      void startNewReport();
      return;
    }
    if (skipNewReportConfirmSession) {
      void startNewReport();
      return;
    }
    setNewReportModalOpen(true);
  }, [
    bulkRunning,
    draftIsEffectivelyEmpty,
    pdfDownloading,
    skipNewReportConfirmSession,
    startNewReport,
    workflowBusy,
  ]);

  const handleConfirmNewReport = useCallback(() => {
    setNewReportModalOpen(false);
    void startNewReport();
  }, [startNewReport]);

  const handleChangePatientRequest = useCallback(async () => {
    if (pdfDownloading || bulkRunning || workflowBusy) return;
    setWorkflowBusy(true);
    try {
      const saved = await persistDraftBeforeSwitch();
      if (!saved) {
        setClinikoNotice(
          "Could not save the current draft. Fix save or retry before changing patient."
        );
        return;
      }
      // Keep prior patient local draft under adhd:{id}; clear only the unassigned safety net /
      // active pointer so remount cannot re-open the previous patient after Change patient.
      persistLocalDraftNow();
      clearLocalEngineDraft(engineLocalDraftKey("adhd", null));
      clearEngineActiveDraftPointer("adhd");
      resetAllReportState();
      setClinikoNotice("Draft saved. Select the next Cliniko patient.");
    } finally {
      setWorkflowBusy(false);
    }
  }, [
    bulkRunning,
    pdfDownloading,
    persistDraftBeforeSwitch,
    persistLocalDraftNow,
    resetAllReportState,
    workflowBusy,
  ]);

  const buildAdhdPdfDraft = useCallback((): AdhdPdfDraft => {
    return {
      patientDetails: {
        clientName: patientDetails.clientName,
        dob: patientDetails.dob,
        yearLevel: patientDetails.yearLevel,
        school: patientDetails.school,
        reportDate: patientDetails.reportDate,
        assessor: patientDetails.assessor,
        pronouns: patientDetails.pronouns,
        parent1: patientDetails.parent1,
        parent2: patientDetails.parent2,
        phone: patientDetails.phone,
        address: patientDetails.address,
        referringPractitioner: patientDetails.referringPractitioner,
      },
      assessmentDate,
      assessmentModality,
      attendingParents,
      presentingConcerns: sectionTexts["presenting-concerns"] ?? "",
      background: {
        pregnancyBirth: sectionTexts["background-pregnancy-birth"] ?? "",
        earlyDevelopment: sectionTexts["background-early-development"] ?? "",
        educationalHistory: sectionTexts["background-educational-history"] ?? "",
        emotionalBehaviouralSensory:
          sectionTexts["background-emotional-behavioural-sensory"] ?? "",
      },
      collateralSummary: sectionTexts["collateral-summary"] ?? "",
      formulation,
      recommendations: sectionTexts.recommendations ?? "",
      limitationsText: TEXLEX_LIMITATIONS,
    };
  }, [
    assessmentDate,
    assessmentModality,
    attendingParents,
    formulation,
    patientDetails,
    sectionTexts,
  ]);

  const downloadReport = useCallback(async () => {
    setPdfDownloading(true);
    try {
      const [{ pdf }, { AdhdPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./pdf/AdhdPdfDocument"),
      ]);
      const draft = buildAdhdPdfDraft();
      const logoSrc = resolveTexlexPublicAsset(TEXLEX_LOGO_PATH);
      let signatureSrc = await resolveTexlexSignatureSrc();
      let blob: Blob;
      try {
        blob = await pdf(
          <AdhdPdfDocument draft={draft} logoSrc={logoSrc} signatureSrc={signatureSrc} />
        ).toBlob();
      } catch (firstError) {
        console.warn(
          "ADHD PDF export: first attempt failed, retrying without signature image.",
          firstError
        );
        signatureSrc = null;
        blob = await pdf(
          <AdhdPdfDocument draft={draft} logoSrc={logoSrc} signatureSrc={signatureSrc} />
        ).toBlob();
      }
      const stem = safeFilenamePart(draft.patientDetails.clientName);
      const filename = `${stem}-ADHDReport-${draft.patientDetails.reportDate || todayIso()}.pdf`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);

      // Mirror ASD Download finalise: same PDF bytes → base64 → /api/cliniko/files
      const finalisePatientId = cliniko?.patientId;
      if (!finalisePatientId) {
        setClinikoNotice(
          "PDF downloaded. Load a Cliniko patient to save the report to Cliniko."
        );
        return;
      }
      try {
        const buf = await blob.arrayBuffer();
        let binary = "";
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
        const base64 = btoa(binary);
        const uploadRes = await fetch("/api/cliniko/files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId: finalisePatientId,
            filename,
            content: base64,
            contentType: "application/pdf",
            encoding: "base64",
            description: "Texlex ADHD report",
          }),
        });
        if (!uploadRes.ok) {
          const data = (await uploadRes.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error || "Cliniko PDF upload failed");
        }
        setClinikoNotice("Report saved to Cliniko");
      } catch (uploadErr) {
        console.error("Cliniko PDF upload failed (download succeeded):", uploadErr);
        setClinikoNotice(
          "Couldn't save report to Cliniko — PDF was still downloaded."
        );
      }
    } catch (error) {
      console.error("ADHD PDF export failed:", error);
      setClinikoNotice("Could not prepare the PDF. Please try again.");
    } finally {
      setPdfDownloading(false);
    }
  }, [buildAdhdPdfDraft, cliniko?.patientId]);

  const applyAdhdSavedState = useCallback((state: AdhdSavedState, opts?: { restoreCliniko?: boolean }) => {
    // Replace (do not merge) so a prior patient's fields cannot linger under a new name.
    setPatientDetails({
      ...patientDetailsAfterNewReport(),
      ...(state.patientDetails ?? {}),
      assessmentType: state.patientDetails?.assessmentType || "ADHD",
      assessor: state.patientDetails?.assessor?.trim() || DEFAULT_ASSESSOR,
      reportDate: state.patientDetails?.reportDate?.trim() || todayIso(),
    });
    if (opts?.restoreCliniko) {
      setCliniko(state.cliniko ?? null);
      if (state.cliniko?.patientId) {
        lastHydratedPatientIdRef.current = state.cliniko.patientId;
      }
    }
    setRawNotes(typeof state.rawNotes === "string" ? state.rawNotes : "");
    setCollateralDocs(
      state.collateralDocs !== undefined
        ? migrateCollateralDocsFromStorage(state.collateralDocs)
        : []
    );
    setDivaState(state.divaState ?? "not-administered");
    setCriteriaStates(state.criteriaStates ?? {});
    setSeverityStated(typeof state.severityStated === "string" ? state.severityStated : "");
    setAsdActive(typeof state.asdActive === "boolean" ? state.asdActive : false);
    setClinicianStatedFraming(
      typeof state.clinicianStatedFraming === "string" ? state.clinicianStatedFraming : ""
    );
    setMentalHealthFraming(
      typeof state.mentalHealthFraming === "string" ? state.mentalHealthFraming : ""
    );
    setMentalHealthGreenLight(
      typeof state.mentalHealthGreenLight === "boolean" ? state.mentalHealthGreenLight : false
    );
    setRecommendationShorthand(
      typeof state.recommendationShorthand === "string" ? state.recommendationShorthand : ""
    );
    setMedicationWanted(typeof state.medicationWanted === "boolean" ? state.medicationWanted : false);
    setAssessmentDate(typeof state.assessmentDate === "string" ? state.assessmentDate : "");
    setAssessmentModality(
      state.assessmentModality === "in-clinic" || state.assessmentModality === "virtual"
        ? state.assessmentModality
        : ""
    );
    setAttendingParents(
      Array.isArray(state.attendingParents)
        ? state.attendingParents.filter(
            (p): p is AttendingParent => p === "mother" || p === "father"
          )
        : []
    );
    setFormulation(typeof state.formulation === "string" ? state.formulation : "");

    const savedSections = state.sectionTexts ?? state.sectionText;
    const nextSections = emptySectionTexts();
    if (savedSections) {
      for (const section of SHARED_SECTIONS) {
        const value = savedSections[section.id];
        if (typeof value === "string") nextSections[section.id] = value;
      }
    }
    setSectionTexts(nextSections);
    if (typeof state.lastSaved === "string") setLastSavedAt(state.lastSaved);
    setSaveFailed(false);
    setSaveStatus("saved");
  }, []);

  // Silent localStorage restore on mount (navigation / crash safety net).
  useEffect(() => {
    if (localDraftHydratedRef.current) return;
    localDraftHydratedRef.current = true;
    const activeKey =
      readEngineActiveDraftKey("adhd") ?? engineLocalDraftKey("adhd", null);
    const draft = readLocalEngineDraft<AdhdSavedState>(activeKey);
    if (
      !draft ||
      !draftMatchesStorageKey("adhd", activeKey, draft) ||
      !adhdSavedStateHasResumableContent(draft)
    ) {
      return;
    }
    suppressAutosaveRef.current = true;
    applyAdhdSavedState(draft, { restoreCliniko: true });
    // Local restore is not a Supabase confirmed-save — keep tab-close warning armed.
    setLastEditAt(Date.now());
    localDraftKeyRef.current = activeKey;
    setLocalDraftRestoredNotice({
      lastSaved: draft.lastSaved ?? new Date().toISOString(),
      storageKey: activeKey,
    });
  }, [applyAdhdSavedState]);

  const persistLocalDraftNowRef = useRef(persistLocalDraftNow);
  persistLocalDraftNowRef.current = persistLocalDraftNow;

  // Continuous localStorage autosave (debounced). Does not replace Supabase confirmed-save.
  useEffect(() => {
    if (!localDraftHydratedRef.current) return;
    if (suppressAutosaveRef.current) {
      suppressAutosaveRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      persistLocalDraftNow();
    }, AUTO_SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [persistLocalDraftNow]);

  // Flush pending edits on unmount (SPA nav) so the debounce window cannot drop the last keystrokes.
  useEffect(() => {
    return () => {
      persistLocalDraftNowRef.current();
    };
  }, []);

  // Warn on tab close/reload when edits are newer than the last Supabase save.
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

  const clinicalWorkingSnapshotRef = useRef({
    rawNotes,
    collateralDocs,
    divaState,
    criteriaStates,
    severityStated,
    asdActive,
    clinicianStatedFraming,
    mentalHealthFraming,
    mentalHealthGreenLight,
    recommendationShorthand,
    medicationWanted,
    assessmentDate,
    assessmentModality,
    attendingParents,
    formulation,
    sectionTexts,
  });
  clinicalWorkingSnapshotRef.current = {
    rawNotes,
    collateralDocs,
    divaState,
    criteriaStates,
    severityStated,
    asdActive,
    clinicianStatedFraming,
    mentalHealthFraming,
    mentalHealthGreenLight,
    recommendationShorthand,
    medicationWanted,
    assessmentDate,
    assessmentModality,
    attendingParents,
    formulation,
    sectionTexts,
  };

  // Supabase resume banner when a Cliniko patient is loaded and there is no matching local draft.
  useEffect(() => {
    const patientId = cliniko?.patientId;
    if (!patientId) {
      setDraftResumePrompt(null);
      return;
    }
    if (lastHydratedPatientIdRef.current === patientId) return;

    const localKey = engineLocalDraftKey("adhd", patientId);
    const localDraft = readLocalEngineDraft<AdhdSavedState>(localKey);
    if (
      localDraft &&
      draftMatchesStorageKey("adhd", localKey, localDraft) &&
      adhdSavedStateHasResumableContent(localDraft)
    ) {
      // Prefer local safety-net when clinical UI is still empty (e.g. after Change patient).
      const clinicalEmpty = !adhdHasClinicalWorkingContent(clinicalWorkingSnapshotRef.current);
      if (clinicalEmpty) {
        suppressAutosaveRef.current = true;
        applyAdhdSavedState(localDraft, { restoreCliniko: false });
        setLocalDraftRestoredNotice({
          lastSaved: localDraft.lastSaved ?? new Date().toISOString(),
          storageKey: localKey,
        });
      }
      lastHydratedPatientIdRef.current = patientId;
      return;
    }

    let cancelled = false;
    void (async () => {
      const remote = await fetchReportStateForEngine<AdhdSavedState>("adhd", patientId);
      if (cancelled) return;
      // Mark hydrated only after the fetch settles so Strict Mode remounts can retry.
      lastHydratedPatientIdRef.current = patientId;
      if (!remote) return;
      if (remote.state.engine && remote.state.engine !== "adhd") return;
      if (!adhdSavedStateHasResumableContent(remote.state)) return;

      const patientLabel =
        cliniko?.connectedName?.trim() ||
        remote.state.patientDetails?.clientName?.trim() ||
        "this patient";
      const lastSavedLabel = formatDraftSavedAgo(
        remote.state.lastSaved ?? remote.updatedAt,
        Date.now()
      );
      setDraftResumePrompt({
        patientLabel,
        lastSavedLabel,
        stored: remote.state,
        patientId,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [applyAdhdSavedState, cliniko?.connectedName, cliniko?.patientId]);

  const discardLocalDraftRestored = useCallback(() => {
    if (localDraftRestoredNotice) {
      clearLocalEngineDraft(localDraftRestoredNotice.storageKey);
    }
    clearRelevantLocalDraftKeys(cliniko?.patientId ?? null);
    resetAllReportState();
  }, [
    clearRelevantLocalDraftKeys,
    cliniko?.patientId,
    localDraftRestoredNotice,
    resetAllReportState,
  ]);

  const statusLabel = saveFailed
    ? "Save failed"
    : saveStatus === "saving"
      ? "Saving..."
      : saveStatus === "saved"
        ? lastSavedAt
          ? `Saved ${formatDraftSavedAgo(lastSavedAt)}`
          : "Saved"
        : lastEditAt > 0
          ? "Unsaved changes"
          : "";

  return (
    <div className="min-h-screen bg-[var(--bg-page)] font-[family-name:var(--font-geist-sans,system-ui,Inter,sans-serif)] text-[15px] leading-[1.55] text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex justify-center px-6 py-3">
          <div className="flex w-full max-w-6xl items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Texlex</h1>
              <p className="text-base text-muted-foreground">
                {(patientDetails.clientName || "New patient") + " · ADHD assessment"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {statusLabel ? (
                <span
                  className={cn(
                    "text-xs",
                    saveFailed ? "font-medium text-destructive" : "text-muted-foreground"
                  )}
                >
                  {statusLabel}
                </span>
              ) : null}
              {workflowBusy ? (
                <span className="text-xs text-muted-foreground">Saving draft…</span>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                disabled={bulkRunning || workflowBusy}
                onClick={() => void generateAllSections()}
              >
                {bulkRunning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {bulkLabel || "Generating..."}
                  </>
                ) : (
                  "Generate all"
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={bulkRunning || workflowBusy}
                onClick={() => void saveReport()}
              >
                Save
              </Button>
              <Button
                size="sm"
                disabled={pdfDownloading || bulkRunning || workflowBusy}
                onClick={() => void downloadReport()}
              >
                {pdfDownloading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Preparing PDF
                  </>
                ) : (
                  "Download"
                )}
              </Button>
              <AdhdHeaderOverflowMenu
                pdfDownloading={pdfDownloading}
                bulkRunning={bulkRunning || workflowBusy}
                onNewReport={handleNewReportClick}
                onSaveDraft={() => void saveReport()}
              />
              <SignOutButton className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-background px-3 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60" />
            </div>
          </div>
        </div>
      </header>

      {clinikoNotice ? (
        <div className="flex justify-center px-6 pt-3">
          <div className="w-full max-w-6xl rounded-md bg-amber-50 px-3 py-2 text-[15px] text-amber-900">
            {clinikoNotice}
          </div>
        </div>
      ) : null}

      {localDraftRestoredNotice ? (
        <div className="flex justify-center border-b border-border/60 bg-muted/30 px-6 py-2">
          <div className="flex w-full max-w-6xl flex-wrap items-center justify-between gap-2">
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
          className="border-b border-amber-300/60 bg-amber-50 px-6 py-3 dark:border-amber-800/60 dark:bg-amber-950/30"
          role="dialog"
          aria-label="Resume draft"
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-foreground">
              Resume previous draft for {draftResumePrompt.patientLabel}? Last saved{" "}
              {draftResumePrompt.lastSavedLabel}.
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  const stored = draftResumePrompt.stored;
                  applyAdhdSavedState(stored);
                  if (typeof stored.lastSaved === "string") {
                    setLastCloudSavedAt(stored.lastSaved);
                  }
                  const key = engineLocalDraftKey("adhd", draftResumePrompt.patientId);
                  if (draftMatchesStorageKey("adhd", key, stored)) {
                    writeLocalEngineDraft("adhd", key, { ...stored, engine: "adhd" });
                    clearLocalEngineDraft(engineLocalDraftKey("adhd", null));
                  }
                  setDraftResumePrompt(null);
                  setClinikoNotice(`Resumed draft for ${draftResumePrompt.patientLabel}`);
                }}
              >
                Resume
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setDraftResumePrompt(null)}
              >
                Discard
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex justify-center px-6 py-6 pb-32">
        <div className="grid w-full max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-6 text-[15px] leading-[1.55]">
            <ClinikoIntakeCard
              key={clinikoIntakeResetKey}
              inputClass={INPUT_CLASS}
              patientDetails={patientDetails as AsdPatientDetails}
              setPatientDetails={
                setPatientDetails as unknown as Dispatch<SetStateAction<AsdPatientDetails>>
              }
              cliniko={cliniko}
              setCliniko={setCliniko}
              onTouch={touch}
              onLoaded={(message) => setClinikoNotice(message)}
              onError={(message) => setClinikoNotice(message)}
              onChangePatientRequest={handleChangePatientRequest}
            />

            <Card>
              <CardContent className="space-y-4 pt-6">
                <TexlexSectionHeading>Client details</TexlexSectionHeading>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <DetailField
                    label="Client name"
                    value={patientDetails.clientName}
                    onChange={(clientName) => {
                      touch();
                      setPatientDetails((prev) => ({ ...prev, clientName }));
                    }}
                  />
                  <label className="block space-y-1 text-base">
                    <span className="text-muted-foreground">Date of birth</span>
                    <input
                      type="date"
                      className={INPUT_CLASS}
                      value={patientDetails.dob}
                      onChange={(e) => {
                        touch();
                        setPatientDetails((prev) => ({ ...prev, dob: e.target.value }));
                      }}
                    />
                  </label>
                  <DetailField
                    label="Pronouns"
                    value={patientDetails.pronouns}
                    onChange={(pronouns) => {
                      touch();
                      setPatientDetails((prev) => ({ ...prev, pronouns }));
                    }}
                  />
                  <DetailField
                    label="Year level"
                    value={patientDetails.yearLevel}
                    onChange={(yearLevel) => {
                      touch();
                      setPatientDetails((prev) => ({ ...prev, yearLevel }));
                    }}
                  />
                  <DetailField
                    label="School"
                    value={patientDetails.school}
                    onChange={(school) => {
                      touch();
                      setPatientDetails((prev) => ({ ...prev, school }));
                    }}
                  />
                  <label className="block space-y-1 text-base">
                    <span className="text-muted-foreground">Report date</span>
                    <input
                      type="date"
                      className={INPUT_CLASS}
                      value={patientDetails.reportDate}
                      onChange={(e) => {
                        touch();
                        setPatientDetails((prev) => ({ ...prev, reportDate: e.target.value }));
                      }}
                    />
                  </label>
                  <label className="block space-y-1 text-base">
                    <span className="text-muted-foreground">Date of assessment (date seen)</span>
                    <input
                      type="date"
                      className={INPUT_CLASS}
                      value={assessmentDate}
                      onChange={(e) => {
                        touch();
                        setAssessmentDate(e.target.value);
                      }}
                    />
                  </label>
                  <DetailField
                    label="Parent 1"
                    value={patientDetails.parent1}
                    onChange={(parent1) => {
                      touch();
                      setPatientDetails((prev) => ({ ...prev, parent1 }));
                    }}
                  />
                  <DetailField
                    label="Parent 2"
                    value={patientDetails.parent2}
                    onChange={(parent2) => {
                      touch();
                      setPatientDetails((prev) => ({ ...prev, parent2 }));
                    }}
                  />
                  <div className="space-y-2 sm:col-span-2">
                    <span className="block text-base text-muted-foreground">
                      Attending parents / informants
                    </span>
                    <div className="flex flex-wrap gap-4">
                      {(["mother", "father"] as AttendingParent[]).map((option) => {
                        const checked = attendingParents.includes(option);
                        return (
                          <label key={option} className="flex items-center gap-2 text-base">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                touch();
                                setAttendingParents((prev) =>
                                  checked
                                    ? prev.filter((p) => p !== option)
                                    : [...prev, option]
                                );
                              }}
                            />
                            {option === "mother" ? "Mother" : "Father"}
                          </label>
                        );
                      })}
                    </div>
                    {formatAttendingParentsPhrase(attendingParents, patientDetails.pronouns) ? (
                      <p className="text-sm text-muted-foreground">
                        Report phrasing: attended with{" "}
                        {formatAttendingParentsPhrase(attendingParents, patientDetails.pronouns)}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <span className="block text-base text-muted-foreground">Assessment modality</span>
                    <div className="flex flex-wrap gap-4">
                      {(
                        [
                          { value: "in-clinic", label: "In-clinic" },
                          { value: "virtual", label: "Virtual (video)" },
                        ] as const
                      ).map((option) => (
                        <label key={option.value} className="flex items-center gap-2 text-base">
                          <input
                            type="radio"
                            name="assessment-modality"
                            checked={assessmentModality === option.value}
                            onChange={() => {
                              touch();
                              setAssessmentModality(option.value);
                            }}
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <DetailField
                    label="Referring practitioner"
                    value={patientDetails.referringPractitioner}
                    onChange={(referringPractitioner) => {
                      touch();
                      setPatientDetails((prev) => ({ ...prev, referringPractitioner }));
                    }}
                  />
                  <DetailField
                    label="Referrer type"
                    value={patientDetails.referringPractitionerType}
                    onChange={(referringPractitionerType) => {
                      touch();
                      setPatientDetails((prev) => ({ ...prev, referringPractitionerType }));
                    }}
                  />
                  <DetailField
                    label="Assessor"
                    value={patientDetails.assessor}
                    onChange={(assessor) => {
                      touch();
                      setPatientDetails((prev) => ({ ...prev, assessor }));
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 pt-6">
                <TexlexSectionHeading>Raw clinical notes</TexlexSectionHeading>
                <Textarea
                  value={rawNotes}
                  onChange={(e) => {
                    touch();
                    setRawNotes(e.target.value);
                  }}
                  rows={10}
                  placeholder="Paste raw clinical notes for section generation and engine scraping."
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 pt-6">
                <TexlexSectionHeading>Collateral documents</TexlexSectionHeading>
                <CollateralDocumentsUpload
                  collateralDocs={collateralDocs}
                  setCollateralDocs={setCollateralDocs}
                  touch={touch}
                  inputClass={INPUT_CLASS}
                />
              </CardContent>
            </Card>

            {NARRATIVE_SECTIONS.map((section) => (
              <Card key={section.id}>
                <CardContent className="space-y-3 pt-6">
                  <div className="flex items-center justify-between gap-3">
                    <TexlexSectionHeading>{section.label}</TexlexSectionHeading>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={bulkRunning || sectionGenerating[section.id]}
                      onClick={() => void generateSection(section.id, section.route)}
                    >
                      {sectionGenerating[section.id] ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating
                        </>
                      ) : (
                        "Generate"
                      )}
                    </Button>
                  </div>
                  {sectionGenerating[section.id] ? (
                    <p className="text-base text-muted-foreground">Generating…</p>
                  ) : (
                    <Textarea
                      className="min-h-[140px] text-base leading-relaxed"
                      value={sectionTexts[section.id] ?? ""}
                      onChange={(e) => {
                        touch();
                        setSectionTexts((prev) => ({
                          ...prev,
                          [section.id]: e.target.value,
                        }));
                      }}
                      placeholder="Generate this section, or type/edit clinical prose here."
                      rows={8}
                    />
                  )}
                </CardContent>
              </Card>
            ))}

            <Card>
              <CardContent className="space-y-4 pt-6">
                <TexlexSectionHeading>Criteria (clinician entry)</TexlexSectionHeading>

                <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-base">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span>
                      Presentation:{" "}
                      <span className="font-medium">
                        {pipeline.presentation.presentation ?? "Held open"}
                      </span>
                    </span>
                    <span>
                      IA {pipeline.counts.inattentionMet}/{pipeline.counts.inattentionTotal}
                    </span>
                    <span>
                      HI {pipeline.counts.hyperactivityMet}/{pipeline.counts.hyperactivityTotal}
                    </span>
                    <span>Threshold {pipeline.presentation.threshold}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-base font-medium">DIVA-5 gate</span>
                  <div className="flex gap-1">
                    {(["positive", "negative", "not-administered"] as DivaState[]).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          touch();
                          setDivaState(opt);
                        }}
                        className={cn(
                          "rounded px-2 py-1 text-xs",
                          divaState === opt
                            ? "bg-teal-700 text-white"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {opt === "positive"
                          ? "Positive"
                          : opt === "negative"
                            ? "Negative"
                            : "Not administered"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="mb-1 text-base font-semibold text-muted-foreground">
                    Inattention (IA)
                  </h4>
                  {inattention.map((c) => (
                    <CriterionRow
                      key={c.code}
                      code={c.code}
                      label={c.criterion}
                      state={criteriaStates[c.code] ?? "unset"}
                      onChange={(state) => setCriterion(c.code, state)}
                    />
                  ))}
                </div>

                <div>
                  <h4 className="mb-1 text-base font-semibold text-muted-foreground">
                    Hyperactivity / Impulsivity (HI)
                  </h4>
                  {hyperactivity.map((c) => (
                    <CriterionRow
                      key={c.code}
                      code={c.code}
                      label={c.criterion}
                      state={criteriaStates[c.code] ?? "unset"}
                      onChange={(state) => setCriterion(c.code, state)}
                    />
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block space-y-1 text-base">
                    <span className="text-muted-foreground">Severity stated</span>
                    <input
                      className={INPUT_CLASS}
                      value={severityStated}
                      onChange={(e) => {
                        touch();
                        setSeverityStated(e.target.value);
                      }}
                      placeholder="e.g. moderate"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-base">
                    <input
                      type="checkbox"
                      checked={asdActive}
                      onChange={(e) => {
                        touch();
                        setAsdActive(e.target.checked);
                      }}
                    />
                    ASD active (integrated formulation)
                  </label>
                  <label className="flex items-center gap-2 text-base">
                    <input
                      type="checkbox"
                      checked={mentalHealthGreenLight}
                      onChange={(e) => {
                        touch();
                        setMentalHealthGreenLight(e.target.checked);
                      }}
                    />
                    Mental health green light
                  </label>
                  <label className="flex items-center gap-2 text-base">
                    <input
                      type="checkbox"
                      checked={medicationWanted}
                      onChange={(e) => {
                        touch();
                        setMedicationWanted(e.target.checked);
                      }}
                    />
                    Medication wanted
                  </label>
                </div>

                <label className="block space-y-1 text-base">
                  <span className="text-muted-foreground">Clinician framing</span>
                  <Textarea
                    value={clinicianStatedFraming}
                    onChange={(e) => {
                      touch();
                      setClinicianStatedFraming(e.target.value);
                    }}
                    rows={2}
                  />
                </label>

                <label className="block space-y-1 text-base">
                  <span className="text-muted-foreground">Mental health framing</span>
                  <Textarea
                    value={mentalHealthFraming}
                    onChange={(e) => {
                      touch();
                      setMentalHealthFraming(e.target.value);
                    }}
                    rows={2}
                  />
                </label>

                <label className="block space-y-1 text-base">
                  <span className="text-muted-foreground">Recommendation shorthand</span>
                  <input
                    className={INPUT_CLASS}
                    value={recommendationShorthand}
                    onChange={(e) => {
                      touch();
                      setRecommendationShorthand(e.target.value);
                    }}
                    placeholder="e.g. speech pathology, school support"
                  />
                  <span className="block text-sm text-muted-foreground">
                    {parseRecommendationShorthand(recommendationShorthand).length
                      ? `Will expand to exactly ${parseRecommendationShorthand(recommendationShorthand).length} item(s). No extras added.`
                      : "Enter one item per comma or line. Expand produces that many recommendations only."}
                  </span>
                </label>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-center justify-between gap-3">
                  <TexlexSectionHeading>Clinical formulation</TexlexSectionHeading>
                  <Button
                    size="sm"
                    disabled={bulkRunning || formulationGenerating}
                    onClick={() => void generateFormulation()}
                  >
                    {formulationGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating
                      </>
                    ) : (
                      "Generate"
                    )}
                  </Button>
                </div>
                {formulationGenerating ? (
                  <p className="text-base text-muted-foreground">Generating…</p>
                ) : (
                  <Textarea
                    className="min-h-[220px] text-base leading-relaxed"
                    value={formulation}
                    onChange={(e) => {
                      touch();
                      setFormulation(e.target.value);
                    }}
                    placeholder="Generate the formulation, or type/edit clinical prose here."
                    rows={12}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-center justify-between gap-3">
                  <TexlexSectionHeading>{RECOMMENDATIONS_SECTION.label}</TexlexSectionHeading>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={bulkRunning}
                    onClick={() => generateRecommendationsFromShorthand()}
                  >
                    Expand shorthand
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Expands only the clinician shorthand entered above. No extra recommendations are
                  added.
                </p>
                <Textarea
                  className="min-h-[160px] text-base leading-relaxed"
                  value={sectionTexts.recommendations ?? ""}
                  onChange={(e) => {
                    touch();
                    setSectionTexts((prev) => ({
                      ...prev,
                      recommendations: e.target.value,
                    }));
                  }}
                  placeholder="Expand shorthand, or type/edit recommendation prose here."
                  rows={8}
                />
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <Card>
              <CardContent className="space-y-3 pt-6">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Engine assistant
                </h3>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between gap-2">
                    <span>Inattention</span>
                    <span
                      className={cn(
                        "font-medium",
                        pipeline.presentation.iaPositive
                          ? "text-emerald-700"
                          : "text-muted-foreground"
                      )}
                    >
                      {pipeline.counts.inattentionMet}/{pipeline.counts.inattentionTotal} · threshold{" "}
                      {pipeline.presentation.threshold}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Hyperactivity / Impulsivity</span>
                    <span
                      className={cn(
                        "font-medium",
                        pipeline.presentation.hiPositive
                          ? "text-emerald-700"
                          : "text-muted-foreground"
                      )}
                    >
                      {pipeline.counts.hyperactivityMet}/{pipeline.counts.hyperactivityTotal} · threshold{" "}
                      {pipeline.presentation.threshold}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 border-t border-border/50 pt-1">
                    <span>Presentation</span>
                    <span className="font-medium">
                      {pipeline.presentation.presentation ?? "Held open"}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                    Differential channels
                  </h4>
                  {pipeline.channels.filter((c) => c.state !== "not-indicated").length === 0 ? (
                    <p className="text-xs text-muted-foreground">None indicated in notes.</p>
                  ) : (
                    pipeline.channels
                      .filter((c) => c.state !== "not-indicated")
                      .map((c) => (
                        <div
                          key={c.channel}
                          className="flex items-center justify-between gap-2 py-0.5 text-xs"
                        >
                          <span>{c.channel}</span>
                          <Badge
                            variant={
                              c.state === "present-investigate" ? "destructive" : "secondary"
                            }
                          >
                            {c.state === "present-investigate" ? "Investigate" : "Assessed"}
                          </Badge>
                        </div>
                      ))
                  )}
                </div>

                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                    ASD differential
                  </h4>
                  <Badge
                    variant={pipeline.asdDifferential.flagged ? "destructive" : "secondary"}
                  >
                    {pipeline.asdDifferential.flagged
                      ? "Flagged"
                      : "Below threshold"}
                  </Badge>
                </div>

                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                    Mental health screen
                  </h4>
                  <div className="space-y-1 text-xs">
                    {pipeline.mentalHealth.risk.present ? (
                      <Badge variant="destructive">Risk surfaced</Badge>
                    ) : (
                      <span className="text-muted-foreground">No risk flags</span>
                    )}
                    {pipeline.mentalHealth.depression.surfaced ? (
                      <div>Depression cluster surfaced</div>
                    ) : null}
                    {pipeline.mentalHealth.anxiety.surfaced ? (
                      <div>Anxiety cluster surfaced</div>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      <NewReportConfirmModal
        open={newReportModalOpen}
        clinikoSyncInProgress={workflowBusy}
        onCancel={() => setNewReportModalOpen(false)}
        onConfirm={handleConfirmNewReport}
        skipConfirmThisSession={skipNewReportConfirmSession}
        onSkipConfirmThisSessionChange={setSkipNewReportConfirmSession}
      />
    </div>
  );
}
