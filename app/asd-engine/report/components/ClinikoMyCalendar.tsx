"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ClinikoHeyTex } from "./ClinikoHeyTex";
import type { ClinikoPatientAppointment, ClinikoPractitioner } from "@/lib/cliniko";

type ViewMode = "today" | "tomorrow" | "week";

const WEEKDAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Deterministic local formatting — avoids SSR/client locale hydration mismatches. */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatLongDay(d: Date): string {
  return `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function formatShortDay(d: Date): string {
  return `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

function formatShortDayMonthYear(d: Date): string {
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function formatShortDayMonth(d: Date): string {
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

function formatTimeOfDay(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Monday-start local week containing `anchor`. */
function startOfLocalWeek(anchor: Date): Date {
  const day = startOfLocalDay(anchor);
  const weekday = day.getDay(); // 0 Sun … 6 Sat
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  return addLocalDays(day, mondayOffset);
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function addLocalDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function formatRangeLabel(from: Date, toExclusive: Date): string {
  const end = addLocalDays(toExclusive, -1);
  const sameMonth = from.getMonth() === end.getMonth() && from.getFullYear() === end.getFullYear();
  if (from.getTime() === end.getTime()) return formatLongDay(from);
  const fromLabel = sameMonth ? formatShortDayMonth(from) : formatShortDayMonthYear(from);
  return `${fromLabel} – ${formatShortDayMonthYear(end)}`;
}

function weekOffsetLabel(weekOffset: number): string {
  if (weekOffset === 0) return "This week";
  if (weekOffset === -1) return "Last week";
  if (weekOffset === 1) return "Next week";
  if (weekOffset < 0) return `${Math.abs(weekOffset)} weeks ago`;
  return `${weekOffset} weeks ahead`;
}

function resolveRange(
  mode: ViewMode,
  weekOffset: number,
  now: Date
): { fromIso: string; toIso: string; label: string; showDayChips: boolean } {
  const today = startOfLocalDay(now);
  if (mode === "today") {
    return {
      fromIso: today.toISOString(),
      toIso: addLocalDays(today, 1).toISOString(),
      label: formatLongDay(today),
      showDayChips: false,
    };
  }
  if (mode === "tomorrow") {
    const tomorrow = addLocalDays(today, 1);
    return {
      fromIso: tomorrow.toISOString(),
      toIso: addLocalDays(tomorrow, 1).toISOString(),
      label: formatLongDay(tomorrow),
      showDayChips: false,
    };
  }
  const weekStart = addLocalDays(startOfLocalWeek(today), weekOffset * 7);
  const weekEndExclusive = addLocalDays(weekStart, 7);
  return {
    fromIso: weekStart.toISOString(),
    toIso: weekEndExclusive.toISOString(),
    label: `${weekOffsetLabel(weekOffset)} · ${formatRangeLabel(weekStart, weekEndExclusive)}`,
    showDayChips: true,
  };
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return formatTimeOfDay(date);
}

function formatDayChip(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return formatShortDay(date);
}

function stableModeLabel(mode: ViewMode, weekOffset: number): string {
  if (mode === "today") return "Today";
  if (mode === "tomorrow") return "Tomorrow";
  return weekOffsetLabel(weekOffset);
}

/** How far back/forward week browsing is allowed (≈ 1 year each way). */
const MAX_WEEK_OFFSET = 52;

export function ClinikoMyCalendar({
  onSelectPatientId,
  selectedPatientId = null,
  disabled = false,
  className,
  importFilesEnabled = false,
  onImportFilesEnabledChange,
  importingFiles = false,
  collateralDocs = [],
  collateralSummaryFilled = false,
}: {
  onSelectPatientId: (
    patientId: string,
    patientName: string | null,
    options: { importFiles: boolean; appointmentStartsAt: string | null }
  ) => void | Promise<void>;
  selectedPatientId?: string | null;
  disabled?: boolean;
  className?: string;
  /** Extra option: also pull Cliniko attachments into collateral after load. */
  importFilesEnabled?: boolean;
  onImportFilesEnabledChange?: (enabled: boolean) => void;
  importingFiles?: boolean;
  collateralDocs?: { filename: string; category: string }[];
  collateralSummaryFilled?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<ViewMode>("today");
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<ClinikoPatientAppointment[]>([]);
  const [practitioners, setPractitioners] = useState<ClinikoPractitioner[]>([]);
  const [practitionerId, setPractitionerId] = useState<string | null>(null);
  const [loadingPatientId, setLoadingPatientId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const range = useMemo(() => {
    // Avoid SSR/client timezone + locale mismatches: compute real range only after mount.
    if (!mounted) {
      return {
        fromIso: "",
        toIso: "",
        label: stableModeLabel(mode, weekOffset),
        showDayChips: mode === "week",
      };
    }
    return resolveRange(mode, weekOffset, new Date());
  }, [mounted, mode, weekOffset]);

  const selectMode = (next: ViewMode) => {
    setMode(next);
    if (next === "week") setWeekOffset(0);
  };

  const jumpToLastWeek = () => {
    setMode("week");
    setWeekOffset(-1);
  };

  const shiftWeek = (delta: number) => {
    setMode("week");
    setWeekOffset((current) => {
      const base = mode === "week" ? current : 0;
      return Math.max(-MAX_WEEK_OFFSET, Math.min(MAX_WEEK_OFFSET, base + delta));
    });
  };

  const load = useCallback(async () => {
    if (!mounted || !range.fromIso || !range.toIso) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        from: range.fromIso,
        to: range.toIso,
      });
      if (practitionerId) params.set("practitionerId", practitionerId);
      const response = await fetch(`/api/cliniko/schedule?${params.toString()}`);
      const data = (await response.json()) as {
        appointments?: ClinikoPatientAppointment[];
        practitioners?: ClinikoPractitioner[];
        practitionerId?: string | null;
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Could not load your Cliniko calendar.");
        setAppointments([]);
        return;
      }
      setAppointments(data.appointments ?? []);
      if (data.practitioners?.length) setPractitioners(data.practitioners);
      if (data.practitionerId && !practitionerId) setPractitionerId(data.practitionerId);
    } catch {
      setError("Could not load your Cliniko calendar.");
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [mounted, practitionerId, range.fromIso, range.toIso]);

  useEffect(() => {
    void load();
  }, [load]);

  const practitionerLabel = useMemo(() => {
    const match = practitioners.find((p) => p.id === practitionerId);
    return match?.displayName ?? null;
  }, [practitionerId, practitioners]);

  return (
    <div
      className={cn("rounded-lg border border-border/80 bg-muted/20 px-3 py-3", className)}
      data-testid="cliniko-my-calendar"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
          <div>
            <h4 className="text-sm font-semibold text-foreground">My Cliniko calendar</h4>
            <p className="text-xs text-muted-foreground">
              {practitionerLabel ? `${practitionerLabel} · ` : ""}
              {range.label}. Click a booking to load the patient.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={loading || disabled || !mounted}
          onClick={() => void load()}
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Refresh
        </Button>
      </div>

      {mounted ? (
        <ClinikoHeyTex
          className="mb-3"
          practitionerId={practitionerId}
          importFilesEnabled={importFilesEnabled}
          disabled={disabled || importingFiles}
          collateralDocs={collateralDocs}
          collateralSummaryFilled={collateralSummaryFilled}
          onLoadAppointment={async ({
            patientId,
            patientName,
            appointmentStartsAt,
            importFiles,
          }) => {
            setLoadingPatientId(patientId);
            try {
              await onSelectPatientId(patientId, patientName, {
                importFiles,
                appointmentStartsAt,
              });
            } finally {
              setLoadingPatientId(null);
            }
          }}
        />
      ) : null}

      <div className="mb-2 flex flex-wrap gap-1.5">
        {(
          [
            ["today", "Today"],
            ["tomorrow", "Tomorrow"],
            ["week", "This week"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs transition-colors",
              mode === key && (key !== "week" || weekOffset === 0)
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border/70 text-muted-foreground hover:bg-muted/50"
            )}
            onClick={() => selectMode(key)}
            disabled={disabled}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className={cn(
            "rounded-md border px-2.5 py-1 text-xs transition-colors",
            mode === "week" && weekOffset === -1
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border/70 text-muted-foreground hover:bg-muted/50"
          )}
          onClick={jumpToLastWeek}
          disabled={disabled}
        >
          Last week
        </button>
        {practitioners.length > 1 ? (
          <select
            className="ml-auto h-7 rounded-md border border-border/70 bg-background px-2 text-xs"
            value={practitionerId ?? ""}
            disabled={disabled || loading}
            onChange={(e) => setPractitionerId(e.target.value || null)}
          >
            {practitioners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2"
          disabled={disabled || (mode === "week" && weekOffset <= -MAX_WEEK_OFFSET)}
          onClick={() => shiftWeek(-1)}
          aria-label="Previous week"
        >
          <ChevronLeft className="size-3.5" />
          Prev week
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2"
          disabled={disabled || (mode === "week" && weekOffset >= MAX_WEEK_OFFSET)}
          onClick={() => shiftWeek(1)}
          aria-label="Next week"
        >
          Next week
          <ChevronRight className="size-3.5" />
        </Button>
        {mode === "week" && weekOffset !== 0 ? (
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            disabled={disabled}
            onClick={() => {
              setMode("week");
              setWeekOffset(0);
            }}
          >
            Jump to this week
          </button>
        ) : null}
      </div>

      {onImportFilesEnabledChange ? (
        <label className="mb-3 flex items-start gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={importFilesEnabled}
            disabled={disabled || importingFiles}
            onChange={(e) => onImportFilesEnabledChange(e.target.checked)}
          />
          <span>
            Also import Cliniko files into collateral (ASRS, forms, reports) when you click an
            appointment
          </span>
        </label>
      ) : null}

      {importingFiles ? (
        <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Importing Cliniko files into collateral…
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-amber-900 dark:text-amber-100" role="alert">
          {error}
        </p>
      ) : null}

      {(!mounted || loading) && appointments.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading appointments…
        </div>
      ) : null}

      {mounted && !loading && !error && appointments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No appointments in this range.</p>
      ) : null}

      {appointments.length > 0 ? (
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {appointments.map((appointment) => {
            const patientId = appointment.patient_id;
            const selected = Boolean(patientId && selectedPatientId === patientId);
            const busy = Boolean(patientId && loadingPatientId === patientId);
            return (
              <li key={appointment.id}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-start justify-between gap-3 rounded-md border px-2.5 py-2 text-left text-sm transition-colors",
                    selected
                      ? "border-primary/50 bg-primary/5"
                      : "border-border/60 hover:bg-muted/50",
                    (!patientId || disabled) && "cursor-not-allowed opacity-60"
                  )}
                  disabled={!patientId || disabled || busy}
                  onClick={() => {
                    if (!patientId || disabled) return;
                    setLoadingPatientId(patientId);
                    void Promise.resolve(
                      onSelectPatientId(patientId, appointment.patient_name, {
                        importFiles: importFilesEnabled,
                        appointmentStartsAt: appointment.starts_at,
                      })
                    ).finally(() => setLoadingPatientId(null));
                  }}
                >
                  <span className="min-w-0">
                    <span className="block font-medium text-foreground">
                      {appointment.patient_name?.trim() || "Patient"}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {range.showDayChips ? `${formatDayChip(appointment.starts_at)} · ` : ""}
                      {formatTime(appointment.starts_at)}
                      {appointment.ends_at ? `–${formatTime(appointment.ends_at)}` : ""}
                      {appointment.notes?.trim() ? ` · ${appointment.notes.trim()}` : ""}
                    </span>
                  </span>
                  {busy ? <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
