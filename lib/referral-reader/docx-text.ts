import mammoth from "mammoth";

/**
 * Extract plain text from a .docx buffer (Word OOXML).
 * Scanned images inside DOCX are not OCR'd here — those need a PDF/image path.
 */
export async function recoverReferralDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return (result.value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
