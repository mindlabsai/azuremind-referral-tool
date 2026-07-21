import { sanitiseExtractedNumber } from "@/lib/texlex-pdf-sanitize";

export const ACCEPTED_FILE_TYPES = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/heic": [".heic"],
  "image/heif": [".heif"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/msword": [".doc"],
} as const;

export const DOC_CATEGORIES = [
  "Cognitive assessment (WISC / WPPSI / WAIS)",
  "Adaptive functioning (ABAS-3 / Vineland-3)",
  "ASD-specific (ADOS-2 / ADI-R)",
  "Behaviour rating scale (BASC-3 / Conners-3)",
  "ADHD rating scale (Vanderbilt / Conners)",
  "Speech and language assessment",
  "Occupational therapy / sensory assessment",
  "Academic achievement (WIAT / WJ-IV)",
  "Executive function (BRIEF)",
  "Paediatrician report",
  "GP referral",
  "Psychiatrist report",
  "School report / IEP / NCCD",
  "Teacher questionnaire",
  "Personal Health Record (Blue Book)",
  "Previous diagnostic report",
  "Other",
] as const;

export const DEFAULT_DOC_CATEGORY: (typeof DOC_CATEGORIES)[number] = "Other";

export const COLLATERAL_MAX_FILES = 20;
export const COLLATERAL_MAX_FILE_BYTES = 25 * 1024 * 1024;
export const COLLATERAL_MAX_TOTAL_BYTES = 100 * 1024 * 1024;

export const ACCEPTED_MIME_TYPES = new Set<string>(Object.keys(ACCEPTED_FILE_TYPES));

export const EXTENSION_TO_MIME = (() => {
  const map: Record<string, string> = {};
  for (const [mime, exts] of Object.entries(ACCEPTED_FILE_TYPES)) {
    for (const ext of exts) {
      map[ext.toLowerCase()] = mime;
    }
  }
  return map;
})();

export const COLLATERAL_INPUT_ACCEPT = [
  ...Object.keys(ACCEPTED_FILE_TYPES),
  ...Object.values(ACCEPTED_FILE_TYPES).flat(),
].join(",");

export type CollateralDoc = {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  category: string;
  uploadedAt: string;
  content?: string;
  pdfBase64: string | null;
  extractionStatus: "pending" | "ready" | "failed";
};

export function isCollateralPdfDoc(doc: CollateralDoc): boolean {
  return (
    doc.mimeType === "application/pdf" || doc.filename.toLowerCase().endsWith(".pdf")
  );
}

export function collateralAiStatusLabel(doc: CollateralDoc): string {
  if (isCollateralPdfDoc(doc)) {
    if (doc.extractionStatus === "ready") return "PDF: AI summary enabled";
    if (doc.extractionStatus === "failed") return "PDF: read failed - manual summary required";
    return "PDF: preparing...";
  }
  return "JPG/PNG/HEIC/DOCX: manual summary";
}

export function buildCollateralManifestForApi(docs: CollateralDoc[]): string {
  if (!docs.length) return "";
  const lines = docs.map((d) => {
    const title = d.filename.trim() || "Collateral document";
    const manual = d.content?.trim();
    let line = `- ${title} (${d.category}): ${collateralAiStatusLabel(d)}`;
    if (manual) line += `\n  Clinician manual summary: ${manual}`;
    return line;
  });
  return `Collateral upload manifest:\n${lines.join("\n")}`;
}

export function buildCollateralPdfPayload(docs: CollateralDoc[]): {
  collateralPdfDocuments: Array<{
    id: string;
    filename: string;
    category: string;
    data: string;
  }>;
  unsupportedCollateralDocuments: Array<{ id: string; filename: string; mimeType: string }>;
  pendingCollateralDocuments: Array<{ id: string; filename: string }>;
} {
  const collateralPdfDocuments: Array<{
    id: string;
    filename: string;
    category: string;
    data: string;
  }> = [];
  const unsupportedCollateralDocuments: Array<{ id: string; filename: string; mimeType: string }> =
    [];
  const pendingCollateralDocuments: Array<{ id: string; filename: string }> = [];

  for (const doc of docs) {
    if (isCollateralPdfDoc(doc)) {
      if (doc.extractionStatus === "ready" && doc.pdfBase64) {
        collateralPdfDocuments.push({
          id: doc.id,
          filename: doc.filename,
          category: doc.category,
          data: doc.pdfBase64,
        });
      } else {
        pendingCollateralDocuments.push({ id: doc.id, filename: doc.filename });
      }
    } else {
      unsupportedCollateralDocuments.push({
        id: doc.id,
        filename: doc.filename,
        mimeType: doc.mimeType,
      });
    }
  }

  return {
    collateralPdfDocuments,
    unsupportedCollateralDocuments,
    pendingCollateralDocuments,
  };
}

export function serialiseCollateralDocsForStorage(docs: CollateralDoc[]): CollateralDoc[] {
  return docs.map((doc) => {
    const { pdfBase64: _pdf, ...rest } = doc;
    const extractionStatus =
      isCollateralPdfDoc(doc) && doc.extractionStatus === "ready"
        ? "pending"
        : doc.extractionStatus;
    return { ...rest, pdfBase64: null, extractionStatus };
  });
}

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Could not read file"));
        return;
      }
      const comma = reader.result.indexOf(",");
      resolve(comma >= 0 ? reader.result.slice(comma + 1) : reader.result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsDataURL(file);
  });
}

export function newCollateralDocId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `doc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function migrateCollateralDocsFromStorage(raw: unknown): CollateralDoc[] {
  if (!Array.isArray(raw)) return [];
  const out: CollateralDoc[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" && o.id ? o.id : newCollateralDocId();
    if (typeof o.filename === "string" && typeof o.mimeType === "string") {
      const category =
        typeof o.category === "string" && (DOC_CATEGORIES as readonly string[]).includes(o.category)
          ? o.category
          : DEFAULT_DOC_CATEGORY;
      const extractionStatus =
        o.extractionStatus === "ready" || o.extractionStatus === "failed"
          ? o.extractionStatus
          : "pending";
      out.push({
        id,
        filename: o.filename,
        size: typeof o.size === "number" ? sanitiseExtractedNumber(o.size) ?? 0 : 0,
        mimeType: o.mimeType,
        category,
        uploadedAt: typeof o.uploadedAt === "string" ? o.uploadedAt : new Date().toISOString(),
        content: typeof o.content === "string" ? o.content : undefined,
        pdfBase64: null,
        extractionStatus,
      });
      continue;
    }
    if ("title" in o || "summary" in o) {
      const title = typeof o.title === "string" ? o.title.trim() : "";
      const content =
        typeof o.content === "string"
          ? o.content
          : typeof o.summary === "string"
            ? o.summary
            : undefined;
      out.push({
        id,
        filename: title || "Collateral document",
        size: 0,
        mimeType: "application/pdf",
        category: DEFAULT_DOC_CATEGORY,
        uploadedAt: new Date().toISOString(),
        content,
        pdfBase64: null,
        extractionStatus: "pending",
      });
    }
  }
  return out;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileTypeLabel(mimeType: string): string {
  const map: Record<string, string> = {
    "application/pdf": "PDF",
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/heic": "HEIC",
    "image/heif": "HEIF",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
    "application/msword": "DOC",
  };
  return map[mimeType] || "FILE";
}

export function resolveCollateralMime(file: File): string | null {
  const t = file.type?.trim();
  if (t && ACCEPTED_MIME_TYPES.has(t)) return t;
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
  const fromExt = EXTENSION_TO_MIME[ext];
  return fromExt ?? null;
}

export function truncateFilename(name: string, max = 40): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max)}...`;
}
