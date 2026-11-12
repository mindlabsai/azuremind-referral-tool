import { patientIdFromEngineDraftKey, readLocalEngineDraft } from "@/lib/engine-draft-storage";
import type { TexlexEngineId } from "@/lib/texlex-report-state";

export const DRAFT_NAME_SEARCH_MIN_CHARS = 3;

export type NamedDraftHit = {
  id: string;
  source: "local" | "cloud";
  engine: TexlexEngineId;
  clientName: string;
  lastSaved: string | null;
  patientId: string | null;
  storageKey: string;
  state: Record<string, unknown>;
};

export function normalizeDraftNameQuery(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function draftNameMatches(clientName: string | null | undefined, query: string): boolean {
  const name = normalizeDraftNameQuery(clientName ?? "");
  const q = normalizeDraftNameQuery(query);
  if (q.length < DRAFT_NAME_SEARCH_MIN_CHARS || !name) return false;
  if (name.includes(q) || q.includes(name)) return true;
  return q.split(" ").filter(Boolean).every((token) => name.includes(token));
}

function clientNameFromState(state: Record<string, unknown> | null): string {
  if (!state) return "";
  const details = state.patientDetails;
  if (!details || typeof details !== "object") return "";
  const name = (details as { clientName?: unknown }).clientName;
  return typeof name === "string" ? name : "";
}

function lastSavedFromState(state: Record<string, unknown> | null, fallback?: string | null): string | null {
  if (typeof state?.lastSaved === "string" && state.lastSaved.trim()) return state.lastSaved;
  return fallback?.trim() || null;
}

/** Scan this browser's engine drafts for a client-name match. Does not write storage. */
export function listLocalEngineDraftsByName(
  engine: TexlexEngineId,
  query: string
): NamedDraftHit[] {
  if (typeof window === "undefined") return [];
  const q = normalizeDraftNameQuery(query);
  if (q.length < DRAFT_NAME_SEARCH_MIN_CHARS) return [];
  const hits: NamedDraftHit[] = [];
  const prefix = `${engine}:`;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      if (key === `${engine}:active-key`) continue;
      const draft = readLocalEngineDraft<Record<string, unknown>>(key);
      if (!draft) continue;
      const clientName = clientNameFromState(draft);
      if (!draftNameMatches(clientName, query)) continue;
      const patientId = patientIdFromEngineDraftKey(engine, key);
      hits.push({
        id: `local:${key}`,
        source: "local",
        engine,
        clientName,
        lastSaved: lastSavedFromState(draft),
        patientId,
        storageKey: key,
        state: draft,
      });
    }
  } catch {
    return hits;
  }
  hits.sort((a, b) => (b.lastSaved ?? "").localeCompare(a.lastSaved ?? ""));
  return hits;
}

export function mergeNamedDraftHits(localHits: NamedDraftHit[], cloudHits: NamedDraftHit[]): NamedDraftHit[] {
  const byPatient = new Map<string, NamedDraftHit>();
  for (const hit of [...cloudHits, ...localHits]) {
    const key = hit.patientId
      ? `id:${hit.patientId}`
      : `name:${normalizeDraftNameQuery(hit.clientName)}:${hit.storageKey}`;
    const existing = byPatient.get(key);
    if (!existing) {
      byPatient.set(key, hit);
      continue;
    }
    if ((hit.lastSaved ?? "") > (existing.lastSaved ?? "")) {
      byPatient.set(key, { ...hit, source: hit.source === "local" || existing.source === "local" ? "local" : "cloud" });
    }
  }
  return Array.from(byPatient.values()).sort((a, b) =>
    (b.lastSaved ?? "").localeCompare(a.lastSaved ?? "")
  );
}
