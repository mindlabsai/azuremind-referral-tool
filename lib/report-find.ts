/** Find a word in a report field and move the page to that word. */

export type ReportField = HTMLInputElement | HTMLTextAreaElement;

export type TextSpan = { start: number; end: number };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function needlePattern(needle: string): string {
  return needle
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(escapeRegExp)
    .join("\\s+");
}

export function firstSpan(text: string, needle: string): TextSpan | null {
  const spans = allSpans(text, needle);
  return spans[0] ?? null;
}

export function allSpans(text: string, needle: string): TextSpan[] {
  const pattern = needlePattern(needle);
  if (!pattern) return [];
  const flags = "gi";
  const exact = needle.trim();
  if (exact && text.includes(exact)) {
    const hits: TextSpan[] = [];
    let from = 0;
    while (from <= text.length) {
      const at = text.indexOf(exact, from);
      if (at < 0) break;
      hits.push({ start: at, end: at + exact.length });
      from = at + Math.max(exact.length, 1);
    }
    return hits;
  }
  const hits: TextSpan[] = [];
  const re = new RegExp(pattern, flags);
  let match = re.exec(text);
  while (match) {
    if (match[0].length === 0) break;
    hits.push({ start: match.index, end: match.index + match[0].length });
    match = re.exec(text);
  }
  return hits;
}

export function collectReportFields(root: ParentNode): ReportField[] {
  const nodes = root.querySelectorAll("textarea, input");
  const fields: ReportField[] = [];
  nodes.forEach((node) => {
    if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement)) return;
    if (node.closest("[data-report-find]")) return;
    if (node.disabled || node.readOnly) return;
    const type = node instanceof HTMLInputElement ? node.type : "textarea";
    if (
      type === "file" ||
      type === "checkbox" ||
      type === "radio" ||
      type === "hidden" ||
      type === "button" ||
      type === "submit" ||
      type === "password" ||
      type === "range" ||
      type === "color"
    ) {
      return;
    }
    fields.push(node);
  });
  return fields;
}

function mirrorOffset(field: HTMLTextAreaElement, index: number): number {
  const mirror = document.createElement("div");
  const style = getComputedStyle(field);
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.style.width = `${field.clientWidth}px`;
  mirror.style.font = style.font;
  mirror.style.lineHeight = style.lineHeight;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.padding = style.padding;
  mirror.style.border = style.border;
  mirror.style.boxSizing = style.boxSizing;
  mirror.textContent = field.value.slice(0, index);
  const mark = document.createElement("span");
  mark.textContent = field.value.slice(index, index + 1) || " ";
  mirror.appendChild(mark);
  document.body.appendChild(mirror);
  const top = mark.offsetTop;
  mirror.remove();
  return top;
}

export function revealMatch(field: ReportField, start: number, end: number) {
  document.querySelectorAll(".report-find-hit").forEach((node) => node.classList.remove("report-find-hit"));
  field.classList.add("report-find-hit");
  field.focus({ preventScroll: true });
  const safeEnd = Math.max(start, Math.min(end, field.value.length));
  const safeStart = Math.max(0, Math.min(start, safeEnd));
  try {
    field.setSelectionRange(safeStart, safeEnd);
  } catch {
    /* number and date inputs cannot select a range */
  }

  let lineTop = field.getBoundingClientRect().top;
  if (field instanceof HTMLTextAreaElement) {
    const local = mirrorOffset(field, safeStart);
    if (field.scrollHeight > field.clientHeight + 8) {
      field.scrollTop = Math.max(0, local - field.clientHeight / 3);
    }
    lineTop = field.getBoundingClientRect().top + local - field.scrollTop;
  }
  const delta = lineTop - window.innerHeight / 3;
  if (Math.abs(delta) > 24) {
    window.scrollBy({ top: delta, behavior: "smooth" });
  }
}

export function writeReportField(field: ReportField, next: string) {
  const prototype =
    field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  const previous = field.value;
  setter?.call(field, next);
  const tracker = (field as HTMLInputElement & { _valueTracker?: { setValue: (value: string) => void } })
    ._valueTracker;
  tracker?.setValue(previous);
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

function scopeForSection(sectionId: string): ParentNode | null {
  const anchor = document.getElementById(sectionId);
  if (!anchor) return null;
  if (anchor.matches("textarea, input")) return anchor.parentElement;
  return anchor.closest("section") ?? anchor;
}

/** Move to the wording inside the section. If it is not there, search the rest of the report. */
export function locateReportLine(sectionId: string, needles: string[]): boolean {
  const local = scopeForSection(sectionId);
  if (local && revealFirst(local, needles)) return true;
  const page = document.querySelector(".texlex-surface, .report-desk");
  if (page && page !== local && revealFirst(page, needles)) return true;
  return false;
}

function revealFirst(root: ParentNode, needles: string[]): boolean {
  const fields = root instanceof HTMLInputElement || root instanceof HTMLTextAreaElement
    ? [root]
    : collectReportFields(root);
  for (const needle of needles) {
    for (const field of fields) {
      const span = firstSpan(field.value, needle);
      if (!span) continue;
      revealMatch(field, span.start, span.end);
      return true;
    }
  }
  return false;
}

export function reviewLineNeedles(finding: {
  applyHint?: { find?: string } | null;
  evidenceExcerpt?: string | null;
}): string[] {
  const needles: string[] = [];
  const add = (value?: string | null) => {
    const text = value?.replace(/\s+/g, " ").trim();
    if (!text || text.length < 2 || needles.includes(text)) return;
    needles.push(text);
  };
  add(finding.applyHint?.find);
  const excerpt = finding.evidenceExcerpt?.replace(/^[\s.…]+|[\s.…]+$/g, "").trim() ?? "";
  add(excerpt);
  if (excerpt.length > 90) add(excerpt.slice(0, 90));
  return needles;
}
