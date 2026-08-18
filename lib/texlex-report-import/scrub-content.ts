import { TEXLEX_CRITERIA } from "@/app/asd-engine/report/constants/texlexBoilerplate";
import { collapseForMatch, collapseWs, scrubImportedProse } from "./normalize";
import type { AsdCriterionCode, ImportedSections, TexlexImportedReport } from "./types";
import { ASD_CRITERION_CODES } from "./types";

export function looksLikeMastheadJunk(text: string): boolean {
  const t = text.toUpperCase();
  if (!t.trim()) return false;
  if (t.includes("C L I E N T") || t.includes("A S S E S S O R")) return true;
  if (t.includes("CONSENSUS-BASED NEURODEVELOPMENTAL") && t.includes("ASSESSMENT PATHWAY")) {
    return true;
  }
  const compact = t.replace(/[^A-Z0-9]/g, "");
  if (compact.includes("CONSENSUSBASEDNEURODEVELOPMENTALASSESSMENTREPORT")) return true;
  if (compact.includes("CLIENT") && compact.includes("PSY000") && text.length < 1200) {
    // Short block that looks like a cover page dump
    if (/DATE OF BIRTH|REGISTRATION|PRACTICE/i.test(text)) return true;
  }
  return false;
}

export function stripCriterionDescription(code: AsdCriterionCode, body: string): string {
  const desc = TEXLEX_CRITERIA[code]?.description?.trim();
  if (!desc) return body.trim();
  const needle = collapseForMatch(desc);
  const words = body.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";

  for (let i = 1; i <= words.length; i++) {
    const head = collapseForMatch(words.slice(0, i).join(" "));
    if (head === needle) return words.slice(i).join(" ").trim();
    if (head.length > needle.length + 20) break;
  }

  const collapsed = collapseForMatch(body);
  const idx = collapsed.indexOf(needle);
  if (idx >= 0 && idx < 80) {
    for (let i = 1; i <= words.length; i++) {
      const head = collapseForMatch(words.slice(0, i).join(" "));
      if (head.includes(needle) && head.length >= needle.length) {
        return words.slice(i).join(" ").trim();
      }
    }
  }

  // Mid-body duplicate (template already prints description; imported text may still include it)
  if (collapsed.includes(needle)) {
    for (let i = 0; i < words.length; i++) {
      for (let j = i + 1; j <= words.length; j++) {
        if (collapseForMatch(words.slice(i, j).join(" ")) === needle) {
          return [...words.slice(0, i), ...words.slice(j)].join(" ").trim();
        }
        if (collapseForMatch(words.slice(i, j).join(" ")).length > needle.length + 40) break;
      }
    }
  }

  return body.trim();
}

export function scrubCriterionIndicators(code: AsdCriterionCode, text: string): string {
  let out = scrubImportedProse(text);
  out = stripCriterionDescription(code, out);
  if (looksLikeMastheadJunk(out)) return "";
  // Drop residual DSM section umbrella lines
  out = out
    .replace(/^The following sections address DSM-5-TR criteria[\s\S]*?(?=\n[A-Z]|\n*$)/i, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return out;
}

function scrubSections(sections: ImportedSections): ImportedSections {
  const out: ImportedSections = { ...sections };
  const keys: (keyof ImportedSections)[] = [
    "presentingConcerns",
    "pregnancyBirth",
    "earlyDevelopment",
    "educationalHistory",
    "emotionalBehaviouralSensory",
    "collateralSummary",
    "formulation",
    "recommendations",
    "limitationsText",
    "functionalImpactSummary",
  ];
  for (const k of keys) {
    const v = out[k];
    if (typeof v === "string" && v.trim()) {
      let cleaned = scrubImportedProse(v);
      if (k === "limitationsText" || k === "recommendations") {
        cleaned = cleaned.replace(/^[ \t]*Page\s+\d+\s+of\s+\d+[ \t]*$/gim, "").trim();
      }
      (out as Record<string, unknown>)[k] = cleaned;
    }
  }
  if (out.criteria) {
    const next: NonNullable<ImportedSections["criteria"]> = {};
    for (const code of ASD_CRITERION_CODES) {
      const row = out.criteria[code];
      if (!row) continue;
      const indicators = scrubCriterionIndicators(code, row.indicators);
      if (!indicators && row.rating === null) continue;
      next[code] = { rating: row.rating, indicators };
    }
    out.criteria = next;
  }
  return out;
}

/** Final pass before API response or UI apply. */
export function finalizeImportedReport(report: TexlexImportedReport): TexlexImportedReport {
  return {
    ...report,
    sections: scrubSections(report.sections),
  };
}

export function collapseWsPublic(text: string): string {
  return collapseWs(text);
}
