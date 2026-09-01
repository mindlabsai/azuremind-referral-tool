/**
 * DSM-5-TR severity is a support-needs judgement, clinician-set per domain.
 * Criterion ratings (0–3 evidence-strength) are a different construct and must
 * never be mapped to levels. Engine deriveLevelOfSupport is suggestion-only.
 */

export type DsmLevel = 1 | 2 | 3;

export const SEVERITY_LABEL: Record<DsmLevel, string> = {
  1: "Level 1 (requiring support)",
  2: "Level 2 (requiring substantial support)",
  3: "Level 3 (requiring very substantial support)",
};

export type SeveritySource =
  | "engine_suggested_confirmed"
  | "engine_suggested_overridden"
  | "clinician_manual";

export interface SeveritySuggestion {
  levelA?: DsmLevel;
  levelB?: DsmLevel;
  determinable: boolean;
  basis?: string;
}

export interface ConfirmedSeverity {
  levelA: DsmLevel;
  levelB: DsmLevel;
  source: SeveritySource;
  suggested: { levelA?: DsmLevel; levelB?: DsmLevel } | null;
  confirmedBy: string;
  confirmedAtISO: string;
  rationale: string;
}

export interface SeverityGateResult {
  ok: boolean;
  errors: string[];
  confirmed?: ConfirmedSeverity;
}

export type SeverityAuditRecord = {
  source: SeveritySource;
  suggested_levelA: DsmLevel | null;
  suggested_levelB: DsmLevel | null;
  confirmed_levelA: DsmLevel;
  confirmed_levelB: DsmLevel;
  confirmed_by: string;
  confirmed_at: string;
  rationale: string;
};

const MIN_RATIONALE_CHARS = 40;

/** Prefill text for the rationale field from an engine suggestion. */
export function buildDefaultSeverityRationale(suggestion: SeveritySuggestion): string {
  if (!suggestion.determinable || !suggestion.levelA || !suggestion.levelB) return "";
  const head = `Engine-suggested support needs: Level A ${suggestion.levelA}, Level B ${suggestion.levelB}.`;
  const basis = suggestion.basis?.trim();
  return basis ? `${head} ${basis}` : `${head} Confirm or edit levels before generating formulation.`;
}

function asDsmLevel(value: unknown): DsmLevel | undefined {
  if (value === 1 || value === 2 || value === 3) return value;
  return undefined;
}

/** One-line basis from existing engine rationale fields (no new engine field required). */
export function buildEngineSeverityBasis(pipelineLevelOfSupport: {
  criterionA?: { rationale?: unknown };
  criterionB?: { rationale?: unknown };
  derivationNote?: unknown;
  levelOneFloorMaskingNote?: unknown;
  formattedSpecifier?: unknown;
} | null | undefined): string | undefined {
  if (!pipelineLevelOfSupport) return undefined;
  const chunks: string[] = [];
  const pushRationale = (raw: unknown) => {
    if (!Array.isArray(raw)) return;
    for (const item of raw) {
      if (typeof item === "string" && item.trim()) chunks.push(item.trim());
    }
  };
  pushRationale(pipelineLevelOfSupport.criterionA?.rationale);
  pushRationale(pipelineLevelOfSupport.criterionB?.rationale);
  if (typeof pipelineLevelOfSupport.derivationNote === "string" && pipelineLevelOfSupport.derivationNote.trim()) {
    chunks.push(pipelineLevelOfSupport.derivationNote.trim());
  }
  if (
    typeof pipelineLevelOfSupport.levelOneFloorMaskingNote === "string" &&
    pipelineLevelOfSupport.levelOneFloorMaskingNote.trim()
  ) {
    chunks.push(pipelineLevelOfSupport.levelOneFloorMaskingNote.trim());
  }
  if (chunks.length === 0 && typeof pipelineLevelOfSupport.formattedSpecifier === "string") {
    const line = pipelineLevelOfSupport.formattedSpecifier.split("\n")[0]?.trim();
    if (line) chunks.push(line);
  }
  const joined = chunks.join(" ").replace(/\s+/g, " ").trim();
  return joined ? joined.slice(0, 320) : undefined;
}

/**
 * Build the pre-fill for the confirmation UI. NEVER auto-applies into generation.
 */
export function buildSeveritySuggestion(
  pipelineLevelOfSupport: {
    determinable?: boolean;
    levelA?: unknown;
    levelB?: unknown;
    basis?: string;
    criterionA?: { rationale?: unknown };
    criterionB?: { rationale?: unknown };
    derivationNote?: unknown;
    levelOneFloorMaskingNote?: unknown;
    formattedSpecifier?: unknown;
  } | null | undefined
): SeveritySuggestion {
  const levelA = asDsmLevel(pipelineLevelOfSupport?.levelA);
  const levelB = asDsmLevel(pipelineLevelOfSupport?.levelB);
  if (pipelineLevelOfSupport?.determinable && levelA && levelB) {
    return {
      determinable: true,
      levelA,
      levelB,
      basis:
        pipelineLevelOfSupport.basis?.trim() ||
        buildEngineSeverityBasis(pipelineLevelOfSupport) ||
        "Engine marker/adjunct heuristic",
    };
  }
  return { determinable: false };
}

/** Prefill when clinician sets levels with no usable engine suggestion. */
export function buildManualSeverityRationale(levelA: DsmLevel, levelB: DsmLevel): string {
  return `Clinician-set support needs: Level A ${levelA}, Level B ${levelB}.`;
}

/**
 * The only path to a usable severity when conclusion is meets.
 * - first: engine accept is light; overriding a real engine suggestion needs a short rationale
 * - regenerate: after report/formulation exists — trust current A/B; no override tax
 */
export function confirmSeverity(input: {
  levelA: DsmLevel | undefined;
  levelB: DsmLevel | undefined;
  suggestion: SeveritySuggestion;
  confirmedBy: string | undefined;
  rationale: string | undefined;
  conclusion: "meets" | "does_not_meet" | "inconclusive";
  /** first = initial lock; regenerate = post-report refine (clinician levels win). */
  mode?: "first" | "regenerate";
}): SeverityGateResult {
  const errors: string[] = [];
  const mode = input.mode ?? "first";

  if (input.conclusion !== "meets") {
    return { ok: true, errors: [] };
  }

  if (!input.levelA) {
    errors.push("Severity Level A (social communication) is not set. Clinician must set it per domain.");
  }
  if (!input.levelB) {
    errors.push("Severity Level B (RRB) is not set. Clinician must set it per domain.");
  }
  if (!input.confirmedBy?.trim()) {
    errors.push("Severity has no clinician attribution (assessor field is empty).");
  }

  if (errors.length) return { ok: false, errors };

  const s = input.suggestion;
  const acceptingEngine =
    Boolean(s.determinable) && s.levelA === input.levelA && s.levelB === input.levelB;

  let rationale = input.rationale?.trim() ?? "";
  if (!rationale && acceptingEngine) {
    rationale = buildDefaultSeverityRationale(s);
  }
  if (!rationale && (!s.determinable || mode === "regenerate")) {
    rationale = buildManualSeverityRationale(input.levelA!, input.levelB!);
  }

  const overridingEngine = Boolean(s.determinable) && !acceptingEngine;
  if (mode === "first" && overridingEngine && rationale.length < MIN_RATIONALE_CHARS) {
    errors.push(
      `Severity was changed from the engine suggestion — add a short rationale (min ${MIN_RATIONALE_CHARS} characters) for the override, or use Regenerate after the report exists to refine with your levels.`
    );
  } else if (!rationale) {
    errors.push("Choose Level A and Level B before generating formulation.");
  }

  if (errors.length) return { ok: false, errors };

  const source: SeveritySource = !s.determinable
    ? "clinician_manual"
    : acceptingEngine
      ? "engine_suggested_confirmed"
      : "engine_suggested_overridden";

  return {
    ok: true,
    errors: [],
    confirmed: {
      levelA: input.levelA!,
      levelB: input.levelB!,
      source,
      suggested: s.determinable ? { levelA: s.levelA, levelB: s.levelB } : null,
      confirmedBy: input.confirmedBy!.trim(),
      confirmedAtISO: new Date().toISOString(),
      rationale,
    },
  };
}

export function severityAuditRecord(sev: ConfirmedSeverity): SeverityAuditRecord {
  return {
    source: sev.source,
    suggested_levelA: sev.suggested?.levelA ?? null,
    suggested_levelB: sev.suggested?.levelB ?? null,
    confirmed_levelA: sev.levelA,
    confirmed_levelB: sev.levelB,
    confirmed_by: sev.confirmedBy,
    confirmed_at: sev.confirmedAtISO,
    rationale: sev.rationale,
  };
}

export function severitySourceLabel(source: SeveritySource): string {
  if (source === "engine_suggested_confirmed") return "engine-suggested, confirmed";
  if (source === "engine_suggested_overridden") return "engine-suggested, overridden";
  return "clinician manual";
}

export function parseStoredSeverityAudit(raw: unknown): SeverityAuditRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const levelA = asDsmLevel(r.confirmed_levelA);
  const levelB = asDsmLevel(r.confirmed_levelB);
  const source = r.source;
  if (
    !levelA ||
    !levelB ||
    (source !== "engine_suggested_confirmed" &&
      source !== "engine_suggested_overridden" &&
      source !== "clinician_manual")
  ) {
    return null;
  }
  if (typeof r.confirmed_by !== "string" || typeof r.confirmed_at !== "string") return null;
  if (typeof r.rationale !== "string") return null;
  return {
    source,
    suggested_levelA: asDsmLevel(r.suggested_levelA) ?? null,
    suggested_levelB: asDsmLevel(r.suggested_levelB) ?? null,
    confirmed_levelA: levelA,
    confirmed_levelB: levelB,
    confirmed_by: r.confirmed_by,
    confirmed_at: r.confirmed_at,
    rationale: r.rationale,
  };
}
