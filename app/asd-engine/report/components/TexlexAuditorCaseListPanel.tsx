"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  downloadAuditorCaseListCsv,
  listLocalAuditorCaseRows,
  mergeAuditorCaseRows,
  type AuditorCaseRow,
} from "@/lib/texlex-auditor-case-list";
import {
  TEXLEX_SECTION_CONTAINER_CLASS,
  TEXLEX_SECTION_CONTENT_CLASS,
} from "../constants/texlexSectionSurface";

const SECTION_ID = "auditor-case-list";

type Props = {
  className?: string;
};

export function TexlexAuditorCaseListPanel({ className }: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<AuditorCaseRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const expandIfTargeted = () => {
      if (typeof window === "undefined") return;
      if (window.location.hash.replace(/^#/, "") === SECTION_ID) setOpen(true);
    };
    const onNavJump = (e: Event) => {
      const id = (e as CustomEvent<{ id?: string }>).detail?.id;
      if (id === SECTION_ID) setOpen(true);
    };
    expandIfTargeted();
    window.addEventListener("hashchange", expandIfTargeted);
    window.addEventListener("texlex-nav-jump", onNavJump);
    return () => {
      window.removeEventListener("hashchange", expandIfTargeted);
      window.removeEventListener("texlex-nav-jump", onNavJump);
    };
  }, []);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const local = listLocalAuditorCaseRows("asd");
      let cloud: AuditorCaseRow[] = [];
      try {
        const res = await fetch("/api/report-state/case-list?engine=asd");
        const data = (await res.json()) as {
          success?: boolean;
          rows?: AuditorCaseRow[];
          error?: string;
        };
        if (res.ok && data.success && Array.isArray(data.rows)) {
          cloud = data.rows;
        } else if (!res.ok) {
          setError(data.error || "Cloud case list unavailable — showing local drafts only.");
        }
      } catch {
        setError("Cloud case list unavailable — showing local drafts only.");
      }
      setRows(mergeAuditorCaseRows(local, cloud));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  return (
    <section id={SECTION_ID} className={className}>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <button
          type="button"
          className="text-left text-lg font-semibold tracking-tight text-foreground"
          onClick={() => setOpen((v) => !v)}
        >
          Auditor case list {open ? "▾" : "▸"}
        </button>
        <span className="text-xs text-muted-foreground sm:text-right">
          AHPRA selection fields · local + cloud drafts
        </span>
      </div>
      {open ? (
        <Card className={TEXLEX_SECTION_CONTAINER_CLASS}>
          <CardContent className={cn(TEXLEX_SECTION_CONTENT_CLASS, "space-y-4")}>
            <p className="text-sm text-muted-foreground">
              Export eligible ASD cases with date of assessment, age, modality, report date, and
              diagnostic outcome for auditor sample selection. Includes this browser&apos;s drafts
              and cloud saves. De-identify before external sharing if required.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => void refresh()} disabled={busy}>
                {busy ? "Refreshing…" : "Refresh list"}
              </Button>
              <Button
                type="button"
                onClick={() => downloadAuditorCaseListCsv(rows)}
                disabled={!rows.length || busy}
              >
                Download CSV ({rows.length})
              </Button>
            </div>
            {error ? (
              <p className="text-sm text-muted-foreground" role="status">
                {error}
              </p>
            ) : null}
            {rows.length === 0 && !busy ? (
              <p className="text-sm text-muted-foreground">No ASD drafts found yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Client</th>
                      <th className="py-2 pr-3 font-medium">Assessment</th>
                      <th className="py-2 pr-3 font-medium">Age</th>
                      <th className="py-2 pr-3 font-medium">Modality</th>
                      <th className="py-2 pr-3 font-medium">Report date</th>
                      <th className="py-2 pr-3 font-medium">Outcome</th>
                      <th className="py-2 font-medium">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={`${r.source}:${r.storageKey}`} className="border-b border-border/60">
                        <td className="py-2 pr-3 text-foreground">{r.clientName}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{r.dateOfAssessment}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{r.ageAtAssessment}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{r.assessmentModality}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{r.dateReportCompleted}</td>
                        <td className="py-2 pr-3 text-foreground">{r.diagnosticOutcome}</td>
                        <td className="py-2">
                          <Badge variant="outline">{r.source}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
