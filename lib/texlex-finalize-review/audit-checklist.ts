/**
 * Pre-audit checklist status for Finalize Review UI (ASD).
 * Derived from demographics + section text + latest open findings.
 */

import type { ReviewCheckKind, ReviewFinding } from "./types";

export type AuditChecklistItemId =
  | "modality"
  | "observation_sources"
  | "collateral"
  | "differentials"
  | "cognitive_hedge"
  | "severity_functional"
  | "limitations"
  | "virtual_limits";

export type AuditChecklistItem = {
  id: AuditChecklistItemId;
  label: string;
  ok: boolean;
  hint: string;
};

export type AuditChecklistInput = {
  assessmentModality: "" | "in-clinic" | "virtual";
  virtualCareReason?: string;
  diagnosticConclusion: string;
  school: string;
  collateralSummary: string;
  clinicalFormulation: string;
  criterionE: string;
  functionalImpactSummary: string;
  limitationsText: string;
  /** Concatenated A1–B4 indicator text */
  criterionAbText: string;
  openFindings: ReviewFinding[];
};

function openKinds(findings: ReviewFinding[]): Set<ReviewCheckKind> {
  return new Set(
    findings.filter((f) => f.status === "open").map((f) => f.kind)
  );
}

export function buildAsdAuditChecklist(input: AuditChecklistInput): AuditChecklistItem[] {
  const kinds = openKinds(input.openFindings);
  const modalitySet =
    input.assessmentModality === "in-clinic" || input.assessmentModality === "virtual";
  const virtualReasonOk =
    input.assessmentModality !== "virtual" || Boolean(input.virtualCareReason?.trim());

  return [
    {
      id: "modality",
      label: "Assessment modality set (virtual → clinical reason)",
      ok: modalitySet && virtualReasonOk && !kinds.has("modality_mismatch"),
      hint: modalitySet
        ? virtualReasonOk
          ? "Modality locked in demographics."
          : "Virtual modality needs a clinical reason."
        : "Set in-clinic or virtual in Client details.",
    },
    {
      id: "observation_sources",
      label: "Observation vs parent report labelled in A/B criteria",
      ok: !kinds.has("observation_source") && input.criterionAbText.trim().length > 0,
      hint: kinds.has("observation_source")
        ? "Open observation-source findings — label Clinical observation / Parent report."
        : input.criterionAbText.trim()
          ? "No open observation-source flags on this pass."
          : "Generate A/B criterion narratives first.",
    },
    {
      id: "collateral",
      label: "Collateral sought or absence documented",
      ok: !kinds.has("collateral_gap"),
      hint: kinds.has("collateral_gap")
        ? "Document school/teacher/allied health input or that it was unavailable."
        : "Collateral gap check clear.",
    },
    {
      id: "differentials",
      label: "Broader differentials weighed (not only Criterion E)",
      ok: !kinds.has("differential_coverage") && !kinds.has("differential_consistency"),
      hint: kinds.has("differential_coverage") || kinds.has("differential_consistency")
        ? "Name and weigh ADHD / anxiety / language / trauma / ID-GDD where notes support it."
        : "No open differential flags.",
    },
    {
      id: "cognitive_hedge",
      label: "No unsupported IQ / adaptive overclaim",
      ok: !kinds.has("cognitive_overclaim"),
      hint: kinds.has("cognitive_overclaim")
        ? "Add formal-assessment hedge or cite the battery — do not invent scores."
        : "No open cognitive-overclaim flags.",
    },
    {
      id: "severity_functional",
      label: "Severity grounded in functional impact",
      ok: !kinds.has("severity_support") && !kinds.has("level_ab_vs_opening"),
      hint:
        kinds.has("severity_support") || kinds.has("level_ab_vs_opening")
          ? "Align Levels with formulation opening and functional impact evidence."
          : "Severity checks clear.",
    },
    {
      id: "limitations",
      label: "Case-specific limitations present",
      ok: !kinds.has("limitations_honesty") && input.limitationsText.trim().length >= 40,
      hint: kinds.has("limitations_honesty")
        ? "Write limitations that fit this case (sources, modality, missing data)."
        : input.limitationsText.trim().length >= 40
          ? "Limitations present."
          : "Add limitations before Final PDF.",
    },
    {
      id: "virtual_limits",
      label: "Virtual care: observation limits noted",
      ok:
        input.assessmentModality !== "virtual" ||
        (!kinds.has("modality_limits") && !kinds.has("modality_mismatch")),
      hint:
        input.assessmentModality !== "virtual"
          ? "N/A (in-clinic or unset)."
          : kinds.has("modality_limits") || kinds.has("modality_mismatch")
            ? "Note telehealth observation limits and in-person review where indicated."
            : "Virtual limitation language clear.",
    },
  ];
}
