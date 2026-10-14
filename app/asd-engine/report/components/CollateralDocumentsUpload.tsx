"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type DragEvent,
  type SetStateAction,
} from "react";
import { File as FileIcon, FileText, Image, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  COLLATERAL_INPUT_ACCEPT,
  COLLATERAL_MAX_FILE_BYTES,
  COLLATERAL_MAX_FILES,
  COLLATERAL_MAX_TOTAL_BYTES,
  DEFAULT_DOC_CATEGORY,
  DOC_CATEGORIES,
  buildCollateralManifestForApi,
  collateralAiStatusLabel,
  formatFileSize,
  getFileTypeLabel,
  isCollateralPdfDoc,
  newCollateralDocId,
  readFileAsBase64,
  resolveCollateralMime,
  truncateFilename,
  type CollateralDoc,
} from "@/lib/collateral/collateral-docs-client";
import { ClinikoCollateralImport } from "./ClinikoCollateralImport";
import type { PracticeSource } from "@/lib/practice-source";

export type { CollateralDoc };
export {
  buildCollateralManifestForApi,
  buildCollateralPdfPayload,
  collateralAiStatusLabel,
  isCollateralPdfDoc,
  migrateCollateralDocsFromStorage,
  serialiseCollateralDocsForStorage,
} from "@/lib/collateral/collateral-docs-client";

const HALAXY_UPLOAD_LIMIT_BYTES = 20 * 1024 * 1024;
const HALAXY_UPLOAD_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function CollateralDocRowIcon({ mimeType }: { mimeType: string }) {
  const label = getFileTypeLabel(mimeType);
  if (label === "PDF" || label === "DOC" || label === "DOCX") {
    return <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />;
  }
  if (label === "JPEG" || label === "PNG" || label === "HEIC" || label === "HEIF") {
    return <Image className="size-5 shrink-0 text-muted-foreground" aria-hidden />;
  }
  return <FileIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />;
}

export function CollateralDocumentsUpload({
  collateralDocs,
  setCollateralDocs,
  touch,
  inputClass,
  clinikoPatientId = null,
  engine = null,
  practiceSource = "cliniko",
}: {
  collateralDocs: CollateralDoc[];
  setCollateralDocs: Dispatch<SetStateAction<CollateralDoc[]>>;
  touch: () => void;
  inputClass: string;
  /** When set, show Cliniko attachment browser (ASRS / forms import). */
  clinikoPatientId?: string | null;
  engine?: "asd" | "adhd" | null;
  practiceSource?: PracticeSource;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [practiceNotice, setPracticeNotice] = useState<string | null>(null);
  const [encodingFilename, setEncodingFilename] = useState<string | null>(null);
  const pendingHalaxyFiles = useRef<File[]>([]);
  const sentHalaxyKeys = useRef(new Set<string>());

  const encodePdfForAi = useCallback(
    async (docId: string, file: File) => {
      setEncodingFilename(file.name);
      setUploadNotice(`Preparing ${file.name} for AI summary...`);
      setUploadError(null);
      try {
        const pdfBase64 = await readFileAsBase64(file);
        setCollateralDocs((list) =>
          list.map((doc) =>
            doc.id === docId
              ? { ...doc, pdfBase64, extractionStatus: "ready" as const }
              : doc
          )
        );
        setUploadNotice(`${file.name}: AI summary enabled`);
      } catch (error) {
        setCollateralDocs((list) =>
          list.map((doc) =>
            doc.id === docId ? { ...doc, pdfBase64: null, extractionStatus: "failed" as const } : doc
          )
        );
        setUploadError(
          `Could not read ${file.name} for AI summary. Add a manual summary or re-upload.`
        );
        console.error("Collateral PDF encoding failed:", error);
      } finally {
        setEncodingFilename(null);
      }
    },
    [setCollateralDocs]
  );

  const saveFilesToHalaxy = useCallback(async (files: File[], patientId: string) => {
    const accepted: File[] = [];
    const skipped: string[] = [];
    for (const file of files) {
      const key = `${patientId}:${file.name}:${file.size}:${file.lastModified}`;
      if (sentHalaxyKeys.current.has(key)) continue;
      const mime = resolveCollateralMime(file);
      if (!mime || !HALAXY_UPLOAD_TYPES.has(mime)) {
        skipped.push(`${file.name} stays on this report. Halaxy accepts PDF, JPG, PNG, DOC, and DOCX.`);
        continue;
      }
      if (file.size > HALAXY_UPLOAD_LIMIT_BYTES) {
        skipped.push(`${file.name} is over Halaxy's 20 MB limit and stays on this report.`);
        continue;
      }
      accepted.push(file);
    }
    if (accepted.length === 0) {
      if (skipped.length) setPracticeNotice(skipped[0] ?? null);
      return;
    }
    setPracticeNotice("Adding files to Halaxy…");
    const saved: string[] = [];
    let taskLine = "";
    for (let index = 0; index < accepted.length; index += 1) {
      const file = accepted[index]!;
      const mime = resolveCollateralMime(file)!;
      try {
        const content = await readFileAsBase64(file);
        const response = await fetch("/api/halaxy/files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId,
            filename: file.name,
            content,
            contentType: mime,
            encoding: "base64",
            description: file.name,
          }),
        });
        const data = (await response.json().catch(() => null)) as {
          success?: boolean;
          error?: string;
          taskCreated?: boolean;
          taskError?: string | null;
        } | null;
        if (!response.ok || !data?.success) {
          skipped.push(`${file.name}: ${data?.error || "Halaxy upload failed"}`);
          continue;
        }
        sentHalaxyKeys.current.add(`${patientId}:${file.name}:${file.size}:${file.lastModified}`);
        saved.push(file.name);
      } catch {
        skipped.push(`${file.name}: Halaxy upload failed`);
      }
    }
    if (saved.length > 0) {
      try {
        const taskRes = await fetch("/api/halaxy/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId,
            title: "Review documents uploaded from Texlex",
            detail: saved.join(", "),
          }),
        });
        const taskData = (await taskRes.json().catch(() => null)) as {
          taskCreated?: boolean;
          taskError?: string | null;
          error?: string;
        } | null;
        if (taskData?.taskCreated) taskLine = " Task created in Halaxy.";
        else taskLine = ` ${taskData?.taskError || taskData?.error || "Halaxy's API does not include tasks, so no task was created."}`;
      } catch {
        taskLine = " Halaxy's API does not include tasks, so no task was created.";
      }
    }
    const savedLine = saved.length
      ? `Added ${saved.length === 1 ? saved[0] : `${saved.length} files`} to Halaxy.${taskLine}`
      : "";
    setPracticeNotice([savedLine, ...skipped].filter(Boolean).join(" ") || null);
  }, []);

  useEffect(() => {
    if (practiceSource !== "halaxy" || !clinikoPatientId) return;
    const queued = pendingHalaxyFiles.current.splice(0);
    if (queued.length === 0) return;
    void saveFilesToHalaxy(queued, clinikoPatientId);
  }, [clinikoPatientId, practiceSource, saveFilesToHalaxy]);

  const ingestFiles = useCallback(
    (fileList: File[]) => {
      touch();
      setUploadError(null);
      setUploadNotice(null);
      const files = fileList.filter((f) => f.size > 0 || f.name);
      if (files.length === 0) return;

      const additions: CollateralDoc[] = [];
      const acceptedFiles: File[] = [];
      const pendingPdfReads: Array<{ id: string; file: File }> = [];
      let firstError: string | null = null;
      const setErr = (msg: string) => {
        if (!firstError) firstError = msg;
      };

      let count = 0;
      let bytes = 0;
      for (const file of files) {
        const mime = resolveCollateralMime(file);
        if (!mime) {
          setErr("This file type is not supported. Use PDF, JPG, PNG, HEIC, HEIF, DOC, or DOCX.");
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
        const id = newCollateralDocId();
        additions.push({
          id,
          filename: file.name,
          size: file.size,
          mimeType: mime,
          category: DEFAULT_DOC_CATEGORY,
          uploadedAt: new Date().toISOString(),
          pdfBase64: null,
          extractionStatus: "pending",
        });
        if (isCollateralPdfDoc(additions[additions.length - 1]!)) {
          pendingPdfReads.push({ id, file });
        }
        acceptedFiles.push(file);
        count += 1;
        bytes += file.size;
      }

      if (firstError) setUploadError(firstError);
      if (additions.length === 0) return;

      setCollateralDocs((prev) => [...prev, ...additions]);

      for (const pending of pendingPdfReads) {
        void encodePdfForAi(pending.id, pending.file);
      }

      if (practiceSource === "halaxy") {
        if (clinikoPatientId) {
          void saveFilesToHalaxy(acceptedFiles, clinikoPatientId);
        } else {
          pendingHalaxyFiles.current.push(...acceptedFiles);
          setPracticeNotice("Files are on this report. Load the Halaxy patient to add them to Halaxy.");
        }
      }
    },
    [clinikoPatientId, encodePdfForAi, practiceSource, saveFilesToHalaxy, setCollateralDocs, touch]
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
        Upload supporting reports and forms. PDFs are sent to Claude for AI summarisation during
        collateral generation and formulation. JPG, PNG, HEIC, and DOCX uploads are listed for
        manual summary only until a future release.
      </p>

      <ClinikoCollateralImport
        patientId={clinikoPatientId}
        collateralDocs={collateralDocs}
        setCollateralDocs={setCollateralDocs}
        touch={touch}
        engine={engine}
        source={practiceSource}
      />

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
          dragActive
            ? "border-primary bg-primary/5"
            : "border-border/80 bg-muted/20 hover:border-primary/60"
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
        {encodingFilename ? (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Preparing {encodingFilename}...
          </span>
        ) : null}
      </button>

      {uploadError ? (
        <p
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {uploadError}
        </p>
      ) : null}

      {uploadNotice ? (
        <p className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-foreground" role="status">
          {uploadNotice}
        </p>
      ) : null}

      {practiceNotice ? (
        <p className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-foreground" role="status">
          {practiceNotice}
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
                  {encodingFilename === doc.filename ? " · Preparing..." : null}
                </p>
                <p className="text-xs text-muted-foreground">{collateralAiStatusLabel(doc)}</p>
              </div>
              <select
                className={cn(
                  inputClass,
                  "h-8 max-w-[min(100%,18rem)] shrink-0 py-0 text-xs sm:max-w-[22rem]"
                )}
                value={doc.category}
                onChange={(e) => {
                  touch();
                  const category = e.target.value;
                  setCollateralDocs((list) =>
                    list.map((d) => (d.id === doc.id ? { ...d, category } : d))
                  );
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
