import type { ReviewApplyHint } from "./types";

/** Safe minimal apply — string replace only; never invents content. */
export function applyReviewHintToText(text: string, hint: ReviewApplyHint): string {
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

  // replace_all_in_section — whole-word-ish for short tokens
  if (hint.find.length <= 3) {
    const re = new RegExp(`\\b${escapeRegExp(hint.find)}\\b`, "g");
    return text.replace(re, hint.replace);
  }
  return text.split(hint.find).join(hint.replace);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
