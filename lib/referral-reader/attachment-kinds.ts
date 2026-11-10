/**
 * Shared attachment classification for referral reader + intake (Phase 1 PDF + Phase 2).
 */

export type ReferralAttachmentKind = "pdf" | "jpeg" | "png" | "docx";

const EXT_KIND: Array<{ re: RegExp; kind: ReferralAttachmentKind }> = [
  { re: /\.pdf$/i, kind: "pdf" },
  { re: /\.jpe?g$/i, kind: "jpeg" },
  { re: /\.png$/i, kind: "png" },
  { re: /\.docx$/i, kind: "docx" },
];

const MIME_KIND: Array<{ re: RegExp; kind: ReferralAttachmentKind }> = [
  { re: /pdf/i, kind: "pdf" },
  { re: /^image\/jpe?g$/i, kind: "jpeg" },
  { re: /^image\/png$/i, kind: "png" },
  {
    re: /wordprocessingml\.document|officedocument\.wordprocessingml/i,
    kind: "docx",
  },
];

export function classifyReferralAttachment(args: {
  filename?: string | null;
  contentType?: string | null;
}): ReferralAttachmentKind | null {
  const filename = (args.filename || "").trim();
  const contentType = (args.contentType || "").trim().split(";")[0]?.trim() || "";

  for (const row of EXT_KIND) {
    if (filename && row.re.test(filename)) return row.kind;
  }
  for (const row of MIME_KIND) {
    if (contentType && row.re.test(contentType)) return row.kind;
  }
  // Legacy application/msword only if filename says .docx
  if (/msword/i.test(contentType) && /\.docx$/i.test(filename)) return "docx";
  return null;
}

export function isSupportedReferralAttachment(args: {
  filename?: string | null;
  contentType?: string | null;
}): boolean {
  return classifyReferralAttachment(args) !== null;
}

export function defaultContentTypeForKind(kind: ReferralAttachmentKind): string {
  switch (kind) {
    case "pdf":
      return "application/pdf";
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
}

export function extractionPriority(kind: ReferralAttachmentKind): number {
  switch (kind) {
    case "pdf":
      return 0;
    case "docx":
      return 1;
    case "jpeg":
    case "png":
      return 2;
  }
}
