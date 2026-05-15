/**
 * PASS 10w-3: heuristic post-generation checks for streamed clinical formulation text.
 * Does not block; callers attach warnings to API responses / logs.
 */

const TRUNCATION_USER_MESSAGE =
  "⚠ Formulation may be incomplete. Review final paragraph before sending.";

function getFinalParagraph(text: string): string {
  const parts = text
    .trim()
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length ? parts[parts.length - 1]! : text.trim();
}

function endsWithDanglingConjunction(trimmed: string): boolean {
  const stripped = trimmed.replace(/\s+$/, "").replace(/["'»]+$/u, "");
  const lastToken = stripped.split(/\s+/).pop() ?? "";
  const word = lastToken.replace(/[,;:.)!?]+$/g, "").toLowerCase();
  return ["and", "or", "with", "alongside"].includes(word);
}

/**
 * Lone conditional closer (e.g. "Should X, Y, or Z.") without a consequence clause
 * in the same sentence — often model truncation mid-thought.
 */
function looksLikeOrphanConditionalSentence(sentence: string): boolean {
  const t = sentence.trim();
  if (!/^(Should|If|When)\b/i.test(t)) return false;
  // Short closers ("When uncertain, seek advice.") rarely lack a consequence; long Should-list sentences often do.
  const minLen = /^Should\b/i.test(t) ? 72 : 120;
  if (t.length < minLen) return false;
  if (
    /\b(would be indicated|would be appropriate|may be indicated|should be considered|warranted|re-?referral|refer for further|further assessment)\b/i.test(
      t
    )
  ) {
    return false;
  }
  if (/\b(would|could)\s+\w+/i.test(t)) return false;
  return true;
}

export type FormulationCompletenessResult = {
  truncation_warning: string | null;
  reasons: string[];
};

/**
 * @param stopReason Anthropic message `stop_reason` when known (e.g. `max_tokens`).
 */
export function assessFormulationCompleteness(
  text: string,
  stopReason?: string | null
): FormulationCompletenessResult {
  const reasons: string[] = [];
  const trimmed = text.trim();

  if (stopReason === "max_tokens") {
    reasons.push("model_stop_max_tokens");
    console.warn("[Texlex] Formulation generation stopped at max_tokens (output budget exhausted).");
  }

  if (!trimmed) {
    return { truncation_warning: null, reasons };
  }

  const finalPara = getFinalParagraph(trimmed);
  const terminal = finalPara.replace(/\s+$/, "").replace(/["'»\]]+$/u, "").slice(-1);
  if (!/[.!?]/.test(terminal)) {
    reasons.push("final_paragraph_no_sentence_terminal");
    console.warn(
      "[Texlex] Formulation completeness: final paragraph does not end with sentence-ending punctuation."
    );
  }

  if (endsWithDanglingConjunction(finalPara)) {
    reasons.push("final_paragraph_dangling_conjunction");
    console.warn("[Texlex] Formulation completeness: final paragraph ends with a dangling conjunction.");
  }

  const sentences = finalPara
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const lastSentence = sentences[sentences.length - 1] ?? finalPara;
  if (looksLikeOrphanConditionalSentence(lastSentence)) {
    reasons.push("final_sentence_orphan_conditional");
    console.warn(
      "[Texlex] Formulation completeness: final sentence looks like a lone conditional without a consequence clause."
    );
  }

  const truncation_warning = reasons.length > 0 ? TRUNCATION_USER_MESSAGE : null;
  return { truncation_warning, reasons };
}
