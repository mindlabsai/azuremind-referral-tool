import type { ReviewApplyHint, ReviewFinding } from "./types";

/** Instruction copy for the clinician. It is not a passage the engine should paste. */
const MANUAL_INSTRUCTION =
  /^(label |add |summarise |summarize |note |write |document |use |align |replace |record |reframe )/i;

function stripWrappingQuotes(value: string): string {
  return value.trim().replace(/^['"‘’]+|['"‘’]+$/g, "").trim();
}

function quotedPhrases(text: string): string[] {
  return [...text.matchAll(/['"‘’]([^'"‘’]{2,160})['"‘’]/g)].map((match) => match[1].trim()).filter(Boolean);
}

/** Turn “Replace 'wrong' with 'right'” and “Use 'right'” into a real text swap. */
function swapFromInstruction(finding: ReviewFinding): ReviewApplyHint | null {
  const edit = finding.suggestedEdit?.trim() ?? "";
  const excerpt = finding.evidenceExcerpt?.trim() ?? "";
  const detail = finding.detail ?? "";

  const replaceCmd = edit.match(
    /replace\s+(.+?)\s+with\s+(.+?)(?:\s+to\s+match|\s+so\b|\s+exactly\b|[.]|$)/i
  );
  if (replaceCmd) {
    const find = stripWrappingQuotes(replaceCmd[1]);
    const replace = stripWrappingQuotes(replaceCmd[2]);
    if (find && replace && find !== replace) {
      return { mode: "replace_all_in_section", find, replace };
    }
  }

  const useCmd = edit.match(/\buse\s+['"‘’]([^'"‘’]+)['"‘’]/i);
  if (useCmd) {
    const wanted = useCmd[1].trim();
    const expanded = expandedForm(excerpt, wanted) ?? quotedWrongForm(detail, wanted);
    if (expanded && expanded !== wanted) {
      return { mode: "replace_all_in_section", find: expanded, replace: wanted };
    }
  }

  if (excerpt) {
    const inExcerpt = quotedPhrases(`${edit}\n${detail}`).filter(
      (phrase, index, all) => excerpt.includes(phrase) && all.indexOf(phrase) === index
    );
    const corrections = quotedPhrases(`${edit}\n${detail}`).filter(
      (phrase, index, all) => !excerpt.includes(phrase) && all.indexOf(phrase) === index
    );
    if (inExcerpt.length === 1 && corrections.length === 1 && inExcerpt[0] !== corrections[0]) {
      return { mode: "replace_all_in_section", find: inExcerpt[0], replace: corrections[0] };
    }
  }

  return null;
}

function expandedForm(excerpt: string, wanted: string): string | null {
  const words = wanted.split(/\s+/).filter(Boolean);
  if (!excerpt || words.length < 2) return null;
  const re = new RegExp(
    `\\b${escapeRegExp(words[0])}(?:\\s+\\S+){1,3}?\\s+${escapeRegExp(words[words.length - 1])}\\b`,
    "g"
  );
  const hits = (excerpt.match(re) ?? []).filter((hit) => hit.toLowerCase() !== wanted.toLowerCase());
  hits.sort((a, b) => a.length - b.length);
  return hits[0] ?? null;
}

function quotedWrongForm(detail: string, wanted: string): string | null {
  const words = wanted.split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;
  return (
    quotedPhrases(detail).find((phrase) => {
      const parts = phrase.split(/\s+/);
      return (
        parts.length > words.length &&
        parts[0]?.toLowerCase() === words[0]?.toLowerCase() &&
        parts[parts.length - 1]?.toLowerCase() === words[words.length - 1]?.toLowerCase()
      );
    }) ?? null
  );
}

/** The replacement Fix it can write. Plain instructions stay with Accept. */
export function engineApplyHint(finding: ReviewFinding): ReviewApplyHint | null {
  const parsed = finding.kind === "observation_source" ? null : swapFromInstruction(finding);
  if (parsed) return parsed;
  if (finding.applyHint && !MANUAL_INSTRUCTION.test(finding.applyHint.replace.trim())) {
    return finding.applyHint;
  }
  const revised = finding.suggestedEdit?.trim() ?? "";
  if (!revised || MANUAL_INSTRUCTION.test(revised)) return null;
  const excerpt = finding.evidenceExcerpt?.trim() ?? "";
  if (excerpt.length > 12) {
    return { mode: "replace_all_in_section", find: excerpt, replace: revised };
  }
  if (finding.sectionId !== "patient-details") {
    return { mode: "insert_paragraph", find: "", replace: revised };
  }
  return null;
}

/** Apply a prepared replacement. A missing span leaves the section unchanged. */
export function applyReviewHintToText(text: string, hint: ReviewApplyHint): string {
  if (hint.mode === "insert_paragraph") {
    const paragraph = hint.replace.trim();
    if (!paragraph || text.includes(paragraph)) return text;
    return text.trim() ? `${text.trim()}\n\n${paragraph}` : paragraph;
  }
  if (!hint.find) return text;
  if (hint.mode === "replace_opening_sentence") {
    const trimmed = text.trimStart();
    if (trimmed.startsWith(hint.find)) {
      return text.replace(hint.find, hint.replace);
    }
    // Fallback: replace first sentence-like chunk
    const first = trimmed.match(/^[\s\S]{10,400}?[.!?](?=\s|$)/);
    if (first && first.index != null) {
      const leadWs = text.match(/^\s*/)?.[0] ?? "";
      return leadWs + hint.replace + trimmed.slice(first[0].length);
    }
    return hint.replace + (trimmed ? `\n\n${trimmed}` : "");
  }

  return replaceAllLoose(text, hint.find, hint.replace);
}

function replaceAllLoose(text: string, find: string, replace: string): string {
  const needle = find.trim();
  if (!needle) return text;
  if (text.includes(needle)) return text.split(needle).join(replace);
  const pattern = needle.split(/\s+/).map(escapeRegExp).join("\\s+");
  const probe = new RegExp(pattern, "i");
  if (!probe.test(text)) return text;
  return text.replace(new RegExp(pattern, "gi"), replace);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function foldMatch(value: string): string {
  return value
    .replace(/[\u2018\u2019\u201A\u201B\u2032\uFF07]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function flexWord(word: string): string {
  const normalized = word.replace(/[\u2018\u2019\u201A\u201B\u2032\uFF07]/g, "'");
  return escapeRegExp(normalized).replace(/'/g, "[\\u0027\\u2019]");
}

/** A truncated review quote plus a full rewritten paragraph, not a short name swap. */
function isPassageRewrite(excerpt: string, replacement: string): boolean {
  return excerpt.trim().length >= 80 && replacement.trim().length >= 160;
}

function openingPattern(excerpt: string, words: number): RegExp | null {
  const parts = excerpt.trim().split(/\s+/).filter(Boolean).slice(0, words);
  if (parts.length < 6) return null;
  try {
    return new RegExp(parts.map(flexWord).join("\\s+"), "i");
  } catch {
    return null;
  }
}

/** The excerpt is the opening of this section, allowing quote and spacing differences. */
function sectionOpensWith(section: string, excerpt: string): boolean {
  const head = foldMatch(excerpt).slice(0, 72);
  if (head.length < 24) return false;
  const at = foldMatch(section).indexOf(head);
  return at >= 0 && at <= 80;
}

const REPEAT_ATTRIBUTION =
  /\b(?:parents? report|they describe|on parent account|parents? note|parents? describe|they report)\b/gi;

function attributionCount(text: string): number {
  const matches = text.match(REPEAT_ATTRIBUTION);
  REPEAT_ATTRIBUTION.lastIndex = 0;
  return matches?.length ?? 0;
}

function observationReframeIsRepetitive(section: string, replacement: string): boolean {
  const base = section.trim();
  const next = replacement.trim();
  if (!base || !next) return true;
  if (attributionCount(next) - attributionCount(base) >= 3) return true;
  return next.length > Math.round(base.length * 1.6) && next.length > base.length + 600;
}

/** A rewrite that restates the passage in a longer, repeated voice. */
export function replacementIsInflated(section: string, replacement: string): boolean {
  const base = section.trim();
  const next = replacement.trim();
  if (!next) return false;
  if (!base) return next.length > 320;
  if (next.length > base.length + 320) return true;
  if (next.length > Math.round(base.length * 1.4) && next.length > base.length + 100) return true;
  return attributionCount(next) - attributionCount(base) >= 2;
}

/**
 * Write the Texlex alternative into a section.
 * A long rewrite whose quote opens the section replaces the whole section,
 * because review quotes are cut off mid-sentence and must not leave the old tail behind.
 * A swollen, repetitive rewrite is not written. A missing source label is one line on the existing text.
 */
export function placeReviewAlternative(section: string, finding: ReviewFinding): string | null {
  const hint = engineApplyHint(finding);
  if (!hint) return null;
  const replacement = hint.replace.trim();
  if (!replacement) return null;
  if (finding.kind === "observation_source") {
    if (observationReframeIsRepetitive(section, replacement)) return null;
    return replacement;
  }
  if (replacementIsInflated(section, replacement)) return null;
  if (foldMatch(section) === foldMatch(replacement)) return null;

  if (hint.mode === "insert_paragraph" || hint.mode === "replace_opening_sentence") {
    const next = applyReviewHintToText(section, hint);
    return next === section ? null : next;
  }

  const excerpt = (hint.find || finding.evidenceExcerpt || "").trim();
  if (!excerpt) {
    const next = applyReviewHintToText(section, hint);
    return next === section ? null : next;
  }

  if (isPassageRewrite(excerpt, replacement) && sectionOpensWith(section, excerpt)) {
    return replacement;
  }

  const direct = applyReviewHintToText(section, {
    mode: "replace_all_in_section",
    find: excerpt,
    replace: replacement,
  });
  if (direct !== section) return direct;

  const pattern = openingPattern(excerpt, 14);
  if (!pattern) return null;
  const found = pattern.exec(section);
  if (!found || found.index == null) return null;
  if (isPassageRewrite(excerpt, replacement) && found.index <= 80) return replacement;
  const next = `${section.slice(0, found.index)}${replacement}${section.slice(found.index + found[0].length)}`;
  return next === section ? null : next;
}
