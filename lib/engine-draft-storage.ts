import type { TexlexEngineId } from "@/lib/texlex-report-state";

export const UNASSIGNED_DRAFT_ID = "draft-unassigned";

const ACTIVE_KEY_SUFFIX = "active-key";

/** Per-engine localStorage key: `adhd:{clinikoId}` or `adhd:draft-unassigned`. */
export function engineLocalDraftKey(
  engine: TexlexEngineId,
  clinikoPatientId?: string | null
): string {
  const id = clinikoPatientId?.trim();
  return id ? `${engine}:${id}` : `${engine}:${UNASSIGNED_DRAFT_ID}`;
}

export function engineActiveDraftPointerKey(engine: TexlexEngineId): string {
  return `${engine}:${ACTIVE_KEY_SUFFIX}`;
}

export function readLocalEngineDraft<T extends object>(key: string): (T & { lastSaved?: string }) | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T & { lastSaved?: string };
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeLocalEngineDraft(
  engine: TexlexEngineId,
  key: string,
  state: unknown
): { ok: boolean; lastSaved: string } {
  const lastSaved = new Date().toISOString();
  if (typeof window === "undefined") return { ok: false, lastSaved };
  try {
    const payload =
      state && typeof state === "object"
        ? { ...(state as Record<string, unknown>), lastSaved, engine }
        : { value: state, lastSaved, engine };
    localStorage.setItem(key, JSON.stringify(payload));
    localStorage.setItem(engineActiveDraftPointerKey(engine), key);
    return { ok: true, lastSaved };
  } catch {
    return { ok: false, lastSaved };
  }
}

export function clearLocalEngineDraft(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function clearEngineActiveDraftPointer(engine: TexlexEngineId): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(engineActiveDraftPointerKey(engine));
  } catch {
    /* ignore */
  }
}

export function readEngineActiveDraftKey(engine: TexlexEngineId): string | null {
  if (typeof window === "undefined") return null;
  try {
    const key = localStorage.getItem(engineActiveDraftPointerKey(engine));
    return key && key.startsWith(`${engine}:`) ? key : null;
  } catch {
    return null;
  }
}

/** Patient id encoded in `adhd:123` / `asd:123`; null for unassigned. */
export function patientIdFromEngineDraftKey(
  engine: TexlexEngineId,
  key: string
): string | null {
  const prefix = `${engine}:`;
  if (!key.startsWith(prefix)) return null;
  const rest = key.slice(prefix.length);
  if (!rest || rest === UNASSIGNED_DRAFT_ID || rest === ACTIVE_KEY_SUFFIX) return null;
  return rest;
}

/** Guard: draft may only be restored when its cliniko id matches the storage key. */
export function draftMatchesStorageKey(
  engine: TexlexEngineId,
  key: string,
  draft: { cliniko?: { patientId?: string | null } | null; engine?: string } | null
): boolean {
  if (!draft) return false;
  if (draft.engine && draft.engine !== engine) return false;
  const keyPatientId = patientIdFromEngineDraftKey(engine, key);
  const draftPatientId = draft.cliniko?.patientId?.trim() || null;
  if (keyPatientId) {
    // Patient-keyed drafts must not carry a different patient id.
    if (draftPatientId && draftPatientId !== keyPatientId) return false;
    return true;
  }
  // Unassigned key: reject drafts that are linked to a Cliniko patient.
  if (draftPatientId) return false;
  return true;
}

/** Clock time for restore banner, e.g. "2:41pm". */
export function formatLocalDraftClockTime(iso: string | null | undefined): string {
  if (!iso) return "unknown time";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "unknown time";
  const hours24 = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const suffix = hours24 >= 12 ? "pm" : "am";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${minutes}${suffix}`;
}

const ASD_LEGACY_PREFIX = "texlex-draft";
const ASD_LEGACY_GLOBAL = "texlex-report-draft-v1";

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** One-time migration from legacy ASD keys into `asd:{id}` / `asd:draft-unassigned`. */
export function migrateAsdLegacyLocalDrafts(): void {
  if (typeof window === "undefined") return;
  try {
    const globalRaw = localStorage.getItem(ASD_LEGACY_GLOBAL);
    if (globalRaw) {
      try {
        const data = JSON.parse(globalRaw) as {
          cliniko?: { patientId?: string | null } | null;
          patientDetails?: { clientName?: string };
        };
        const patientId = data.cliniko?.patientId?.trim() || null;
        const key = engineLocalDraftKey("asd", patientId);
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, globalRaw);
          localStorage.setItem(engineActiveDraftPointerKey("asd"), key);
        }
      } catch {
        /* ignore */
      }
      localStorage.removeItem(ASD_LEGACY_GLOBAL);
    }

    for (let i = 0; i < localStorage.length; i++) {
      const oldKey = localStorage.key(i);
      if (!oldKey || !oldKey.startsWith(`${ASD_LEGACY_PREFIX}-`)) continue;
      const raw = localStorage.getItem(oldKey);
      if (!raw) continue;
      let patientId: string | null = null;
      const clinikoMatch = oldKey.match(/^texlex-draft-cliniko-(.+)$/);
      if (clinikoMatch) {
        patientId = clinikoMatch[1] ?? null;
      } else if (oldKey.startsWith(`${ASD_LEGACY_PREFIX}-manual-`)) {
        patientId = null;
      } else {
        continue;
      }
      const newKey = engineLocalDraftKey("asd", patientId);
      if (!localStorage.getItem(newKey)) {
        localStorage.setItem(newKey, raw);
        localStorage.setItem(engineActiveDraftPointerKey("asd"), newKey);
      }
      localStorage.removeItem(oldKey);
      // indices shift after removeItem — restart scan
      i = -1;
    }
  } catch {
    /* ignore */
  }
}

export function clearAsdLegacyLocalDraftKeys(
  clinikoId: string | null | undefined,
  clientName: string | null | undefined
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ASD_LEGACY_GLOBAL);
    if (clinikoId) {
      localStorage.removeItem(`${ASD_LEGACY_PREFIX}-cliniko-${clinikoId}`);
    }
    if (clientName?.trim()) {
      localStorage.removeItem(`${ASD_LEGACY_PREFIX}-manual-${slugifyName(clientName)}`);
    }
  } catch {
    /* ignore */
  }
}
