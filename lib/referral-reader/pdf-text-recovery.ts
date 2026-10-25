import path from "node:path";
import { pathToFileURL } from "node:url";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { PDFParse } from "pdf-parse";

function stripPdfChrome(text: string): string {
  return text
    .replace(/^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/gim, "")
    .replace(/\f/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const PDF_WORKER_SRC = pathToFileURL(
  path.join(process.cwd(), "node_modules/pdf-parse/dist/pdf-parse/web/pdf.worker.mjs")
).href;

let workerConfigured = false;

function ensurePdfWorker(): void {
  if (workerConfigured) return;
  PDFParse.setWorker(PDF_WORKER_SRC);
  pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
  workerConfigured = true;
}

export type ReferralPdfText = {
  /** Text the referral parser should read. */
  text: string;
  /** pdf.js getText output, which clips glyphs outside the page box. */
  visibleText: string;
  /** True when showText operators restored glyphs past the page boundary. */
  offPage: boolean;
};

type TextGlyph = { unicode?: string };

function glyphString(part: unknown): string {
  if (!part || typeof part !== "object") return "";
  const unicode = (part as TextGlyph).unicode;
  return typeof unicode === "string" ? unicode : "";
}

function showTextString(args: unknown): string {
  const payload = Array.isArray(args) ? args[0] : args;
  if (!Array.isArray(payload)) return "";
  let out = "";
  for (const part of payload) {
    if (typeof part === "number") continue;
    out += glyphString(part);
  }
  return out;
}

async function operatorChunks(data: Uint8Array): Promise<string[]> {
  const task = pdfjs.getDocument({ data, verbosity: pdfjs.VerbosityLevel.ERRORS });
  const doc = await task.promise;
  const chunks: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const ops = await page.getOperatorList();
      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        if (fn !== pdfjs.OPS.showText && fn !== pdfjs.OPS.showSpacedText) continue;
        const text = showTextString(ops.argsArray[i]).replace(/[ \t]+\n/g, "\n").trim();
        if (text) chunks.push(text);
      }
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }
  return chunks;
}

function longestPrefix(text: string, chunk: string): { at: number; len: number } | null {
  const min = Math.min(24, chunk.length - 1);
  if (min < 8) return null;
  for (let len = chunk.length - 1; len >= min; len--) {
    const pre = chunk.slice(0, len);
    const at = text.indexOf(pre);
    if (at === -1) continue;
    if (text.startsWith(chunk, at)) return null;
    return { at, len };
  }
  return null;
}

/** Restore showText runs that pdf.js clipped at the page box. On-page text is left as extracted. */
export function restoreOffPageChunks(
  visible: string,
  chunks: string[]
): { text: string; offPage: boolean } {
  let text = stripPdfChrome(visible);
  let offPage = false;
  for (const chunk of chunks) {
    if (chunk.length < 8 || text.includes(chunk)) continue;
    const hit = longestPrefix(text, chunk);
    if (hit) {
      text = `${text.slice(0, hit.at)}${chunk}${text.slice(hit.at + hit.len)}`;
      offPage = true;
      continue;
    }
    if (chunk.length >= 12 && !text.includes(chunk.slice(0, 12))) {
      text = text ? `${text}\n${chunk}` : chunk;
      offPage = true;
    }
  }
  return { text: text.trim(), offPage };
}

export async function recoverReferralPdfText(buffer: Buffer): Promise<ReferralPdfText> {
  const empty: ReferralPdfText = { text: "", visibleText: "", offPage: false };
  if (!buffer?.length) return empty;
  ensurePdfWorker();
  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    const visibleText = typeof parsed.text === "string" ? parsed.text.trim() : "";
    const chunks = await operatorChunks(new Uint8Array(buffer));
    const restored = restoreOffPageChunks(visibleText, chunks);
    return {
      text: restored.text,
      visibleText,
      offPage: restored.offPage,
    };
  } catch {
    return empty;
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
