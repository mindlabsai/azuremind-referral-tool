/** Collapse whitespace for containment checks without destroying readable prose. */
export function collapseWs(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Collapse PDF soft-hyphenation then whitespace for description matching. */
export function collapseForMatch(text: string): string {
  return collapseWs(text.replace(/-\s+/g, ""));
}

/**
 * Texlex PDF extract often letter-spaces masthead labels:
 * "C L I E N T" → "CLIENT", "A S S E S S O R" → "ASSESSOR"
 */
export function unspaceLetterSpacedLine(line: string): string {
  const t = line.trim();
  if (!t) return t;
  const parts = t.split(/\s+/);
  if (parts.length < 3) return t;
  if (!parts.every((p) => /^[A-Za-z0-9]$/.test(p))) return t;
  return parts.join("");
}

/** Normalize PDF extract quirks while keeping paragraph breaks. */
export function normalizeImportedReportText(raw: string): string {
  const lines = raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => unspaceLetterSpacedLine(line.replace(/[ \t]+$/g, "").replace(/[ \t]{2,}/g, " ")));

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function stripPageMarkers(text: string): string {
  return text
    .replace(/^[ \t]*--\s*\d+\s+of\s+\d+\s*--[ \t]*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function stripKnownBoilerplate(text: string, snippets: string[]): string {
  let out = text;
  for (const snippet of snippets) {
    const needle = collapseWs(snippet);
    if (needle.length < 40) continue;
    const hay = collapseWs(out);
    if (!hay.includes(needle)) continue;
    const paras = out.split(/\n{2,}/);
    out = paras
      .filter((p) => {
        const cp = collapseWs(p);
        return !cp.includes(needle) && !needle.includes(cp);
      })
      .join("\n\n")
      .trim();
    // Also try direct collapsed removal when description is mid-paragraph
    const collapsedOut = collapseWs(out);
    if (collapsedOut.includes(needle)) {
      const idx = collapsedOut.indexOf(needle);
      // Rebuild approximately by cutting matching word span from original words
      const words = out.trim().split(/\s+/);
      const needleWords = needle.split(/\s+/);
      for (let i = 0; i + needleWords.length <= words.length; i++) {
        const slice = words.slice(i, i + needleWords.length).join(" ");
        if (collapseWs(slice) === needle) {
          out = [...words.slice(0, i), ...words.slice(i + needleWords.length)].join(" ").trim();
          break;
        }
      }
    }
  }
  return out.trim();
}

/** True when section looks like a verbatim extract of source (whitespace-insensitive). */
export function looksVerbatim(source: string, section: string): boolean {
  const s = collapseWs(section);
  if (s.length < 12) return true;
  const src = collapseWs(source);
  if (src.includes(s)) return true;
  if (s.length < 80) return false;
  const window = 48;
  let hits = 0;
  let total = 0;
  for (let i = 0; i + window <= s.length; i += Math.floor(window / 2)) {
    total += 1;
    const chunk = s.slice(i, i + window);
    if (src.includes(chunk)) hits += 1;
  }
  return total > 0 && hits / total >= 0.85;
}

export function parseFlexibleDateToIso(raw: string): string | undefined {
  const t = raw.trim();
  if (!t || /^not provided$/i.test(t)) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const d = m[1]!.padStart(2, "0");
    const mo = m[2]!.padStart(2, "0");
    const y = m[3]!;
    return `${y}-${mo}-${d}`;
  }
  const months: Record<string, string> = {
    january: "01",
    jan: "01",
    february: "02",
    feb: "02",
    march: "03",
    mar: "03",
    april: "04",
    apr: "04",
    may: "05",
    june: "06",
    jun: "06",
    july: "07",
    jul: "07",
    august: "08",
    aug: "08",
    september: "09",
    sep: "09",
    sept: "09",
    october: "10",
    oct: "10",
    november: "11",
    nov: "11",
    december: "12",
    dec: "12",
  };
  const named = t.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (named) {
    const mo = months[named[2]!.toLowerCase()];
    if (mo) return `${named[3]}-${mo}-${named[1]!.padStart(2, "0")}`;
  }
  return undefined;
}

export function extractRatingToken(text: string): { rating: 0 | 1 | 2 | 3 | null; rest: string } {
  const m = text.match(/RATING\s*[·•.\-:]?\s*([0-3])\b[^\n]*/i);
  if (!m || m.index === undefined) return { rating: null, rest: text };
  const rating = Number(m[1]) as 0 | 1 | 2 | 3;
  const rest = (text.slice(0, m.index) + text.slice(m.index + m[0].length)).replace(/\s{2,}/g, " ").trim();
  return { rating, rest };
}
