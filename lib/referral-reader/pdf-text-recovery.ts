/**
 * Serverless-safe PDF text extraction for referral intake.
 *
 * Primary text: `unpdf` (Vercel Node — no DOMMatrix / canvas).
 * Supplemental: pure content-stream scrape for glyphs clipped at the page box.
 * Scanned / empty PDFs still fall through to Claude vision in extract.ts.
 */

import { inflateSync } from "node:zlib";

export type ReferralPdfText = {
  /** Text the referral parser should read. */
  text: string;
  /** Primary page-box text from unpdf. */
  visibleText: string;
  /** True when content-stream restore added clipped glyphs. */
  offPage: boolean;
};

function stripPdfChrome(text: string): string {
  return text
    .replace(/^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/gim, "")
    .replace(/\f/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function joinPdfPages(text: string | string[] | undefined): string {
  if (!text) return "";
  if (Array.isArray(text)) return text.filter(Boolean).join("\n\n");
  return text;
}

function unescapePdfString(raw: string): string {
  return raw
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

function tjChunksFromStream(stream: Buffer): string[] {
  const src = stream.toString("latin1");
  const chunks: string[] = [];
  const re = /\((?:\\.|[^\\)])*\)\s*Tj/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(src))) {
    const inner = match[0].replace(/\)\s*Tj$/, "").slice(1);
    const text = unescapePdfString(inner).replace(/[ \t]+\n/g, "\n").trim();
    if (text.length >= 8) chunks.push(text);
  }
  // TJ arrays: [(Hello) -10 (world)] TJ
  const tjArray = /\[([\s\S]*?)\]\s*TJ/g;
  while ((match = tjArray.exec(src))) {
    const body = match[1] || "";
    const parts: string[] = [];
    const partRe = /\((?:\\.|[^\\)])*\)/g;
    let partMatch: RegExpExecArray | null;
    while ((partMatch = partRe.exec(body))) {
      parts.push(unescapePdfString(partMatch[0].slice(1, -1)));
    }
    const text = parts.join("").replace(/[ \t]+\n/g, "\n").trim();
    if (text.length >= 8) chunks.push(text);
  }
  return chunks;
}

/** Pull literal show-text operators from PDF content streams (no pdfjs). */
export function scrapePdfContentStreamText(buffer: Buffer): string[] {
  const latin = buffer.toString("latin1");
  const chunks: string[] = [];
  const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamRe.exec(latin))) {
    const raw = Buffer.from(match[1], "latin1");
    // Prefer inflated payload when FlateDecode was used; also try raw.
    try {
      chunks.push(...tjChunksFromStream(inflateSync(raw)));
    } catch {
      /* not flate */
    }
    chunks.push(...tjChunksFromStream(raw));
  }
  return [...new Set(chunks)];
}

/** Restore showText runs that a page-box clip may have truncated. */
export function restoreOffPageChunks(
  visible: string,
  chunks: string[]
): { text: string; offPage: boolean } {
  let text = stripPdfChrome(visible);
  let offPage = false;
  for (const chunk of chunks) {
    if (chunk.length < 8 || text.includes(chunk)) continue;
    const min = Math.min(24, chunk.length - 1);
    let hit: { at: number; len: number } | null = null;
    if (min >= 8) {
      for (let len = chunk.length - 1; len >= min; len--) {
        const pre = chunk.slice(0, len);
        const at = text.indexOf(pre);
        if (at === -1) continue;
        if (text.startsWith(chunk, at)) continue;
        hit = { at, len };
        break;
      }
    }
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

  let visibleText = "";
  try {
    const { extractText } = await import("unpdf");
    const result = await extractText(new Uint8Array(buffer), { mergePages: false });
    visibleText = stripPdfChrome(joinPdfPages(result.text));
  } catch {
    visibleText = "";
  }

  const streamChunks = scrapePdfContentStreamText(buffer);
  const restored = restoreOffPageChunks(visibleText, streamChunks);
  return {
    text: restored.text || visibleText,
    visibleText,
    offPage: restored.offPage,
  };
}
