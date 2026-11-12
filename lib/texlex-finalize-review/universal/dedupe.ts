import type { ReviewFinding } from "../types";

/** One underlying issue stays one finding. Later copies add their section, they do not become new cards. */
export function dedupeFindings(findings: ReviewFinding[]): ReviewFinding[] {
  const order: string[] = [];
  const byRoot = new Map<string, ReviewFinding>();
  for (const finding of findings) {
    const root = `${finding.kind}::${finding.title.trim().toLowerCase()}`;
    const existing = byRoot.get(root);
    if (!existing) {
      order.push(root);
      byRoot.set(root, { ...finding });
      continue;
    }
    if (!existing.detail.includes(finding.sectionId)) {
      existing.detail = `${existing.detail} Also in ${finding.sectionId}.`;
    }
  }
  return order.map((root) => byRoot.get(root)!);
}
