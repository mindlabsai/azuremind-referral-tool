"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { FileDown, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ClinikoPatient, ClinikoPatientAttachment } from "@/lib/cliniko";
import { formatFileSize, type CollateralDoc } from "@/lib/collateral/collateral-docs-client";
import {
  formatClinikoImportNotice,
  importClinikoAttachmentsIntoCollateral,
  isClinikoAttachmentAutoImportCandidate,
  mergeImportedCollateralDocs,
} from "@/lib/collateral/import-cliniko-attachments";
import { practiceApiBase, practiceLabel, type PracticeSource } from "@/lib/practice-source";

function clinikoLookupQueries(clientName: string): string[] {
  const raw = clientName.trim();
  const withoutTitle = raw.replace(/^(master|miss|mr|mrs|ms|dr)\.?\s+/i, "");
  const withoutParen = withoutTitle.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  const last = withoutParen.split(/\s+/).filter(Boolean).pop() ?? "";
  return [...new Set([withoutParen, raw, last].filter((query) => query.length >= 3))];
}

function formatCreatedAt(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function ClinikoCollateralImport({
  patientId,
  collateralDocs,
  setCollateralDocs,
  touch,
  engine = null,
  source = "cliniko",
  clientName = "",
  dateOfBirth = "",
  onLinkPatient,
}: {
  patientId: string | null | undefined;
  collateralDocs: CollateralDoc[];
  setCollateralDocs: Dispatch<SetStateAction<CollateralDoc[]>>;
  touch: () => void;
  engine?: "asd" | "adhd" | null;
  source?: PracticeSource;
  clientName?: string;
  dateOfBirth?: string;
  onLinkPatient?: (patientId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<ClinikoPatientAttachment[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  // Cliniko defaults to preferred forms. Halaxy shows every file for manual selection.
  const [preferredOnly, setPreferredOnly] = useState(source !== "halaxy" && engine !== "asd");
  const [clinikoMatches, setClinikoMatches] = useState<ClinikoPatient[]>([]);
  const [lookingUpCliniko, setLookingUpCliniko] = useState(false);
  const [linkingCliniko, setLinkingCliniko] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const linkAttempted = useRef(new Set<string>());

  const loadAttachments = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${practiceApiBase(source)}/attachments?patientId=${encodeURIComponent(patientId)}`
      );
      const data = (await response.json()) as {
        attachments?: ClinikoPatientAttachment[];
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? `Could not list ${practiceLabel(source)} files.`);
        setAttachments([]);
        return;
      }
      const list = data.attachments ?? [];
      setAttachments(list);
      if (source === "halaxy") {
        setSelectedIds(new Set());
        return;
      }
      const defaults = new Set(
        list
          .filter((a) => a.processingCompleted && a.importable && a.likelyAsrs)
          .map((a) => a.id)
      );
      setSelectedIds(defaults);
    } catch {
      setError(`Could not list ${practiceLabel(source)} files.`);
      setAttachments([]);
    } finally {
      setLoading(false);
    }
  }, [patientId, source]);

  useEffect(() => {
    if (patientId) setOpen(true);
  }, [patientId]);

  useEffect(() => {
    if (!patientId || !open) return;
    void loadAttachments();
  }, [patientId, open, loadAttachments]);

  const linkClinikoPatient = useCallback(
    async (id: string) => {
      if (!onLinkPatient) return;
      setLinkingCliniko(true);
      setLinkError(null);
      try {
        await onLinkPatient(id);
      } catch (error) {
        linkAttempted.current.delete(id);
        setLinkError(error instanceof Error ? error.message : "Could not link the Cliniko patient.");
      } finally {
        setLinkingCliniko(false);
      }
    },
    [onLinkPatient]
  );

  useEffect(() => {
    if (patientId || source === "halaxy") {
      setClinikoMatches([]);
      return;
    }
    const queries = clinikoLookupQueries(clientName);
    if (queries.length === 0) {
      setClinikoMatches([]);
      return;
    }
    let cancelled = false;
    setLookingUpCliniko(true);
    setLinkError(null);
    void (async () => {
      let found: ClinikoPatient[] = [];
      for (const query of queries) {
        try {
          const response = await fetch(`/api/cliniko/patients/search?q=${encodeURIComponent(query)}`);
          const data = (await response.json()) as { patients?: ClinikoPatient[] };
          const patients = data.patients ?? [];
          if (dateOfBirth) {
            const dobHits = patients.filter((patient) => patient.date_of_birth === dateOfBirth);
            if (dobHits.length > 0) {
              found = dobHits;
              break;
            }
          } else if (patients.length > 0) {
            found = patients;
            break;
          }
        } catch {
          if (!cancelled) setLinkError("Could not search Cliniko.");
        }
      }
      if (cancelled) return;
      setClinikoMatches(found);
      setLookingUpCliniko(false);
      const only = found.length === 1 ? found[0] : null;
      if (
        only &&
        dateOfBirth &&
        only.date_of_birth === dateOfBirth &&
        onLinkPatient &&
        !linkAttempted.current.has(only.id)
      ) {
        linkAttempted.current.add(only.id);
        void linkClinikoPatient(only.id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientName, dateOfBirth, linkClinikoPatient, onLinkPatient, patientId, source]);

  const visible = useMemo(() => {
    if (source === "halaxy") {
      return attachments.filter((a) => Boolean(a.filename.trim()));
    }
    return attachments.filter((a) => {
      if (!isClinikoAttachmentAutoImportCandidate(a) && !(a.processingCompleted && a.importable)) {
        return false;
      }
      if (!a.processingCompleted || !a.importable) return false;
      if (preferredOnly && !a.likelyAsrs) return false;
      return true;
    });
  }, [attachments, preferredOnly, source]);

  const alreadyImportedNames = useMemo(() => {
    return new Set(
      collateralDocs
        .filter((d) => Boolean(d.pdfBase64) || !d.filename.toLowerCase().endsWith(".pdf"))
        .map((d) => d.filename.trim().toLowerCase())
        .filter(Boolean)
    );
  }, [collateralDocs]);

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const importSelected = async () => {
    if (!patientId) return;
    const ids = visible.filter((a) => selectedIds.has(a.id)).map((a) => a.id);
    if (ids.length === 0) {
      setError("Select at least one file to import.");
      return;
    }

    setImporting(true);
    setError(null);
    setNotice(null);
    touch();

    const result = await importClinikoAttachmentsIntoCollateral({
      patientId,
      existingDocs: collateralDocs,
      attachmentIds: ids,
      apiBase: practiceApiBase(source),
    });

    if (result.additions.length > 0) {
      setCollateralDocs((prev) => mergeImportedCollateralDocs(prev, result.additions));
      setSelectedIds(new Set());
    }
    const msg = formatClinikoImportNotice(result, practiceLabel(source));
    if (msg) setNotice(msg);
    if (result.error) setError(result.error);
    setImporting(false);
  };

  if (!patientId) {
    const namedMatches = dateOfBirth
      ? clinikoMatches.filter((patient) => patient.date_of_birth === dateOfBirth)
      : clinikoMatches;
    return (
      <div className="space-y-2 rounded-lg border border-border/80 bg-muted/15 px-3 py-3">
        <p className="text-sm font-semibold text-foreground">Cliniko is not linked</p>
        <p className="text-xs text-muted-foreground">
          Reports stay in Cliniko until this report is linked to the patient.
        </p>
        {lookingUpCliniko || linkingCliniko ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {linkingCliniko ? "Linking the Cliniko patient…" : "Looking up this name in Cliniko…"}
          </p>
        ) : null}
        {!lookingUpCliniko && !linkingCliniko && namedMatches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {clientName.trim()
              ? "No Cliniko patient matches this name and date of birth."
              : "Add the client name, then Cliniko can be linked from here."}
          </p>
        ) : null}
        {namedMatches.length > 0 ? (
          <ul className="space-y-1">
            {namedMatches.map((patient) => (
              <li key={patient.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-foreground">
                  {`${patient.first_name} ${patient.last_name}`.trim()}
                  {patient.date_of_birth ? ` · ${patient.date_of_birth}` : ""}
                </span>
                <Button
                  type="button"
                  size="sm"
                  disabled={linkingCliniko || !onLinkPatient}
                  onClick={() => void linkClinikoPatient(patient.id)}
                >
                  Link Cliniko
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        {linkError ? (
          <p className="text-sm text-destructive" role="alert">
            {linkError}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border/80 bg-muted/15 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">Import from {practiceLabel(source)}</p>
          <p className="text-xs text-muted-foreground">
            {source === "halaxy"
              ? "Every file on this Halaxy patient. Tick the ones to import."
              : engine === "adhd"
                ? "Pull Vanderbilt, Conners, teacher, OT, speech, and ASRS files into collateral."
                : "Pull ASRS, rating forms, and other patient files into collateral for review."}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen((v) => !v)}
        >
          <FileDown className="size-3.5" />
          {open ? `Hide ${practiceLabel(source)} files` : `Browse ${practiceLabel(source)} files`}
        </Button>
      </div>

      {open ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {source === "halaxy" ? null : (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={preferredOnly}
                  onChange={(e) => setPreferredOnly(e.target.checked)}
                />
                {engine === "adhd"
                  ? "Show Vanderbilt / Conners / teacher / OT / speech / ASRS only"
                  : "Show preferred rating & allied-health forms only"}
              </label>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={loading || importing}
              onClick={() => void loadAttachments()}
            >
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading {practiceLabel(source)} files…
            </div>
          ) : null}

          {!loading && visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {source === "halaxy"
                ? "No files came back from Halaxy for this patient."
                : preferredOnly
                  ? "No preferred forms found (Vanderbilt, Conners, teacher, OT, speech, ASRS). Untick the filter to see all importable files."
                  : "No importable Cliniko attachments found for this patient."}
            </p>
          ) : null}

          {visible.length > 0 ? (
            <ul className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border/60 bg-background p-2">
              {visible.map((attachment) => {
                const already = alreadyImportedNames.has(attachment.filename.trim().toLowerCase());
                return (
                  <li key={attachment.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50",
                        already && "opacity-60"
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selectedIds.has(attachment.id)}
                        disabled={already || importing}
                        onChange={() => toggleId(attachment.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">
                          {attachment.filename}
                          {source !== "halaxy" && attachment.likelyAsrs ? (
                            <span className="ml-2 text-xs font-normal text-teal-700 dark:text-teal-300">
                              preferred
                            </span>
                          ) : null}
                          {already ? (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              already imported
                            </span>
                          ) : null}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {[
                            attachment.size != null ? formatFileSize(attachment.size) : null,
                            formatCreatedAt(attachment.createdAt),
                            attachment.description || null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : null}

          <Button
            type="button"
            size="sm"
            disabled={importing || loading || selectedIds.size === 0}
            onClick={() => void importSelected()}
          >
            {importing ? <Loader2 className="size-3.5 animate-spin" /> : <FileDown className="size-3.5" />}
            Import selected into collateral
          </Button>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="text-sm text-foreground" role="status">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
