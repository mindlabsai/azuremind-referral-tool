"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DRAFT_NAME_SEARCH_MIN_CHARS,
  listLocalEngineDraftsByName,
  mergeNamedDraftHits,
  type NamedDraftHit,
} from "@/lib/texlex-draft-name-search";
import {
  formatDraftSavedAgo,
  type TexlexEngineId,
} from "@/lib/texlex-report-state";

type SavedDraftsByNameProps = {
  engine: TexlexEngineId;
  clientName: string;
  currentPatientId?: string | null;
  onResume: (hit: NamedDraftHit) => void;
};

export function SavedDraftsByName({
  engine,
  clientName,
  currentPatientId,
  onResume,
}: SavedDraftsByNameProps) {
  const [hits, setHits] = useState<NamedDraftHit[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = clientName.trim();
    if (q.length < DRAFT_NAME_SEARCH_MIN_CHARS) {
      setHits([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      const localHits = listLocalEngineDraftsByName(engine, q);
      void (async () => {
        let cloudHits: NamedDraftHit[] = [];
        try {
          const res = await fetch(
            `/api/report-state/search?engine=${engine}&q=${encodeURIComponent(q)}`
          );
          if (res.ok) {
            const data = (await res.json()) as { success?: boolean; hits?: NamedDraftHit[] };
            if (data.success && Array.isArray(data.hits)) cloudHits = data.hits;
          }
        } catch {
          /* local hits still shown */
        }
        if (cancelled) return;
        const merged = mergeNamedDraftHits(localHits, cloudHits).filter((hit) => {
          if (!currentPatientId || !hit.patientId) return true;
          return hit.patientId !== currentPatientId;
        });
        setHits(merged.slice(0, 6));
        setSearching(false);
      })();
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [clientName, currentPatientId, engine]);

  if (clientName.trim().length < DRAFT_NAME_SEARCH_MIN_CHARS) return null;
  if (!searching && hits.length === 0) return null;

  return (
    <div className="mt-2 space-y-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 dark:border-amber-800/60 dark:bg-amber-950/30">
      <p className="text-xs font-medium text-foreground">
        {searching && hits.length === 0
          ? "Looking for saved reports…"
          : "Saved reports matching this name"}
      </p>
      {hits.map((hit) => (
        <div key={hit.id} className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-sm text-foreground">
            {hit.clientName || "Unnamed"}
            <span className="ml-1 text-xs text-muted-foreground">
              {hit.source === "local" ? "this browser" : "cloud"} · last saved{" "}
              {formatDraftSavedAgo(hit.lastSaved)}
            </span>
          </p>
          <Button type="button" size="sm" className="h-7 shrink-0 px-2 text-xs" onClick={() => onResume(hit)}>
            Resume
          </Button>
        </div>
      ))}
    </div>
  );
}
