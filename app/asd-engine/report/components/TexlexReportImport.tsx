"use client";

import { useCallback, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { TexlexEngineId } from "@/lib/texlex-report-state";
import type { TexlexImportedReport } from "@/lib/texlex-report-import/types";

type TexlexReportImportProps = {
  engine: TexlexEngineId;
  hasExistingContent: boolean;
  onApply: (imported: TexlexImportedReport, opts: { overwritePatientDetails: boolean }) => void;
  className?: string;
};

export function TexlexReportImport({
  engine,
  hasExistingContent,
  onApply,
  className,
}: TexlexReportImportProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [paste, setPaste] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<TexlexImportedReport | null>(null);
  const [overwritePatientDetails, setOverwritePatientDetails] = useState(false);
  const [open, setOpen] = useState(false);

  const resetSource = useCallback(() => {
    setFile(null);
    setFileName(null);
    setPaste("");
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const runImport = useCallback(async () => {
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      const form = new FormData();
      form.set("engine", engine);
      if (file) form.set("file", file);
      else if (paste.trim()) form.set("text", paste);
      else {
        setError("Upload a Texlex PDF or paste the full report text.");
        return;
      }
      const res = await fetch("/api/report-import", { method: "POST", body: form });
      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        import?: TexlexImportedReport;
      };
      if (!res.ok || !data.success || !data.import) {
        setError(data.error || "Import failed.");
        return;
      }
      setPreview(data.import);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }, [engine, file, paste]);

  const apply = useCallback(() => {
    if (!preview) return;
    if (hasExistingContent) {
      const ok = window.confirm(
        `Apply imported report into ${preview.filledSectionLabels.length} section(s)? Existing text in those sections will be replaced. Other sections stay as they are.`
      );
      if (!ok) return;
    }
    onApply(preview, { overwritePatientDetails });
    setPreview(null);
    resetSource();
    setOpen(false);
  }, [hasExistingContent, onApply, overwritePatientDetails, preview, resetSource]);

  return (
    <div className={cn("rounded-lg border border-border/80 bg-muted/20", className)}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <p className="text-sm font-medium text-foreground">Import finished report</p>
          <p className="text-xs text-muted-foreground">
            Recover a PDF or pasted report into editable sections for typo fixes — text is copied, not
            rewritten. Use the original Texlex report PDF (not a previous Preview download).
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-border/80 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const next = e.target.files?.[0] ?? null;
                setFile(next);
                setFileName(next?.name ?? null);
                setPreview(null);
                setError(null);
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              {fileName ? "Change PDF" : "Upload PDF"}
            </Button>
            {fileName ? (
              <span className="truncate text-xs text-muted-foreground">{fileName}</span>
            ) : (
              <span className="text-xs text-muted-foreground">or paste text below</span>
            )}
          </div>

          <Textarea
            value={paste}
            disabled={busy || !!file}
            placeholder="Paste the full report text here if you don’t have the PDF…"
            className="min-h-[110px] text-sm"
            onChange={(e) => {
              setPaste(e.target.value);
              setPreview(null);
              setError(null);
            }}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={() => void runImport()}>
              {busy ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Mapping sections…
                </>
              ) : (
                "Map into sections"
              )}
            </Button>
            {(file || paste || preview) && !busy ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  resetSource();
                  setPreview(null);
                  setError(null);
                }}
              >
                Clear
              </Button>
            ) : null}
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {preview ? (
            <div className="space-y-2 rounded-md border border-emerald-300/50 bg-emerald-50/80 px-3 py-2 dark:border-emerald-800/50 dark:bg-emerald-950/30">
              <p className="text-sm font-medium text-foreground">
                Ready to load · {preview.confidence} confidence · {preview.method} map
              </p>
              <p className="text-xs text-muted-foreground">
                {preview.filledSectionLabels.length
                  ? preview.filledSectionLabels.join(" · ")
                  : "No sections detected"}
              </p>
              {preview.patientDetails.clientName ? (
                <p className="text-xs text-muted-foreground">
                  Client: {preview.patientDetails.clientName}
                  {preview.patientDetails.dob ? ` · DOB ${preview.patientDetails.dob}` : ""}
                </p>
              ) : null}
              {preview.engine === "asd" ? (
                <p className="text-xs text-muted-foreground">
                  Ratings:{" "}
                  {Object.entries(preview.sections.criteria ?? {})
                    .map(([code, row]) => `${code}=${row?.rating ?? "—"}`)
                    .join(" · ") || "none detected"}
                  {preview.diagnosticConclusion
                    ? ` · Conclusion: ${preview.diagnosticConclusion}`
                    : ""}
                </p>
              ) : null}
              {preview.warnings.length ? (
                <ul className="list-disc space-y-0.5 pl-4 text-xs text-amber-800 dark:text-amber-200">
                  {preview.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
              <label className="flex items-center gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={overwritePatientDetails}
                  onChange={(e) => setOverwritePatientDetails(e.target.checked)}
                />
                Overwrite existing client-detail fields (otherwise only empty fields are filled)
              </label>
              <Button type="button" size="sm" onClick={apply}>
                Load into report
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
