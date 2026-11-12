import { anthropic, MODELS } from "@/lib/anthropic-client";
import { TEXLEX_NO_FABRICATION_RULE } from "@/lib/prompts/factual-integrity";
import { applyReviewHintToText, replacementIsInflated } from "./apply-minimal";
import type { ReviewFinding, ReviewSectionInput } from "./types";

const MAX_ALTERNATIVES = 12;
const MAX_REVISED_CHARS = 1600;

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("Clinical alternative response was not JSON");
  }
}

function sectionText(sections: ReviewSectionInput[], sectionId: string): string {
  return sections.find((section) => section.sectionId === sectionId)?.text ?? "";
}

/** Show the locked name, pronoun, or opening swap as the text Accept will write. */
export function withLockedAlternativePreview(finding: ReviewFinding): ReviewFinding {
  if (!finding.applyHint) return finding;
  if (finding.applyHint.mode === "replace_opening_sentence") {
    return { ...finding, suggestedEdit: finding.applyHint.replace };
  }
  if (!finding.evidenceExcerpt) return finding;
  const revised = applyReviewHintToText(finding.evidenceExcerpt, finding.applyHint);
  if (revised === finding.evidenceExcerpt) return finding;
  return { ...finding, suggestedEdit: revised };
}

function excerptCanBeReplaced(section: string, excerpt: string): boolean {
  if (!excerpt || excerpt.length <= 3) return section.includes(excerpt);
  const probe = applyReviewHintToText(section, {
    mode: "replace_all_in_section",
    find: excerpt,
    replace: `${excerpt}\u0000`,
  });
  return probe !== section;
}

function attachRevisedText(
  finding: ReviewFinding,
  revisedText: string,
  sections: ReviewSectionInput[]
): ReviewFinding {
  const section = sectionText(sections, finding.sectionId);
  const cap = Math.max(MAX_REVISED_CHARS, section.trim().length + 400);
  const revised = revisedText.trim().slice(0, cap);
  if (!revised) return finding;
  if (finding.kind !== "observation_source" && replacementIsInflated(section, revised)) return finding;
  const excerpt = finding.evidenceExcerpt?.trim() ?? "";
  if (excerpt && excerptCanBeReplaced(section, excerpt)) {
    return {
      ...finding,
      suggestedEdit: revised,
      applyHint: { mode: "replace_all_in_section", find: excerpt, replace: revised },
    };
  }
  if (finding.sectionId !== "patient-details" && (!section.trim() || section.trim().length < 80)) {
    return {
      ...finding,
      suggestedEdit: revised,
      applyHint: { mode: "insert_paragraph", find: "", replace: revised },
    };
  }
  return { ...finding, suggestedEdit: revised };
}

export async function draftClinicalAlternatives(args: {
  findings: ReviewFinding[];
  sections: ReviewSectionInput[];
  demographicsLock: string;
  sourceNotes?: string;
  skipObservationReframe?: boolean;
}): Promise<ReviewFinding[]> {
  const observationFindings = args.skipObservationReframe
    ? []
    : args.findings.filter((finding) => finding.kind === "observation_source" && !finding.applyHint);
  const reframed = await reframeObservationFindings({
    findings: observationFindings,
    sections: args.sections,
    demographicsLock: args.demographicsLock,
    sourceNotes: args.sourceNotes ?? "",
  });

  const pending = args.findings
    .filter((finding) => !finding.applyHint && finding.kind !== "observation_source")
    .slice(0, MAX_ALTERNATIVES);
  if (pending.length === 0) {
    return args.findings.map((finding) => reframed.get(finding.id) ?? finding);
  }

  const forModel = pending;
  if (forModel.length === 0) {
    return args.findings.map((finding) => reframed.get(finding.id) ?? finding);
  }

  const payload = forModel.map((finding) => ({
    id: finding.id,
    sectionId: finding.sectionId,
    title: finding.title,
    detail: finding.detail,
    evidenceExcerpt: finding.evidenceExcerpt,
    sectionText: sectionText(args.sections, finding.sectionId).slice(0, 6000),
  }));

  let revisedById = new Map<string, string>();
  try {
    const message = await anthropic.messages.create({
    model: MODELS.OPUS,
    max_tokens: 8000,
    system: `You prepare the smallest edit that resolves each flagged passage in a Texlex report.

revisedText keeps the clinician's sentences, order, and wording. Change only the words the finding requires.
Do not restyle the passage. Do not rewrite it into a new voice.
Do not add "Parents report", "They describe", "On parent account", or any other attribution onto sentence after sentence.
Do not lengthen the passage except for one short sentence when a gap has to be stated plainly.
${TEXLEX_NO_FABRICATION_RULE}
Do not change the clinician's diagnosis, criterion ratings, or severity levels.
Do not add names, dates, scores, observations, differentials, or recommendations that are not already in the report.
If the passage already contains what the finding asks for, return that passage unchanged.

Return ONLY JSON:
{"alternatives":[{"id":"<finding id>","revisedText":"<minimal edit of the existing passage>"}]}`,
    messages: [
      {
        role: "user",
        content: `# DEMOGRAPHICS
${args.demographicsLock}

# FINDINGS
${JSON.stringify(payload)}`,
      },
    ],
  });

    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    const parsed = extractJsonObject(text) as { alternatives?: unknown };
    const rows = Array.isArray(parsed.alternatives) ? parsed.alternatives : [];
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const item = row as { id?: unknown; revisedText?: unknown };
      if (typeof item.id !== "string" || typeof item.revisedText !== "string") continue;
      if (!item.revisedText.trim()) continue;
      revisedById.set(item.id, item.revisedText);
    }
  } catch {
    revisedById = new Map();
  }

  return args.findings.map((finding) => {
    const kept = reframed.get(finding.id);
    if (kept) return kept;
    const revised = revisedById.get(finding.id);
    if (!revised || finding.applyHint) return finding;
    return attachRevisedText(finding, revised, args.sections);
  });
}

function cleanReframe(text: string): string {
  return text.replace(/\*\*/g, "").replace(/^```(?:\w+)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function reframeRejectReason(section: string, revised: string): string | null {
  const base = section.trim();
  const next = cleanReframe(revised);
  if (!base || !next) return "The reframe came back empty.";
  if (next.length > Math.round(base.length * 1.6) && next.length > base.length + 600) {
    return "The reframe was much longer than the section, so it was not used.";
  }
  const attribution =
    /\b(?:parents? report|they describe|on parent account|parents? note|parents? describe|they report)\b/gi;
  const count = (text: string) => {
    const matches = text.match(attribution);
    attribution.lastIndex = 0;
    return matches?.length ?? 0;
  };
  if (count(next) - count(base) >= 3) {
    return "The reframe repeated the same parent-report wording, so it was not used.";
  }
  const observation = /clinical observation\s*:/i.test(next) || /(?:^|\n)\s*clinical observation\b/i.test(next);
  const parent = /parent report\s*:/i.test(next) || /(?:^|\n)\s*parent report\b/i.test(next);
  const historyOnly = /rests on parent history/i.test(next);
  if ((observation && parent) || historyOnly) return null;
  return "The reframe did not separate clinical observation from parent report, so it was not used.";
}

export async function reframeCriterionText(args: {
  sectionText: string;
  sourceNotes: string;
  demographicsLock: string;
}): Promise<{ revisedText: string } | { error: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: "The observation reframe did not run because the model key is missing." };
  }
  const section = args.sectionText.trim();
  if (!section) return { error: "That criterion section is empty, so there is nothing to reframe." };
  const message = await anthropic.messages.create({
    model: MODELS.OPUS,
    max_tokens: 2000,
    system: `Reframe one ASD criterion so session observation and carer history are separated.

Use only facts already in the current section or the raw notes. Do not add behaviours, counts, places, or examples.

Clinical observation, when already recorded:
- Anything seen in clinic or during the appointment, including once.
- What the child did while carers were interviewed: not joining, little interaction, not responding, sitting apart. The parent interview is an observation setting.
- Seen once in clinic and described by carers at other times: the clinic instance is observation; the other times stay parent report.

Parent report is what carers said about times and places the clinician did not see.

Write two parts on their own lines, and omit a part with no facts:
Clinical observation: ...
Parent report: ...

Do not repeat a fact. Do not start every sentence with "Parents report" or "They describe".
Keep the length close to the current section.
If nothing was seen, keep the section and add one sentence: this item rests on parent history; no separate observation is recorded.

Return ONLY JSON: {"revisedText":"<reframed section>"}`,
    messages: [
      {
        role: "user",
        content: `# DEMOGRAPHICS
${args.demographicsLock}

# RAW NOTES
${args.sourceNotes.trim().slice(0, 12000) || "[none supplied]"}

# CURRENT SECTION
${section.slice(0, 4000)}`,
      },
    ],
  });
  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
  const parsed = extractJsonObject(text) as { revisedText?: unknown };
  const revised = typeof parsed.revisedText === "string" ? cleanReframe(parsed.revisedText) : "";
  const reason = reframeRejectReason(section, revised);
  if (reason) return { error: reason };
  return { revisedText: revised };
}

async function reframeOneFinding(args: {
  finding: ReviewFinding;
  section: string;
  demographicsLock: string;
  sourceNotes: string;
}): Promise<ReviewFinding> {
  const result = await reframeCriterionText({
    sectionText: args.section,
    sourceNotes: args.sourceNotes,
    demographicsLock: args.demographicsLock,
  });
  if ("error" in result) {
    return {
      ...args.finding,
      suggestedEdit: null,
      detail: `${args.finding.detail} ${result.error}`,
    };
  }
  return {
    ...args.finding,
    suggestedEdit: result.revisedText,
    applyHint: {
      mode: "replace_all_in_section",
      find: args.section.slice(0, 180),
      replace: result.revisedText,
    },
  };
}

async function reframeObservationFindings(args: {
  findings: ReviewFinding[];
  sections: ReviewSectionInput[];
  demographicsLock: string;
  sourceNotes: string;
}): Promise<Map<string, ReviewFinding>> {
  const ready = new Map<string, ReviewFinding>();
  if (args.findings.length === 0) return ready;
  if (!process.env.ANTHROPIC_API_KEY) {
    for (const finding of args.findings) {
      ready.set(finding.id, {
        ...finding,
        suggestedEdit: null,
        detail: `${finding.detail} The observation reframe did not run because the model key is missing.`,
      });
    }
    return ready;
  }

  const settled = await Promise.all(
    args.findings.map(async (finding) => {
      const section = sectionText(args.sections, finding.sectionId);
      try {
        return await reframeOneFinding({
          finding,
          section,
          demographicsLock: args.demographicsLock,
          sourceNotes: args.sourceNotes,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "The observation reframe failed.";
        return {
          ...finding,
          suggestedEdit: null,
          detail: `${finding.detail} ${message}`,
        };
      }
    })
  );
  for (const finding of settled) ready.set(finding.id, finding);
  return ready;
}
