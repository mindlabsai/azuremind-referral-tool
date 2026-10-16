import type { ReviewFinding } from "../types";

export function reviewDisplay(findings: ReviewFinding[]): string {
  const open = findings.filter((finding) => finding.status === "open" || finding.status === "accepted");
  if (open.length === 0) return "No material issues found in the material available";
  const noun = open.length === 1 ? "item" : "items";
  return `${open.length} ${noun} worth checking`;
}

const INSTRUCTION =
  /^(label |add |summarise |summarize |note |write |document |use |align |replace |record |reframe )/i;

/** A proposal Apply can write. Instructions and empty edits are not proposals. */
export function isPasteableProposal(suggestedEdit: string | null | undefined): boolean {
  const text = suggestedEdit?.trim() ?? "";
  if (text.length < 12) return false;
  return !INSTRUCTION.test(text);
}
