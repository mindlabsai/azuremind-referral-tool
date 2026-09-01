/**
 * ASD assessment modality — aligned with ADHD (`in-clinic` / `virtual`), plus
 * virtual-care reason, PDF context line, generation gate, and recommendations inject.
 */

export type AsdAssessmentModality = "" | "in-clinic" | "virtual";

export interface ModalityInput {
  modality: AsdAssessmentModality | undefined;
  /** Required when virtual — clinical justification (e.g. absconding risk). */
  virtualCareReason?: string;
}

export interface ModalityGateResult {
  ok: boolean;
  errors: string[];
}

export function gateModality(input: ModalityInput): ModalityGateResult {
  const errors: string[] = [];
  if (!input.modality) {
    errors.push("Assessment modality (in-clinic / virtual) is not set.");
  }
  if (input.modality === "virtual" && !input.virtualCareReason?.trim()) {
    errors.push(
      "Virtual assessments require a one-line clinical reason (e.g. inability to " +
        "remain in-room, absconding risk, geographic access)."
    );
  }
  return { ok: errors.length === 0, errors };
}

const TELEHEALTH_CONFIDENCE_STATEMENT =
  "Consistent with national guidance that telehealth may complement but should " +
  "not constitute the sole medium of assessment, findings from this virtual " +
  "assessment should be read alongside the recommended in-person medical review, " +
  "and diagnostic confidence interpreted accordingly.";

export function buildAssessmentContextModality(input: ModalityInput): string {
  if (input.modality === "in-clinic") {
    return "This assessment was conducted in-clinic.";
  }
  if (input.modality === "virtual") {
    const reason = input.virtualCareReason?.trim();
    return [
      "This assessment was conducted via secure video (telehealth virtual care)" +
        (reason ? `, as ${reason}.` : "."),
      TELEHEALTH_CONFIDENCE_STATEMENT,
    ].join(" ");
  }
  return "";
}

/**
 * When modality is virtual, ensure recommendations carry an in-person element.
 * ASD recommendations are a single prose/numbered string (not string[]).
 */
export function ensureInPersonConfirmationText(
  recommendations: string,
  input: ModalityInput
): string {
  if (input.modality !== "virtual") return recommendations;
  if (/in-person/i.test(recommendations)) return recommendations;

  const clause =
    ", including in-person review given the virtual modality of this assessment";
  const firstItem = recommendations.match(/^(\s*(?:1[.)]|[-*•])\s*[^\n]+?)(\.)(\s|$)/m);
  if (firstItem && firstItem.index != null) {
    const start = firstItem.index;
    const end = start + firstItem[0].length;
    return (
      recommendations.slice(0, start) +
      `${firstItem[1]}${clause}.${firstItem[3]}` +
      recommendations.slice(end)
    );
  }

  const trimmed = recommendations.trimEnd();
  if (!trimmed) {
    return "In-person medical review is recommended given the virtual modality of this assessment.";
  }
  return `${trimmed}\n\nIn-person medical review is recommended given the virtual modality of this assessment.`;
}

export function parseAsdAssessmentModality(raw: unknown): AsdAssessmentModality {
  if (raw === "in-clinic" || raw === "virtual") return raw;
  // Tolerate underscore form from early draft packs
  if (raw === "in_clinic") return "in-clinic";
  return "";
}
