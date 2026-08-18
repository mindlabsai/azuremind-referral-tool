"use client";

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { FileDown, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ClinikoPatientAttachment } from "@/lib/cliniko";
import { formatFileSize, type CollateralDoc } from "@/lib/collateral/collateral-docs-client";
import {
  formatClinikoImportNotice,
  importClinikoAttachmentsIntoCollateral,
  isClinikoAttachmentAutoImportCandidate,
} from "@/lib/collateral/import-cliniko-attachments";

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
}: {
  patientId: string | null | undefined;
  collateralDocs: CollateralDoc[];
  setCollateralDocs: Dispatch<SetStateAction<CollateralDoc[]>>;
  touch: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<ClinikoPatientAttachment[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [asrsOnly, setAsrsOnly] = useState(true);

  const loadAttachments = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/cliniko/attachments?patientId=${encodeURIComponent(patientId)}`
      );
      const data = (await response.json()) as {
        attachments?: ClinikoPatientAttachment[];
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Could not list Cliniko files.");
        setAttachments([]);
        return;
      }
      const list = data.attachments ?? [];
      setAttachments(list);
      const defaults = new Set(
        list.filter((a) => a.processingCompleted && a.importable && a.likelyAsrs).map((a) => a.id)
      );
      setSelectedIds(defaults);
    } catch {
      setError("Could not list Cliniko files.");
      setAttachments([]);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    if (!patientId || !open) return;
    void loadAttachments();
  }, [patientId, open, loadAttachments]);

  const visible = useMemo(() => {
    return attachments.filter((a) => {
      if (!isClinikoAttachmentAutoImportCandidate(a) && !(a.processingCompleted && a.importable)) {
        return false;
      }
      if (!a.processingCompleted || !a.importable) return false;
      if (asrsOnly && !a.likelyAsrs) return false;
      return true;
    });
  }, [attachments, asrsOnly]);

  const alreadyImportedNames = useMemo(() => {
    return new Set(collateralDocs.map((d) => d.filename.trim().toLowerCase()).filter(Boolean));
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
    });

    if (result.additions.length > 0) {
      setCollateralDocs((prev) => [...prev, ...result.additions]);
      setSelectedIds(new Set());
    }
    const msg = formatClinikoImportNotice(result);
    if (msg) setNotice(msg);
    if (result.error) setError(result.error);
    setImporting(false);
  };

  if (!patientId) return null;

  return (
    <div className="space-y-3 rounded-lg border border-border/80 bg-muted/15 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">Import from Cliniko</p>
          <p className="text-xs text-muted-foreground">
            Pull ASRS forms and other patient files into collateral for review.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen((v) => !v)}
        >
          <FileDown className="size-3.5" />
          {open ? "Hide Cliniko files" : "Browse Cliniko files"}
        </Button>
      </div>

      {open ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={asrsOnly}
                onChange={(e) => setAsrsOnly(e.target.checked)}
              />
              Show likely ASRS / rating forms first
            </label>
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
              Loading Cliniko files…
            </div>
          ) : null}

          {!loading && visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {asrsOnly
                ? "No ASRS-named PDFs found. Untick the filter to see all importable files."
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
                          {attachment.likelyAsrs ? (
                            <span className="ml-2 text-xs font-normal text-teal-700 dark:text-teal-300">
                              ASRS?
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
