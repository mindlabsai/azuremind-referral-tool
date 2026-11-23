"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ClinikoPatient } from "@/lib/cliniko";
import {
  applyClinikoPatientToForm,
  buildClinikoBaseline,
  type ClinikoDraftState,
} from "@/lib/texlex-cliniko-sync";
import {
  appointmentStartsAtToDateSeen,
  mergeRegistrationIntoPatientDetails,
  type RegistrationDemographics,
} from "@/lib/cliniko-registration-forms";
import type { PatientDetails } from "../page";
import {
  TEXLEX_SECTION_CONTAINER_CLASS,
  TEXLEX_SECTION_CONTENT_CLASS,
} from "../constants/texlexSectionSurface";
import { ClinikoPatientAppointments } from "./ClinikoPatientAppointments";
import { ClinikoMyCalendar } from "./ClinikoMyCalendar";
import type { CollateralDoc } from "@/lib/collateral/collateral-docs-client";
import {
  formatClinikoImportNotice,
  importClinikoAttachmentsIntoCollateral,
  mergeImportedCollateralDocs,
} from "@/lib/collateral/import-cliniko-attachments";
import {
  practiceApiBase,
  practiceLabel,
  readStoredPracticeSource,
  storePracticeSource,
  type PracticeSource,
} from "@/lib/practice-source";
import { readWorkspaceOpen } from "@/lib/workspace-open";

const IMPORT_FILES_PREF_KEY = "texlex.cliniko.importFilesOnAppt";

type ClinikoIntakeCardProps = {
  inputClass: string;
  patientDetails: PatientDetails;
  setPatientDetails: Dispatch<SetStateAction<PatientDetails>>;
  cliniko: ClinikoDraftState | null;
  setCliniko: Dispatch<SetStateAction<ClinikoDraftState | null>>;
  onTouch: () => void;
  onLoaded: (message: string) => void;
  onError: (message: string) => void;
  /**
   * Optional: when Change patient is clicked, run this first (e.g. save + full report reset).
   * If provided, the caller is responsible for clearing Cliniko linkage / remounting as needed.
   */
  onChangePatientRequest?: () => void | Promise<void>;
  /** When true, Change patient is visually disabled (e.g. generation in flight). */
  changePatientDisabled?: boolean;
  /** When provided, calendar can auto-import Cliniko attachments into collateral. */
  collateralDocs?: CollateralDoc[];
  setCollateralDocs?: Dispatch<SetStateAction<CollateralDoc[]>>;
  /** Whether written collateral summary has content (for Hey Tex list). */
  collateralSummaryFilled?: boolean;
  /**
   * Called when loading a different Cliniko patient while one is already linked
   * (calendar / search / Hey Tex). Save the current draft and clear clinical
   * content so the previous patient's report is not uploaded under the new id.
   */
  onPreparePatientSwitch?: (nextPatientId: string) => void | Promise<void>;
  /** Prefer Autism vs ADHD registration form when both exist. */
  engine?: "asd" | "adhd";
  /** Set date seen / assessment date from the clicked calendar appointment. */
  onDateSeenFromAppointment?: (dateYmd: string) => void;
  /** Hold draft restore while calendar/search patient load (+ optional file import) runs. */
  onPatientLoadStart?: () => void;
  onPatientLoadEnd?: () => void;
  onSourceChange?: (source: PracticeSource) => void;
  /** When false, hide the appointment calendar only — Cliniko/Halaxy + search stay visible. */
  calendarOpen?: boolean;
};

function formatDobLabel(dob: string | null): string {
  if (!dob) return "—";
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return dob;
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function computeAgeLabel(dob: string | null): string {
  if (!dob) return "—";
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return "—";
  const today = new Date();
  let years = today.getFullYear() - date.getFullYear();
  const monthDelta = today.getMonth() - date.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < date.getDate())) years--;
  return `${years}y`;
}

export function ClinikoIntakeCard({
  inputClass,
  patientDetails,
  setPatientDetails,
  cliniko,
  setCliniko,
  onTouch,
  onLoaded,
  onError,
  onChangePatientRequest,
  changePatientDisabled = false,
  collateralDocs,
  setCollateralDocs,
  collateralSummaryFilled = false,
  onPreparePatientSwitch,
  engine,
  onDateSeenFromAppointment,
  onPatientLoadStart,
  onPatientLoadEnd,
  onSourceChange,
  calendarOpen = true,
}: ClinikoIntakeCardProps) {
  const [source, setSource] = useState<PracticeSource>("cliniko");
  const [sourceReady, setSourceReady] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showSearchCard, setShowSearchCard] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [slowSearch, setSlowSearch] = useState(false);
  const [results, setResults] = useState<ClinikoPatient[]>([]);
  const [loadingPatientId, setLoadingPatientId] = useState<string | null>(null);
  const [importFilesEnabled, setImportFilesEnabled] = useState(true);
  const [importingFiles, setImportingFiles] = useState(false);
  const [halaxyAvailable, setHalaxyAvailable] = useState(true);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const workspaceOpenedRef = useRef(false);
  const onErrorRef = useRef(onError);
  const onLoadedRef = useRef(onLoaded);
  const collateralDocsRef = useRef(collateralDocs);
  const canImportFiles = Boolean(setCollateralDocs);

  useEffect(() => {
    collateralDocsRef.current = collateralDocs;
  }, [collateralDocs]);

  useEffect(() => {
    const requested = typeof window === "undefined" ? null : readWorkspaceOpen(window.location.search);
    const next = cliniko?.source ?? requested?.source ?? readStoredPracticeSource();
    setSource(next === "halaxy" ? "halaxy" : "cliniko");
  }, [cliniko?.source]);

  // Detect Halaxy availability once so the button can stay disabled if unset.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/halaxy/status", { credentials: "same-origin" });
        const data = (await response.json()) as { configured?: boolean };
        if (cancelled) return;
        if (response.status === 401) return;
        if (data.configured === false) {
          setHalaxyAvailable(false);
          if (readStoredPracticeSource() === "halaxy") {
            storePracticeSource("cliniko");
            setSource("cliniko");
            setStatusNotice("Halaxy is not configured on this server. Using Cliniko.");
          }
        } else {
          setHalaxyAvailable(true);
        }
      } catch {
        // Leave Halaxy clickable; the source status check will report errors.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(IMPORT_FILES_PREF_KEY);
      if (raw === "0") setImportFilesEnabled(false);
      if (raw === "1") setImportFilesEnabled(true);
    } catch {
      // ignore
    }
  }, []);

  const updateImportFilesEnabled = (enabled: boolean) => {
    setImportFilesEnabled(enabled);
    try {
      window.localStorage.setItem(IMPORT_FILES_PREF_KEY, enabled ? "1" : "0");
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    onErrorRef.current = onError;
    onLoadedRef.current = onLoaded;
  }, [onError, onLoaded]);

  useEffect(() => {
    let cancelled = false;
    setSourceReady(false);
    setConnectionError(null);
    void (async () => {
      try {
        const response = await fetch(`${practiceApiBase(source)}/status`, {
          credentials: "same-origin",
        });
        const data = (await response.json()) as {
          configured?: boolean;
          connected?: boolean;
          error?: string;
        };
        if (cancelled) return;

        if (response.status === 401) {
          setConnectionError("Sign in again to load patients from Cliniko / Halaxy.");
          setSourceReady(false);
          return;
        }

        if (source === "halaxy" && data.configured === false) {
          setHalaxyAvailable(false);
          setStatusNotice("Halaxy is not configured on this server. Using Cliniko.");
          setSource("cliniko");
          storePracticeSource("cliniko");
          setSourceReady(false);
          return;
        }

        if (data.configured === false) {
          setConnectionError(
            `${practiceLabel(source)} credentials are missing. Ask an admin to set the API keys.`
          );
          setSourceReady(false);
          return;
        }

        if (source === "halaxy") setHalaxyAvailable(true);
        setSourceReady(true);
        if (data.connected === false) {
          setConnectionError(
            data.error?.trim() ||
              `${practiceLabel(source)} connection failed. Check the API credentials.`
          );
        } else {
          setConnectionError(null);
          if (source === "cliniko") {
            setStatusNotice((prev) =>
              prev?.includes("Halaxy is not configured") ? prev : null
            );
          }
        }
      } catch {
        if (!cancelled) {
          setSourceReady(false);
          setConnectionError(
            `${practiceLabel(source)} connection failed. Check the API credentials.`
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source]);

  useEffect(() => {
    if (!sourceReady || connectionError || !showSearchCard) {
      setResults([]);
      setSearching(false);
      setSlowSearch(false);
      return;
    }

    const trimmed = searchQuery.trim();
    console.log("[cliniko-ui] search effect", { sourceReady, connectionError, showSearchCard, trimmed });
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      setSlowSearch(false);
      return;
    }

    let cancelled = false;
    const slowTimer = setTimeout(() => {
      if (!cancelled) setSlowSearch(true);
    }, 5000);
    const debounceTimer = setTimeout(() => {
      if (cancelled) return;
      setSearching(true);
      void (async () => {
        try {
          const response = await fetch(
            `${practiceApiBase(source)}/patients/search?q=${encodeURIComponent(trimmed)}`,
            { credentials: "same-origin" }
          );
          const data = (await response.json()) as { patients?: ClinikoPatient[]; error?: string };
          if (cancelled) return;
          if (!response.ok) {
            onErrorRef.current(data.error ?? `${practiceLabel(source)} search failed.`);
            setResults([]);
            return;
          }
          setResults((data.patients ?? []).slice(0, 10));
        } catch {
          if (!cancelled) onErrorRef.current(`${practiceLabel(source)} search failed.`);
        } finally {
          if (!cancelled) {
            setSearching(false);
            setSlowSearch(false);
          }
        }
      })();
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
      clearTimeout(debounceTimer);
      setSearching(false);
      setSlowSearch(false);
    };
  }, [sourceReady, connectionError, searchQuery, showSearchCard, source]);

  const connectedLabel = useMemo(() => {
    if (cliniko?.connectedName) return cliniko.connectedName;
    return patientDetails.clientName.trim();
  }, [cliniko?.connectedName, patientDetails.clientName]);

  const handleSelectPatient = async (
    patient: ClinikoPatient | { id: string },
    options: { importFiles?: boolean; appointmentStartsAt?: string | null } = {}
  ) => {
    setLoadingPatientId(patient.id);
    onPatientLoadStart?.();
    try {
      const previousId = cliniko?.patientId?.trim() || null;
      if (previousId && previousId !== patient.id && onPreparePatientSwitch) {
        await onPreparePatientSwitch(patient.id);
      }

      const engineQuery = engine ? `?engine=${engine}` : "";
      const response = await fetch(`${practiceApiBase(source)}/patients/${patient.id}${engineQuery}`);
      const data = (await response.json()) as {
        patient?: Parameters<typeof applyClinikoPatientToForm>[0];
        customFields?: Parameters<typeof applyClinikoPatientToForm>[1];
        registration?: RegistrationDemographics | null;
        mergedDetails?: ReturnType<typeof applyClinikoPatientToForm> | null;
        error?: string;
      };
      if (!response.ok || !data.patient) {
        onError(data.error ?? `Could not load the ${practiceLabel(source)} patient.`);
        return;
      }

      const fromPatient = applyClinikoPatientToForm(data.patient, data.customFields ?? {});
      const mappedRaw =
        data.mergedDetails ??
        mergeRegistrationIntoPatientDetails(fromPatient, data.registration);
      // Cliniko patient record wins for identity (registration often has parent/claimant name).
      const mapped = {
        ...mappedRaw,
        clientName: fromPatient.clientName.trim() || mappedRaw.clientName,
        dob: fromPatient.dob.trim() || mappedRaw.dob,
      } as typeof mappedRaw;
      const dateSeen = appointmentStartsAtToDateSeen(options.appointmentStartsAt);

      onTouch();
      setPatientDetails((current) => {
        const next = {
          ...current,
          ...mapped,
        } as PatientDetails;
        if (dateSeen && "assessmentDates" in next) {
          const existing = Array.isArray(next.assessmentDates) ? next.assessmentDates : [];
          const hasDate = existing.some((d) => String(d).trim() === dateSeen);
          if (!hasDate) {
            const cleaned = existing.map((d) => String(d).trim()).filter(Boolean);
            next.assessmentDates = cleaned.length ? [...cleaned, dateSeen] : [dateSeen];
          }
        }
        return next;
      });
      if (dateSeen && onDateSeenFromAppointment) {
        onDateSeenFromAppointment(dateSeen);
      }
      setCliniko({
        patientId: patient.id,
        connectedName: mapped.clientName || `${data.patient.last_name}, ${data.patient.first_name}`,
        syncEnabled: source !== "halaxy",
        source,
        baseline: buildClinikoBaseline(data.patient, data.customFields ?? {}, mapped),
      });
      // Keep search visible so Cliniko/Halaxy choice + name search stay findable.

      const nameLabel =
        mapped.clientName || `${data.patient.first_name} ${data.patient.last_name}`.trim();
      let loadedMessage = `Loaded ${nameLabel} from ${practiceLabel(source)}`;
      if (data.registration?.formName) {
        loadedMessage += ` (+ ${data.registration.formName})`;
      }
      if (dateSeen) {
        loadedMessage += `. Date seen ${dateSeen}`;
      }

      if (options.importFiles && setCollateralDocs) {
        setImportingFiles(true);
        try {
          const result = await importClinikoAttachmentsIntoCollateral({
            patientId: patient.id,
            apiBase: practiceApiBase(source),
            existingDocs: collateralDocsRef.current ?? [],
            // Halaxy lists every file for manual selection. ADHD Cliniko stays on preferred forms.
            asrsOnly: source === "halaxy" ? false : engine === "adhd",
          });
          if (result.additions.length > 0) {
            setCollateralDocs((prev) => mergeImportedCollateralDocs(prev, result.additions));
          }
          const importNotice = formatClinikoImportNotice(result, practiceLabel(source));
          if (importNotice) loadedMessage = `${loadedMessage}. ${importNotice}`;
          if (result.error) onError(result.error);
        } catch {
          onError(`Patient loaded, but ${practiceLabel(source)} file import failed.`);
        } finally {
          setImportingFiles(false);
        }
      }

      onLoaded(loadedMessage);
    } catch {
      onError(`Could not load the ${practiceLabel(source)} patient.`);
    } finally {
      setLoadingPatientId(null);
      onPatientLoadEnd?.();
    }
  };

  useEffect(() => {
    if (workspaceOpenedRef.current || !sourceReady || connectionError) return;
    if (typeof window === "undefined") return;
    const request = readWorkspaceOpen(window.location.search);
    if (!request || source !== request.source) return;
    if (cliniko?.patientId === request.patientId) {
      workspaceOpenedRef.current = true;
      return;
    }
    workspaceOpenedRef.current = true;
    storePracticeSource(request.source);
    void handleSelectPatient(
      { id: request.patientId },
      {
        importFiles: request.importFiles,
        appointmentStartsAt: request.appointmentStartsAt,
      }
    );
  }, [cliniko?.patientId, sourceReady, connectionError, source]);

  return (
    <div className="space-y-4" data-testid="cliniko-intake">
      <div className="space-y-2 rounded-lg border border-[#2c455f] bg-[#12263a] px-3 py-3">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#849aaf]">
          Load patient
        </p>
        <div className="flex flex-wrap gap-2">
          {(["cliniko", "halaxy"] as const).map((option) => {
            const disabled = option === "halaxy" && !halaxyAvailable;
            return (
              <button
                key={option}
                type="button"
                disabled={disabled}
                title={disabled ? "Halaxy is not configured on this server" : undefined}
                className={cn(
                  "rounded-md border px-3 py-2 text-[16px] font-medium",
                  source === option
                    ? "border-[#9fc3f2] bg-[#1a3348] text-[#f4f8fc]"
                    : "border-[#2c455f] text-[#b7c9db] hover:border-[#4d78a3] hover:text-[#f4f8fc]",
                  disabled && "cursor-not-allowed opacity-45 hover:border-[#2c455f] hover:text-[#b7c9db]"
                )}
                onClick={() => {
                  if (disabled) return;
                  setSource(option);
                  storePracticeSource(option);
                  onSourceChange?.(option);
                  setConnectionError(null);
                  setStatusNotice(null);
                  setResults([]);
                  setShowSearchCard(true);
                }}
              >
                {practiceLabel(option)}
              </button>
            );
          })}
        </div>
        {statusNotice ? (
          <p className="rounded-md border border-[#3a5f82] bg-[#1a3348] px-3 py-2 text-[15px] text-[#d7e6f5]">
            {statusNotice}
          </p>
        ) : null}
        {connectionError ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[15px] text-[#f0d9a8]">
            {connectionError}
          </p>
        ) : null}
      </div>

      {sourceReady && !connectionError && calendarOpen ? (
        <ClinikoMyCalendar
          source={source}
          selectedPatientId={cliniko?.patientId ?? null}
          disabled={changePatientDisabled || Boolean(loadingPatientId) || importingFiles}
          importingFiles={importingFiles}
          importFilesEnabled={canImportFiles ? importFilesEnabled : false}
          onImportFilesEnabledChange={canImportFiles ? updateImportFilesEnabled : undefined}
          collateralDocs={collateralDocs}
          collateralSummaryFilled={collateralSummaryFilled}
          onSelectPatientId={async (patientId, _name, options) => {
            await handleSelectPatient(
              { id: patientId },
              {
                importFiles: Boolean(canImportFiles && options.importFiles),
                appointmentStartsAt: options.appointmentStartsAt,
              }
            );
          }}
        />
      ) : null}

      {cliniko ? (
        <div className="space-y-2 rounded-lg border border-[#2c455f] bg-[#12263a] px-3 py-2">
          <p className="text-[16px] text-[#f4f8fc]">
            Connected to {practiceLabel(cliniko.source)} · {connectedLabel} ·{" "}
            <button
              type="button"
              className={cn(
                "underline-offset-4",
                changePatientDisabled
                  ? "cursor-not-allowed opacity-50"
                  : "text-[#9fc3f2] hover:underline"
              )}
              disabled={changePatientDisabled}
              title={
                changePatientDisabled
                  ? "Available once generation completes."
                  : undefined
              }
              onClick={() => {
                if (changePatientDisabled) return;
                void (async () => {
                  if (onChangePatientRequest) {
                    await onChangePatientRequest();
                    return;
                  }
                  setShowSearchCard(true);
                })();
              }}
            >
              Change patient
            </button>
          </p>
          {cliniko.source === "halaxy" ? null : (
            <label className="flex items-center gap-2 text-[15px] text-[#b7c9db]">
              <input
                type="checkbox"
                checked={cliniko.syncEnabled}
                onChange={(e) =>
                  setCliniko((current) => (current ? { ...current, syncEnabled: e.target.checked } : current))
                }
              />
              Sync changes back to Cliniko
            </label>
          )}
          <ClinikoPatientAppointments patientId={cliniko.patientId} source={cliniko.source} />
        </div>
      ) : null}

      {sourceReady && !connectionError && showSearchCard ? (
        <Card className={TEXLEX_SECTION_CONTAINER_CLASS}>
          <CardContent className={cn(TEXLEX_SECTION_CONTENT_CLASS, "space-y-3")}>
            <div>
              <h3 className="text-[20px] font-semibold text-[#f4f8fc]">Search by name</h3>
              <p className="text-[15px] text-[#849aaf]">
                Or use the calendar above when the booking is on your schedule
              </p>
            </div>
            <label className="block space-y-1.5">
              <span className="sr-only">Search {practiceLabel(source)} patients</span>
              <input
                className={cn(inputClass, "w-full")}
                placeholder="Type patient name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </label>
            {searching ? (
              <div className="flex items-center gap-2 text-[15px] text-[#849aaf]">
                <Loader2 className="size-4 animate-spin" />
                Searching {practiceLabel(source)}…
              </div>
            ) : null}
            {slowSearch ? (
              <p className="text-[15px] text-[#849aaf]">{practiceLabel(source)} is taking longer than usual…</p>
            ) : null}
            <div className="space-y-1">
              {!searching && searchQuery.trim().length >= 2 && results.length === 0 ? (
                <p className="text-[15px] text-[#849aaf]">No results found</p>
              ) : null}
              {results.map((patient) => (
                <button
                  key={patient.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border border-[#2c455f] px-3 py-2 text-left text-[16px] text-[#f4f8fc] transition-colors hover:bg-[#1a3348]"
                  onClick={() => void handleSelectPatient(patient)}
                  disabled={loadingPatientId === patient.id}
                >
                  <span>
                    {patient.last_name}, {patient.first_name} · {formatDobLabel(patient.date_of_birth)} ·{" "}
                    {computeAgeLabel(patient.date_of_birth)}
                  </span>
                  {loadingPatientId === patient.id ? <Loader2 className="size-4 animate-spin" /> : null}
                </button>
              ))}
            </div>
            {cliniko ? (
              <button
                type="button"
                className="text-[15px] text-[#849aaf] underline-offset-4 hover:underline"
                onClick={() => setShowSearchCard(false)}
              >
                Hide search
              </button>
            ) : (
              <button
                type="button"
                className="text-[15px] text-[#849aaf] underline-offset-4 hover:underline"
                onClick={() => setShowSearchCard(false)}
              >
                Cancel / Manual entry
              </button>
            )}
          </CardContent>
        </Card>
      ) : sourceReady && !connectionError && cliniko && !showSearchCard ? (
        <button
          type="button"
          className="text-[16px] text-[#9fc3f2] underline-offset-4 hover:underline"
          onClick={() => setShowSearchCard(true)}
        >
          Search {practiceLabel(source)} by name
        </button>
      ) : null}
    </div>
  );
}
