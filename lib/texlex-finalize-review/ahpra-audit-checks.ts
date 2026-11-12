/**
 * Deterministic AHPRA-oriented finalize checks for ASD reports:
 * observation vs parent report, broader differentials, cognitive overclaim,
 * collateral gaps, modality/limitations honesty.
 */

import type {
  ReviewFinding,
  ReviewSectionId,
  ReviewSectionInput,
} from "./types";
import { newReviewId } from "./types";

export type AhpraAuditReviewInput = {
  runId: string;
  assessmentModality: "" | "in-clinic" | "virtual";
  diagnosticConclusion: string;
  school: string;
  sections: ReviewSectionInput[];
};

function finding(
  runId: string,
  partial: Omit<ReviewFinding, "id" | "runId" | "source" | "status" | "decidedAt">
): ReviewFinding {
  return {
    id: newReviewId("find"),
    runId,
    source: "deterministic",
    status: "open",
    decidedAt: null,
    ...partial,
  };
}

function bySection(sections: ReviewSectionInput[]): Map<ReviewSectionId, string> {
  return new Map(sections.map((s) => [s.sectionId, (s.text ?? "").trim()]));
}

const OBSERVATION_RE =
  /\b(clinical observation|direct observation|observed|in (?:the )?(?:clinic|session|assessment)|during (?:the )?(?:session|assessment)|assessor (?:noted|observed)|in[- ]session)\b/i;

const PARENT_REPORT_RE =
  /\b(?:parents?|mother|father|carers?|mum|dad)(?:['’]s)?\s+(?:reports?|reported|describes?|described|notes?|noted|states?|stated|said|accounts?)|\bparent(?:s)?(?:['’]s)?\s+report\b|\bper (?:mum|dad|mother|father|parents?)\b|\bas reported by\b|\bhistory (?:from|indicates)\b|\bparent(?:al)? interview\b|\bon parent account\b/i;

const DIFFERENTIAL_RE =
  /\b(ADHD|attention[- ]deficit|anxiety|language disorder|developmental language|trauma|PTSD|attachment|intellectual disability|\bID\b|GDD|global developmental delay|hearing impairment|vision impairment|selective mutism|OCD|mood disorder|differential)\b/i;

const COGNITIVE_CLAIM_RE =
  /\b(IQ|intelligence quotient|cognitive (?:ability|functioning|assessment|testing)|intellectual (?:functioning|capacity)|adaptive (?:functioning|behaviour|behavior)|Vineland|WISC|WPPSI|Stanford[- ]Binet|full[- ]scale IQ|borderline intellectual|mild intellectual disability)\b/i;

const COGNITIVE_HEDGE_RE =
  /\b(no formal (?:cognitive|adaptive|intellectual)|not formally assessed|formal (?:cognitive|adaptive) assessment (?:was |were )?(?:not|not yet)|without formal (?:cognitive|adaptive)|cognitive assessment (?:has )?not (?:been )?completed)\b/i;

const COLLATERAL_ABSENCE_RE =
  /\b(no (?:formal )?collateral|collateral (?:not|was not) (?:available|obtained|received)|unable to obtain collateral|school (?:report|input|questionnaire) (?:not|was not)|teacher (?:input|report) (?:not|unavailable)|allied health (?:reports? )?(?:not|unavailable))\b/i;

const VIRTUAL_LIMIT_RE =
  /\b(telehealth|virtual|video|remote|observation (?:was |is )?(?:limited|constrained)|limits? of (?:telehealth|virtual|remote)|in[- ]person (?:review|assessment|observation))\b/i;

const CRITERION_OBS_SECTIONS: ReviewSectionId[] = [
  "criterion-A1",
  "criterion-A2",
  "criterion-A3",
  "criterion-B1",
  "criterion-B2",
  "criterion-B3",
  "criterion-B4",
];

function excerptAround(text: string, re: RegExp, max = 220): string | null {
  const m = text.match(re);
  if (!m || m.index == null) return text.slice(0, max);
  const start = Math.max(0, m.index - 40);
  return text.slice(start, Math.min(text.length, start + max));
}

/** ASD-only AHPRA audit deterministic findings. */
export function runAhpraAuditChecks(input: AhpraAuditReviewInput): ReviewFinding[] {
  const out: ReviewFinding[] = [];
  const map = bySection(input.sections);
  const formulation = map.get("clinical-formulation") ?? "";
  const criterionE = map.get("criterion-E") ?? "";
  const collateral = map.get("collateral") ?? "";
  const limitations = map.get("limitations") ?? "";
  const functional = map.get("functional-impact") ?? "";
  const conclusion = input.diagnosticConclusion;

  // --- C. Direct observation labelling in A/B criterion narratives ---
  for (const sid of CRITERION_OBS_SECTIONS) {
    const text = map.get(sid) ?? "";
    if (text.length < 120) continue;
    const hasObs = OBSERVATION_RE.test(text);
    const hasParent = PARENT_REPORT_RE.test(text);
    if (!hasObs && !hasParent) {
      out.push(
        finding(input.runId, {
          kind: "observation_source",
          severity: "major",
          sectionId: sid,
          title: "Criterion narrative missing observation / parent-report labelling",
          detail:
            "What was seen in session is not separated from what carers said. Behaviour during the parent interview, and anything already noted in clinic, is observation when it is in the notes or this section.",
          evidenceExcerpt: text.slice(0, 220),
          suggestedEdit:
            "Reframe this section from the raw notes and the current text. Label behaviour already seen in clinic, including during the parent interview, as clinical observation. Leave carer history as parent report. Do not add new facts.",
          applyHint: null,
        })
      );
    } else if (hasParent && !hasObs && text.length >= 200) {
      out.push(
        finding(input.runId, {
          kind: "observation_source",
          severity: "major",
          sectionId: sid,
          title: "Criterion narrative is parent-report only",
          detail:
            "Carer history is marked, and behaviour already seen in session is still inside that history. A clinic example, or the child not engaging while carers were interviewed, is observation when the notes or this section already record it.",
          evidenceExcerpt: excerptAround(text, PARENT_REPORT_RE),
          suggestedEdit:
            "Reframe this section from the raw notes and the current text. Put the clinic instance, and behaviour during the parent interview, under clinical observation. Keep the carers' account of other times as parent report. Do not add new facts.",
          applyHint: null,
        })
      );
    }
  }

  // --- F. Broader differentials (not only Criterion E ID/GDD) ---
  if (conclusion === "meets" || conclusion === "inconclusive") {
    const differentialCorpus = `${formulation}\n${criterionE}`;
    if (differentialCorpus.trim().length >= 80 && !DIFFERENTIAL_RE.test(differentialCorpus)) {
      out.push(
        finding(input.runId, {
          kind: "differential_coverage",
          severity: "major",
          sectionId: formulation.trim() ? "clinical-formulation" : "criterion-E",
          title: "No broader differential language found",
          detail:
            "Formulation / Criterion E do not name differentials beyond autism (e.g. ADHD, anxiety, language disorder, trauma, ID/GDD). Name and weigh those that are clinically plausible from existing notes.",
          evidenceExcerpt: (formulation || criterionE).slice(0, 220) || null,
          suggestedEdit:
            "Add a short differential paragraph using only conditions already considered in the notes — do not invent new diagnoses.",
          applyHint: null,
        })
      );
    }
  }

  // --- G. Cognitive / adaptive overclaim ---
  const claimSections: ReviewSectionId[] = [
    "clinical-formulation",
    "criterion-E",
    "functional-impact",
    "recommendations",
    "background-early-development",
    "background-educational-history",
  ];
  for (const sid of claimSections) {
    const text = map.get(sid) ?? "";
    if (!text || !COGNITIVE_CLAIM_RE.test(text)) continue;
    if (COGNITIVE_HEDGE_RE.test(text)) continue;
    // Also accept hedge anywhere in formulation+limitations for the same claim section
    if (
      (sid === "clinical-formulation" || sid === "criterion-E" || sid === "functional-impact") &&
      COGNITIVE_HEDGE_RE.test(`${formulation}\n${limitations}\n${criterionE}`)
    ) {
      continue;
    }
    out.push(
      finding(input.runId, {
        kind: "cognitive_overclaim",
        severity: "blocking",
        sectionId: sid,
        title: "Cognitive / adaptive claim without formal-assessment hedge",
        detail:
          "Text refers to IQ, cognitive ability, or adaptive functioning without stating that formal cognitive/adaptive assessment was not completed (or citing a completed battery).",
        evidenceExcerpt: excerptAround(text, COGNITIVE_CLAIM_RE),
        suggestedEdit:
          "Add that no formal cognitive/adaptive assessment was completed, or cite the battery used — do not invent scores.",
        applyHint: null,
      })
    );
  }

  // --- D. Collateral sought or absence documented ---
  const schoolSet = Boolean(input.school.trim());
  const collateralThin = collateral.length < 40;
  if (
    collateralThin &&
    (schoolSet || conclusion === "meets") &&
    !COLLATERAL_ABSENCE_RE.test(`${collateral}\n${formulation}\n${limitations}`)
  ) {
    out.push(
      finding(input.runId, {
        kind: "collateral_gap",
        severity: "major",
        sectionId: "collateral",
        title: "Collateral thin and absence not documented",
        detail: schoolSet
          ? "School is set but collateral summary is empty/thin, and the report does not document that collateral was unavailable."
          : "Diagnostic conclusion is meets, but collateral is empty/thin without documenting that collateral was sought or unavailable.",
        evidenceExcerpt: collateral.slice(0, 180) || null,
        suggestedEdit:
          "Summarise school/teacher/allied health input, or explicitly document that collateral was sought and not available.",
        applyHint: null,
      })
    );
  }

  // --- H. Virtual modality → limitations should acknowledge observation limits ---
  if (input.assessmentModality === "virtual") {
    if (limitations.length < 40 || !VIRTUAL_LIMIT_RE.test(limitations)) {
      out.push(
        finding(input.runId, {
          kind: "modality_limits",
          severity: "major",
          sectionId: "limitations",
          title: "Virtual assessment missing telehealth limitation language",
          detail:
            "Modality is virtual, but Limitations does not acknowledge telehealth/observation constraints or in-person review.",
          evidenceExcerpt: limitations.slice(0, 180) || null,
          suggestedEdit:
            "Note observation limits of virtual care and any plan for in-person review, using only facts already in the draft.",
          applyHint: null,
        })
      );
    }
  }

  // --- J. Limitations present for concluded cases ---
  if ((conclusion === "meets" || conclusion === "does_not_meet") && limitations.length < 40) {
    out.push(
      finding(input.runId, {
        kind: "limitations_honesty",
        severity: "major",
        sectionId: "limitations",
        title: "Limitations section empty for a concluded report",
        detail:
          "A concluded ASD report should include case-specific limitations (sources, modality, missing collateral, testing not done).",
        evidenceExcerpt: limitations.slice(0, 120) || null,
        suggestedEdit:
          "Write brief case-specific limitations from what is already known (do not invent new clinical gaps).",
        applyHint: null,
      })
    );
  }

  // --- I. Severity vs functional impact: levels locked but functional impact empty ---
  if (conclusion === "meets" && functional.length < 40) {
    out.push(
      finding(input.runId, {
        kind: "severity_support",
        severity: "major",
        sectionId: "functional-impact",
        title: "Meets conclusion with empty functional impact",
        detail:
          "Severity/support needs should be grounded in documented functional impact. Functional impact summary is empty/thin.",
        evidenceExcerpt: null,
        suggestedEdit:
          "Document support needs across home/school/community from existing notes before Final PDF.",
        applyHint: null,
      })
    );
  }

  return out;
}
