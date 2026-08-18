import type { ClinikoPatientAttachment } from "@/lib/cliniko";
import {
  COLLATERAL_MAX_FILE_BYTES,
  COLLATERAL_MAX_FILES,
  COLLATERAL_MAX_TOTAL_BYTES,
  EXTENSION_TO_MIME,
  guessCollateralCategoryFromName,
  isCollateralPdfDoc,
  newCollateralDocId,
  type CollateralDoc,
} from "@/lib/collateral/collateral-docs-client";

function resolveMimeFromAttachment(
  filename: string,
  contentType: string | null | undefined
): string | null {
  const mime = (contentType ?? "").toLowerCase().split(";")[0]?.trim() ?? "";
  if (mime && mime !== "application/octet-stream") return mime;
  const dot = filename.toLowerCase().lastIndexOf(".");
  const ext = dot >= 0 ? filename.toLowerCase().slice(dot) : "";
  return EXTENSION_TO_MIME[ext] ?? (ext === ".pdf" ? "application/pdf" : null);
}

/** Skip Texlex-generated state dumps / report uploads when auto-importing. */
export function isClinikoAttachmentAutoImportCandidate(
  attachment: ClinikoPatientAttachment
): boolean {
  if (!attachment.processingCompleted || !attachment.importable) return false;
  const name = attachment.filename.trim().toLowerCase();
  if (!name) return false;
  if (name.startsWith("texlex-state-")) return false;
  if (name.startsWith("texlex-")) return false;
  return true;
}

function sortAutoImportAttachments(
  attachments: ClinikoPatientAttachment[]
): ClinikoPatientAttachment[] {
  return [...attachments].sort((a, b) => {
    if (a.likelyAsrs !== b.likelyAsrs) return a.likelyAsrs ? -1 : 1;
    const aPdf = a.filename.toLowerCase().endsWith(".pdf") ? 0 : 1;
    const bPdf = b.filename.toLowerCase().endsWith(".pdf") ? 0 : 1;
    if (aPdf !== bPdf) return aPdf - bPdf;
    const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
    return bTime - aTime;
  });
}

export type ImportClinikoAttachmentsResult = {
  additions: CollateralDoc[];
  importedCount: number;
  skippedExisting: number;
  error: string | null;
};

export async function importClinikoAttachmentsIntoCollateral(args: {
  patientId: string;
  existingDocs: CollateralDoc[];
  /** When set, only these attachment ids are imported. Otherwise auto-candidates. */
  attachmentIds?: string[];
  /** Prefer ASRS-named files only (manual browser default). Auto calendar uses false. */
  asrsOnly?: boolean;
}): Promise<ImportClinikoAttachmentsResult> {
  const listRes = await fetch(
    `/api/cliniko/attachments?patientId=${encodeURIComponent(args.patientId)}`
  );
  const listData = (await listRes.json()) as {
    attachments?: ClinikoPatientAttachment[];
    error?: string;
  };
  if (!listRes.ok) {
    return {
      additions: [],
      importedCount: 0,
      skippedExisting: 0,
      error: listData.error ?? "Could not list Cliniko files.",
    };
  }

  const all = listData.attachments ?? [];
  let candidates: ClinikoPatientAttachment[];
  if (args.attachmentIds?.length) {
    const wanted = new Set(args.attachmentIds);
    candidates = all.filter((a) => wanted.has(a.id));
  } else {
    candidates = sortAutoImportAttachments(
      all.filter((a) => {
        if (!isClinikoAttachmentAutoImportCandidate(a)) return false;
        if (args.asrsOnly && !a.likelyAsrs) return false;
        return true;
      })
    );
  }

  const additions: CollateralDoc[] = [];
  const seenNames = new Set(
    args.existingDocs.map((d) => d.filename.trim().toLowerCase()).filter(Boolean)
  );
  let runningBytes = args.existingDocs.reduce((s, d) => s + (d.size || 0), 0);
  let firstError: string | null = null;
  let skippedExisting = 0;

  for (const attachment of candidates) {
    if (args.existingDocs.length + additions.length >= COLLATERAL_MAX_FILES) {
      firstError = firstError ?? "You can attach at most 20 collateral files.";
      break;
    }
    if (typeof attachment.size === "number" && attachment.size > COLLATERAL_MAX_FILE_BYTES) {
      firstError = firstError ?? `${attachment.filename} exceeds 25 MB.`;
      continue;
    }
    const nameKey = attachment.filename.trim().toLowerCase();
    if (nameKey && seenNames.has(nameKey)) {
      skippedExisting += 1;
      continue;
    }

    try {
      const response = await fetch(`/api/cliniko/attachments/${attachment.id}/content`);
      const data = (await response.json()) as {
        filename?: string;
        contentType?: string;
        size?: number;
        contentBase64?: string;
        error?: string;
      };
      if (!response.ok || !data.contentBase64) {
        firstError = firstError ?? data.error ?? `Could not download ${attachment.filename}.`;
        continue;
      }

      const filename = (data.filename ?? attachment.filename).trim() || attachment.filename;
      const mime =
        resolveMimeFromAttachment(filename, data.contentType ?? attachment.contentType) ??
        "application/octet-stream";
      const size =
        typeof data.size === "number"
          ? data.size
          : Math.floor((data.contentBase64.length * 3) / 4);

      if (runningBytes + size > COLLATERAL_MAX_TOTAL_BYTES) {
        firstError = firstError ?? "Total upload size cannot exceed 100 MB across all files.";
        break;
      }

      const doc: CollateralDoc = {
        id: newCollateralDocId(),
        filename,
        size,
        mimeType: mime,
        category: guessCollateralCategoryFromName(filename, attachment.description),
        uploadedAt: new Date().toISOString(),
        pdfBase64: null,
        extractionStatus: "pending",
      };

      if (isCollateralPdfDoc(doc)) {
        doc.pdfBase64 = data.contentBase64;
        doc.extractionStatus = "ready";
      }

      additions.push(doc);
      runningBytes += size;
      if (filename.trim()) seenNames.add(filename.trim().toLowerCase());
    } catch {
      firstError = firstError ?? `Could not download ${attachment.filename}.`;
    }
  }

  return {
    additions,
    importedCount: additions.length,
    skippedExisting,
    error: firstError,
  };
}

export function formatClinikoImportNotice(result: ImportClinikoAttachmentsResult): string | null {
  if (result.importedCount > 0) {
    return result.importedCount === 1
      ? "Imported 1 Cliniko file into collateral."
      : `Imported ${result.importedCount} Cliniko files into collateral.`;
  }
  if (!result.error && result.skippedExisting > 0) {
    return "Cliniko files were already in collateral (matched by filename).";
  }
  if (!result.error && result.importedCount === 0) {
    return "No importable Cliniko files found for this patient.";
  }
  return null;
}
