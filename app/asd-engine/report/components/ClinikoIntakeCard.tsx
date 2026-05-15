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
import type { PatientDetails } from "../page";
import {
  TEXLEX_SECTION_CONTAINER_CLASS,
  TEXLEX_SECTION_CONTENT_CLASS,
} from "../constants/texlexSectionSurface";

type ClinikoIntakeCardProps = {
  inputClass: string;
  patientDetails: PatientDetails;
  setPatientDetails: Dispatch<SetStateAction<PatientDetails>>;
  cliniko: ClinikoDraftState | null;
  setCliniko: Dispatch<SetStateAction<ClinikoDraftState | null>>;
  onTouch: () => void;
  onLoaded: (message: string) => void;
  onError: (message: string) => void;
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
}: ClinikoIntakeCardProps) {
  const [configured, setConfigured] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showSearchCard, setShowSearchCard] = useState(() => !cliniko);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [slowSearch, setSlowSearch] = useState(false);
  const [results, setResults] = useState<ClinikoPatient[]>([]);
  const [loadingPatientId, setLoadingPatientId] = useState<string | null>(null);
  const onErrorRef = useRef(onError);
  const onLoadedRef = useRef(onLoaded);

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

  const handleSelectPatient = async (patient: ClinikoPatient) => {
    setLoadingPatientId(patient.id);
    try {
      const response = await fetch(`/api/cliniko/patients/${patient.id}`);
      const data = (await response.json()) as {
        patient?: Parameters<typeof applyClinikoPatientToForm>[0];
        customFields?: Parameters<typeof applyClinikoPatientToForm>[1];
        error?: string;
      };
      if (!response.ok || !data.patient) {
        onError(data.error ?? "Could not load Cliniko patient.");
        return;
      }

      const mapped = applyClinikoPatientToForm(data.patient, data.customFields ?? {});
      onTouch();
      setPatientDetails((current) => ({
        ...current,
        ...mapped,
      }));
      setCliniko({
        patientId: patient.id,
        connectedName: mapped.clientName || `${patient.last_name}, ${patient.first_name}`,
        syncEnabled: true,
        baseline: buildClinikoBaseline(data.patient, data.customFields ?? {}, mapped),
      });
      setShowSearchCard(false);
      onLoaded(`Loaded ${mapped.clientName || `${patient.first_name} ${patient.last_name}`.trim()} from Cliniko`);
    } catch {
      onError("Could not load Cliniko patient.");
    } finally {
      setLoadingPatientId(null);
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

      {cliniko && !showSearchCard ? (
        <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 px-3 py-2">
          <p className="text-sm">
            Connected to Cliniko · {connectedLabel} ·{" "}
            <button type="button" className="underline-offset-4 hover:underline" onClick={() => setShowSearchCard(true)}>
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
        </div>
      ) : null}

      {configured && !connectionError && showSearchCard ? (
        <Card className={TEXLEX_SECTION_CONTAINER_CLASS}>
          <CardContent className={cn(TEXLEX_SECTION_CONTENT_CLASS, "space-y-4")}>
            <div>
              <h3 className="text-base font-semibold">Load from Cliniko</h3>
              <p className="text-sm text-muted-foreground">Search Cliniko to auto-fill client details</p>
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
