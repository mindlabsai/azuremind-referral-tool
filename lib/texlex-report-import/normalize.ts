/** Collapse whitespace for containment checks without destroying readable prose. */
export function collapseWs(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Normalize PDF extract quirks while keeping paragraph breaks. */
export function normalizeImportedReportText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function stripKnownBoilerplate(text: string, snippets: string[]): string {
  let out = text;
  for (const snippet of snippets) {
    const needle = collapseWs(snippet);
    if (needle.length < 40) continue;
    const hay = collapseWs(out);
    if (!hay.includes(needle)) continue;
    // Remove by paragraph-ish chunks from original when possible
    const paras = out.split(/\n{2,}/);
    out = paras
      .filter((p) => !collapseWs(p).includes(needle) && !needle.includes(collapseWs(p)))
      .join("\n\n")
      .trim();
  }
  return out.trim();
}

/** True when section looks like a verbatim extract of source (whitespace-insensitive). */
export function looksVerbatim(source: string, section: string): boolean {
  const s = collapseWs(section);
  if (s.length < 12) return true;
  const src = collapseWs(source);
  if (src.includes(s)) return true;
  // Allow minor PDF line-break artifacts: require ~90% of 40-char windows to hit
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
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  // DD/MM/YYYY or DD-MM-YYYY (AU)
  const m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const d = m[1]!.padStart(2, "0");
    const mo = m[2]!.padStart(2, "0");
    const y = m[3]!;
    return `${y}-${mo}-${d}`;
  }
  // "15 January 2024" / "15 Jan 2024"
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
