export type PracticeSource = "cliniko" | "halaxy";

export const PRACTICE_SOURCE_STORAGE_KEY = "texlex.practiceSource";

export function isPracticeSource(value: unknown): value is PracticeSource {
  return value === "cliniko" || value === "halaxy";
}

export function practiceApiBase(source: PracticeSource | undefined | null): string {
  return source === "halaxy" ? "/api/halaxy" : "/api/cliniko";
}

export function practiceLabel(source: PracticeSource | undefined | null): string {
  return source === "halaxy" ? "Halaxy" : "Cliniko";
}

export function readStoredPracticeSource(): PracticeSource {
  if (typeof window === "undefined") return "cliniko";
  try {
    const raw = window.localStorage.getItem(PRACTICE_SOURCE_STORAGE_KEY);
    return raw === "halaxy" ? "halaxy" : "cliniko";
  } catch {
    return "cliniko";
  }
}

export function storePracticeSource(source: PracticeSource): void {
  try {
    window.localStorage.setItem(PRACTICE_SOURCE_STORAGE_KEY, source);
  } catch {
    // ignore
  }
}
