/** Cloud key for report_states so ASD and ADHD drafts for the same Cliniko patient do not overwrite each other. */
export type TexlexEngineId = "adhd" | "asd";

export function reportStateCloudKey(engine: TexlexEngineId, patientId: string): string {
  return `${engine}:${patientId}`;
}

export function formatDraftSavedAgo(
  iso: string | null | undefined,
  nowMs: number = Date.now()
): string {
  if (!iso) return "unknown time";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "unknown time";
  const diffSec = Math.max(0, Math.floor((nowMs - then) / 1000));
  if (diffSec < 45) return "just now";
  if (diffSec < 3600) return `${Math.max(1, Math.floor(diffSec / 60))}m ago`;
  if (diffSec < 86400) return `${Math.max(1, Math.floor(diffSec / 3600))}h ago`;
  return `${Math.max(1, Math.floor(diffSec / 86400))}d ago`;
}

export async function fetchReportStateForEngine<T extends { engine?: string }>(
  engine: TexlexEngineId,
  patientId: string
): Promise<{ state: T; updatedAt: string | null } | null> {
  const keys = [reportStateCloudKey(engine, patientId), patientId];
  for (const key of keys) {
    try {
      const res = await fetch(`/api/report-state?patientId=${encodeURIComponent(key)}`);
      if (!res.ok) continue;
      const data = (await res.json()) as {
        success?: boolean;
        state?: T | null;
        updatedAt?: string | null;
      };
      if (!data.success || !data.state) continue;
      const tagged = data.state.engine;
      const isPrefixed = key !== patientId;
      if (isPrefixed) {
        if (tagged && tagged !== engine) continue;
        return { state: data.state, updatedAt: data.updatedAt ?? null };
      }
      // Legacy bare patient_id rows: accept matching engine tag, or untagged ASD-era drafts only.
      if (tagged === engine) {
        return { state: data.state, updatedAt: data.updatedAt ?? null };
      }
      if (!tagged && engine === "asd") {
        return { state: data.state, updatedAt: data.updatedAt ?? null };
      }
    } catch {
      /* try next key */
    }
  }
  return null;
}

export async function saveReportStateForEngine(
  engine: TexlexEngineId,
  patientId: string,
  state: unknown
): Promise<boolean> {
  try {
    const res = await fetch("/api/report-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: reportStateCloudKey(engine, patientId),
        state,
      }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success !== false;
  } catch {
    return false;
  }
}
