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
}: ClinikoIntakeCardProps) {
  const [configured, setConfigured] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showSearchCard, setShowSearchCard] = useState(() => !cliniko);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [slowSearch, setSlowSearch] = useState(false);
  const [results, setResults] = useState<ClinikoPatient[]>([]);
  const [loadingPatientId, setLoadingPatientId] = useState<string | null>(null);
  const [importFilesEnabled, setImportFilesEnabled] = useState(true);
  const [importingFiles, setImportingFiles] = useState(false);
  const onErrorRef = useRef(onError);
  const onLoadedRef = useRef(onLoaded);
  const collateralDocsRef = useRef(collateralDocs);
  const canImportFiles = Boolean(setCollateralDocs);

  useEffect(() => {
    collateralDocsRef.current = collateralDocs;
  }, [collateralDocs]);

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
    void (async () => {
      try {
        const response = await fetch("/api/cliniko/status");
        const data = (await response.json()) as {
          configured?: boolean;
          connected?: boolean;
          error?: string;
        };
        if (cancelled) return;
        if (!data.configured) {
          console.warn("Cliniko credentials not configured.");
          setConfigured(false);
          return;
        }
        setConfigured(true);
        if (!data.connected) {
          setConnectionError("Cliniko connection failed. Check API key in environment configuration.");
        }
      } catch {
        if (!cancelled) {
          setConfigured(true);
          setConnectionError("Cliniko connection failed. Check API key in environment configuration.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!configured || connectionError || !showSearchCard) {
      setResults([]);
      setSearching(false);
      setSlowSearch(false);
      return;
    }

    const trimmed = searchQuery.trim();
    console.log("[cliniko-ui] search effect", { configured, connectionError, showSearchCard, trimmed });
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      setSlowSearch(false);
      return;
    }

    let cancelled = false;
    const slowTimer = setTimeout(() => setSlowSearch(true), 5000);
    const debounceTimer = setTimeout(() => {
      setSearching(true);
      void (async () => {
        try {
          const response = await fetch(`/api/cliniko/patients/search?q=${encodeURIComponent(trimmed)}`);
          const data = (await response.json()) as { patients?: ClinikoPatient[]; error?: string };
          if (cancelled) return;
          if (!response.ok) {
            onErrorRef.current(data.error ?? "Cliniko search failed.");
            setResults([]);
            return;
          }
          setResults((data.patients ?? []).slice(0, 10));
        } catch {
          if (!cancelled) onErrorRef.current("Cliniko search failed.");
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
    };
  }, [configured, connectionError, searchQuery, showSearchCard]);

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
      const response = await fetch(`/api/cliniko/patients/${patient.id}${engineQuery}`);
      const data = (await response.json()) as {
        patient?: Parameters<typeof applyClinikoPatientToForm>[0];
        customFields?: Parameters<typeof applyClinikoPatientToForm>[1];
        registration?: RegistrationDemographics | null;
        mergedDetails?: ReturnType<typeof applyClinikoPatientToForm> | null;
        error?: string;
      };
      if (!response.ok || !data.patient) {
        onError(data.error ?? "Could not load Cliniko patient.");
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
        syncEnabled: true,
        baseline: buildClinikoBaseline(data.patient, data.customFields ?? {}, mapped),
      });
      setShowSearchCard(false);

      const nameLabel =
        mapped.clientName || `${data.patient.first_name} ${data.patient.last_name}`.trim();
      let loadedMessage = `Loaded ${nameLabel} from Cliniko`;
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
            existingDocs: collateralDocsRef.current ?? [],
            // ADHD: curated instruments only. ASD: all importable patient files.
            asrsOnly: engine === "adhd",
          });
          if (result.additions.length > 0) {
            setCollateralDocs((prev) => mergeImportedCollateralDocs(prev, result.additions));
          }
          const importNotice = formatClinikoImportNotice(result);
          if (importNotice) loadedMessage = `${loadedMessage}. ${importNotice}`;
          if (result.error) onError(result.error);
        } catch {
          onError("Patient loaded, but Cliniko file import failed.");
        } finally {
          setImportingFiles(false);
        }
      }

      onLoaded(loadedMessage);
    } catch {
      onError("Could not load Cliniko patient.");
    } finally {
      setLoadingPatientId(null);
      onPatientLoadEnd?.();
    }
  };

  if (configured === false) return null;

  return (
    <div className="space-y-3" data-testid="cliniko-intake">
      {connectionError ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          {connectionError}
        </p>
      ) : null}

      {configured && !connectionError ? (
        <ClinikoMyCalendar
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

      {cliniko && !showSearchCard ? (
        <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 px-3 py-2">
          <p className="text-sm">
            Connected to Cliniko · {connectedLabel} ·{" "}
            <button
              type="button"
              className={cn(
                "underline-offset-4",
                changePatientDisabled
                  ? "cursor-not-allowed opacity-50"
                  : "hover:underline"
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
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={cliniko.syncEnabled}
              onChange={(e) =>
                setCliniko((current) => (current ? { ...current, syncEnabled: e.target.checked } : current))
              }
            />
            Sync changes back to Cliniko
          </label>
          <ClinikoPatientAppointments patientId={cliniko.patientId} />
        </div>
      ) : null}

      {configured && !connectionError && showSearchCard ? (
        <Card className={TEXLEX_SECTION_CONTAINER_CLASS}>
          <CardContent className={cn(TEXLEX_SECTION_CONTENT_CLASS, "space-y-4")}>
            <div>
              <h3 className="text-base font-semibold">Or search by name</h3>
              <p className="text-sm text-muted-foreground">
                Prefer the calendar above when the booking is on your schedule
              </p>
            </div>
            <label className="block space-y-1.5">
              <span className="sr-only">Search Cliniko patients</span>
              <input
                className={cn(inputClass, "w-full")}
                placeholder="Type patient name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </label>
            {searching ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Searching Cliniko…
              </div>
            ) : null}
            {slowSearch ? <p className="text-sm text-muted-foreground">Cliniko is taking longer than usual…</p> : null}
            <div className="space-y-1">
              {!searching && searchQuery.trim().length >= 2 && results.length === 0 ? (
                <p className="text-sm text-muted-foreground">No results found</p>
              ) : null}
              {results.map((patient) => (
                <button
                  key={patient.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border border-border/70 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
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
            <button
              type="button"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setShowSearchCard(false)}
            >
              Cancel / Manual entry
            </button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
