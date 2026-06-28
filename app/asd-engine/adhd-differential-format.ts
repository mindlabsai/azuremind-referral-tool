import { detectAsdDifferential } from "./adhd-asd-differential";

/**
 * Produces the ASD-differential block for an ADHD assessment from the raw notes.
 * AHPRA framing: "warrants ASD assessment", never "ASD likely" or "leading candidate".
 * Surfaces evidence-against so the differential is balanced, not confirmation-only.
 * The engine never concludes ASD; it flags that the presentation warrants assessment.
 */
export function formatAsdDifferential(notes: string): {
  flagged: boolean;
  domainCount: number;
  block: string;
} {
  const r = detectAsdDifferential(notes);

  if (!r.flagged) {
    const against = r.evidenceAgainst.length
      ? ` Disconfirming features noted: ${r.evidenceAgainst.join("; ")}.`
      : "";
    return {
      flagged: false,
      domainCount: r.domains.length,
      block:
        `ASD differential: features were considered across the social-communication, ` +
        `sensory, restricted/repetitive, and play domains. ASD-consistent features did ` +
        `not reach the threshold across domains on the current information (${r.domains.length} domain(s) touched).${against} ` +
        `No ASD assessment is indicated on this basis at present; this remains a clinical judgement.`,
    };
  }

  const against = r.evidenceAgainst.length
    ? ` Features pointing away from an ASD account were also noted: ${r.evidenceAgainst.join("; ")}.`
    : "";
  return {
    flagged: true,
    domainCount: r.domains.length,
    block:
      `ASD differential: ASD-consistent features were identified across ${r.domains.length} ` +
      `domains (${r.domains.join(", ")}). On this basis the presentation warrants formal ASD ` +
      `assessment, including administration of the ASRS and a structured ASD assessment, before ` +
      `the attentional presentation is considered in isolation.${against} This is a preliminary ` +
      `differential observation and not a diagnostic conclusion.`,
  };
}
