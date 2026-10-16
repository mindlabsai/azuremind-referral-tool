import type { ReviewFinding } from "../types";

/** Phrase and length checks that Universal Review V2 does not run. */
const SUPPRESSED_TITLES = new Set([
  "Virtual assessment missing in-person review language",
]);

export function includeLegacyAhpraChecks(pathway: "asd" | "adhd", universalV2: boolean): boolean {
  return pathway === "asd" && !universalV2;
}

/** Drop forced-phrase findings. Real modality contradictions stay. */
export function applyUniversalPolicy(findings: ReviewFinding[]): ReviewFinding[] {
  return findings.filter((finding) => !SUPPRESSED_TITLES.has(finding.title));
}
