/**
 * Auditor case-list helpers for AHPRA-style selection:
 * date of assessment, age, modality, report date, diagnostic outcome.
 */

import {
  patientIdFromEngineDraftKey,
  readLocalEngineDraft,
  UNASSIGNED_DRAFT_ID,
} from "@/lib/engine-draft-storage";
import {
  resolveTexlexDiagnosticConclusion,
  type TexlexDiagnosticConclusion,
} from "@/lib/texlex-diagnostic-conclusion";
import type { TexlexEngineId } from "@/lib/texlex-report-state";

export type AuditorCaseRow = {
  clientName: string;
  dateOfAssessment: string;
  ageAtAssessment: string;
  assessmentModality: string;
  dateReportCompleted: string;
  diagnosticOutcome: string;
  source: "local" | "cloud";
  lastSaved: string | null;
  patientId: string | null;
  storageKey: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Chronological age at a reference date (assessment day preferred). */
export function ageAtReferenceDate(dobString: string, asOfIso: string): string {
  const dobRaw = dobString.trim();
  const asOfRaw = asOfIso.trim();
  if (!dobRaw) return "";
  const dob = new Date(dobRaw);
  const asOf = asOfRaw ? new Date(asOfRaw) : new Date();
  if (!Number.isFinite(dob.getTime()) || !Number.isFinite(asOf.getTime())) return "";
  let years = asOf.getFullYear() - dob.getFullYear();
  let months = asOf.getMonth() - dob.getMonth();
  if (asOf.getDate() < dob.getDate()) months--;
  if (months < 0) {
    years--;
    months += 12;
  }
  if (years < 0 || years > 150) return "";
  months = Math.min(11, Math.max(0, months));
  return `${years}y ${months}m`;
}

export function formatDiagnosticOutcomeLabel(
  conclusion: TexlexDiagnosticConclusion,
  levelA: number | null,
  levelB: number | null
): string {
  if (conclusion === "does_not_meet") return "Does not meet criteria";
  if (conclusion === "inconclusive") return "Inconclusive / deferred";
  if (levelA != null && levelB != null) {
    return `Meets criteria — Level A${levelA} / B${levelB}`;
  }
  return "Meets criteria";
}

function modalityLabel(raw: string): string {
  if (raw === "in-clinic") return "In-clinic";
  if (raw === "virtual") return "Virtual / telehealth";
  return raw || "Unset";
}

function levelsFromState(state: Record<string, unknown>): {
  levelA: number | null;
  levelB: number | null;
} {
  const audit = asRecord(state.severityAudit);
  const a =
    typeof audit?.confirmed_levelA === "number"
      ? audit.confirmed_levelA
      : typeof state.severityLevelA === "number"
        ? state.severityLevelA
        : null;
  const b =
    typeof audit?.confirmed_levelB === "number"
      ? audit.confirmed_levelB
      : typeof state.severityLevelB === "number"
        ? state.severityLevelB
        : null;
  return { levelA: a, levelB: b };
}

/** Map a saved engine draft state into one auditor case-list row. */
export function auditorCaseRowFromDraftState(args: {
  state: Record<string, unknown>;
  source: "local" | "cloud";
  storageKey: string;
  patientId: string | null;
  lastSavedFallback?: string | null;
}): AuditorCaseRow | null {
  const { state, source, storageKey, patientId, lastSavedFallback } = args;
  const details = asRecord(state.patientDetails);
  if (!details) return null;

  const clientName = asString(details.clientName);
  const assessmentDates = Array.isArray(details.assessmentDates)
    ? details.assessmentDates.map(asString).filter(Boolean)
    : [];
  const legacyDate = asString(details.dateOfAssessment);
  const dateOfAssessment =
    assessmentDates.length > 0 ? assessmentDates.join("; ") : legacyDate;
  const primaryAssessmentDate = assessmentDates[0] || legacyDate;
  const dob = asString(details.dob) || asString(details.date_of_birth) || asString(details.dateOfBirth);
  const reportDate = asString(details.reportDate);
  const modality = modalityLabel(asString(details.assessmentModality));
  const conclusion = resolveTexlexDiagnosticConclusion(state.diagnosticConclusion);
  const { levelA, levelB } = levelsFromState(state);
  const lastSaved =
    asString(state.lastSaved) || (lastSavedFallback?.trim() ? lastSavedFallback.trim() : null);

  // Skip empty shells with no identifying clinical fields
  if (!clientName && !dateOfAssessment && !reportDate && modality === "Unset") {
    return null;
  }

  return {
    clientName: clientName || "(unnamed)",
    dateOfAssessment: dateOfAssessment || "—",
    ageAtAssessment: ageAtReferenceDate(dob, primaryAssessmentDate) || "—",
    assessmentModality: modality,
    dateReportCompleted: reportDate || "—",
    diagnosticOutcome: formatDiagnosticOutcomeLabel(conclusion, levelA, levelB),
    source,
    lastSaved,
    patientId,
    storageKey,
  };
}

/** Scan this browser's engine drafts for auditor case-list rows. */
export function listLocalAuditorCaseRows(engine: TexlexEngineId): AuditorCaseRow[] {
  if (typeof window === "undefined") return [];
  const rows: AuditorCaseRow[] = [];
  const prefix = `${engine}:`;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      if (key === `${engine}:active-key`) continue;
      const draft = readLocalEngineDraft<Record<string, unknown>>(key);
      if (!draft) continue;
      const patientId = patientIdFromEngineDraftKey(engine, key);
      const row = auditorCaseRowFromDraftState({
        state: draft,
        source: "local",
        storageKey: key,
        patientId,
      });
      if (row) rows.push(row);
    }
  } catch {
    return rows;
  }
  rows.sort((a, b) => (b.lastSaved ?? "").localeCompare(a.lastSaved ?? ""));
  return rows;
}

/** Prefer cloud over local when the same patient/storage identity appears twice. */
export function mergeAuditorCaseRows(
  localRows: AuditorCaseRow[],
  cloudRows: AuditorCaseRow[]
): AuditorCaseRow[] {
  const byKey = new Map<string, AuditorCaseRow>();
  const identity = (r: AuditorCaseRow) => {
    if (r.patientId) return `pid:${r.patientId}`;
    const rest = r.storageKey.includes(":")
      ? r.storageKey.slice(r.storageKey.indexOf(":") + 1)
      : r.storageKey;
    if (rest && rest !== UNASSIGNED_DRAFT_ID) return `key:${rest}`;
    return `name:${r.clientName.toLowerCase()}|${r.dateOfAssessment}`;
  };
  for (const row of localRows) byKey.set(identity(row), row);
  for (const row of cloudRows) byKey.set(identity(row), row); // cloud wins
  return [...byKey.values()].sort((a, b) =>
    (b.dateReportCompleted || b.lastSaved || "").localeCompare(
      a.dateReportCompleted || a.lastSaved || ""
    )
  );
}

export function auditorCaseRowsToCsv(rows: AuditorCaseRow[]): string {
  const headers = [
    "Client name",
    "Date of assessment",
    "Age at assessment",
    "Assessment modality",
    "Date report completed",
    "Diagnostic outcome",
    "Source",
    "Patient ID",
    "Last saved",
  ];
  const escape = (value: string) => {
    if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.clientName,
        r.dateOfAssessment,
        r.ageAtAssessment,
        r.assessmentModality,
        r.dateReportCompleted,
        r.diagnosticOutcome,
        r.source,
        r.patientId ?? "",
        r.lastSaved ?? "",
      ]
        .map(escape)
        .join(",")
    );
  }
  return lines.join("\n");
}

export function downloadAuditorCaseListCsv(rows: AuditorCaseRow[], filename?: string): void {
  if (typeof window === "undefined") return;
  const csv = auditorCaseRowsToCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    filename ??
    `texlex-asd-auditor-case-list-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
