/**
 * Layer 2 — what to ask next after we have extracted everything they just said.
 * Does not invent constructs. Only ranks legal holes from the clinical tree.
 * Never asks the same hole twice in a row. After two asks with no lean, we move on.
 */

import { applyUpdates, legalFacets, type Belief, type Facet } from "./parent-a-conversation";

export const MAX_ASKS_PER_FACET = 2;
export const MAX_ASKS_IN_SESSION = 12;

export type ControllerDecision = {
  facet: Facet | null;
  reason: string;
  filledThisTurn: string[];
  beliefs: Record<string, Belief>;
};

function filledIds(before: Record<string, Belief>, after: Record<string, Belief>): string[] {
  return Object.keys(after).filter((id) => {
    const was = before[id]?.polarity ?? "unknown";
    const now = after[id]?.polarity ?? "unknown";
    return was === "unknown" && now !== "unknown";
  });
}

function countsOf(askedFacets: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of askedFacets) {
    if (id === "open" || !id) continue;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

/** If we already asked and still have no lean, write confound so the gate can move. */
export function releaseStuckFacets(
  beliefs: Record<string, Belief>,
  askedFacets: string[]
): Record<string, Belief> {
  const counts = countsOf(askedFacets);
  const stuck = Object.entries(counts)
    .filter(([id, count]) => count >= MAX_ASKS_PER_FACET && beliefs[id]?.polarity === "unknown")
    .map(([id]) => ({
      id,
      polarity: "confound" as const,
      quote: "Moved on — no clear lean after two asks",
      confidence: 0.45,
    }));
  if (!stuck.length) return beliefs;
  return applyUpdates(beliefs, stuck);
}

export function decideNext(
  before: Record<string, Belief>,
  after: Record<string, Belief>,
  askedFacets: string[] = []
): ControllerDecision {
  const filledThisTurn = filledIds(before, after);
  let beliefs = releaseStuckFacets(after, askedFacets);
  const counts = countsOf(askedFacets);
  const lastAsked = [...askedFacets].reverse().find((id) => id && id !== "open") ?? null;

  if (askedFacets.filter((id) => id && id !== "open").length >= MAX_ASKS_IN_SESSION) {
    const leftover = legalFacets(beliefs).filter((facet) => beliefs[facet.id]?.polarity === "unknown");
    if (leftover.length) {
      beliefs = applyUpdates(
        beliefs,
        leftover.map((facet) => ({
          id: facet.id,
          polarity: "confound" as const,
          quote: "Moved on — enough asked",
          confidence: 0.4,
        }))
      );
    }
    return { facet: null, reason: "session cap", filledThisTurn, beliefs };
  }

  const legal = legalFacets(beliefs);
  if (!legal.length) {
    return { facet: null, reason: "tree empty", filledThisTurn, beliefs };
  }

  const movable = legal.filter((facet) => (counts[facet.id] ?? 0) < MAX_ASKS_PER_FACET);
  if (!movable.length) {
    beliefs = applyUpdates(
      beliefs,
      legal
        .filter((facet) => beliefs[facet.id]?.polarity === "unknown")
        .map((facet) => ({
          id: facet.id,
          polarity: "confound" as const,
          quote: "Moved on — no clear lean after two asks",
          confidence: 0.45,
        }))
    );
    const again = legalFacets(beliefs);
    if (!again.length) return { facet: null, reason: "all holes asked twice", filledThisTurn, beliefs };
    return decideNext(before, beliefs, askedFacets);
  }

  const usable = movable.filter((facet) => !filledThisTurn.includes(facet.id));
  const candidates = usable.length ? usable : movable;

  const notLast = lastAsked ? candidates.filter((facet) => facet.id !== lastAsked) : candidates;
  const ranked = (notLast.length ? notLast : candidates).slice().sort((a, b) => {
    return (counts[a.id] ?? 0) - (counts[b.id] ?? 0);
  });

  const chosen = ranked[0] ?? null;
  return {
    facet: chosen,
    reason: chosen
      ? `need ${chosen.id}${filledThisTurn.length ? `; took ${filledThisTurn.join(",")}` : ""}`
      : "tree empty",
    filledThisTurn,
    beliefs,
  };
}
