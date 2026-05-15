/** Display-only label for model attribution pills (does not affect routing). */
export function formatTexlexModelPillLabel(modelName: string): string {
  const normalized = modelName.trim();
  const version = normalized.match(/(\d+\.\d+)/)?.[1];
  if (/opus/i.test(normalized)) {
    return version ? `OPUS ${version}` : "OPUS";
  }
  if (/sonnet/i.test(normalized)) {
    return version ? `SONNET ${version}` : "SONNET";
  }
  return normalized.replace(/^claude\s+/i, "").toUpperCase();
}

const TEXLEX_MODEL_PILL_CLASS =
  "inline-flex rounded-[4px] px-2 py-[3px] text-[10px] font-medium uppercase tracking-[0.02em] text-[var(--teal-text)] bg-[var(--teal-fill)]";

export function TexlexModelPill({ modelName }: { modelName: string }) {
  return (
    <span className={TEXLEX_MODEL_PILL_CLASS}>{formatTexlexModelPillLabel(modelName)}</span>
  );
}
