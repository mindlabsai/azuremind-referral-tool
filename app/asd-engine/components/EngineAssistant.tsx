"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, FileText, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildClinicianSelfCareStatement, useAsdEnginePipeline } from "../asd-engine-core";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export type EngineAssistantProps = {
  rawNotes: string;
  compact?: boolean;
};

export function EngineAssistant({ rawNotes, compact }: EngineAssistantProps) {
  const [workspaceView, setWorkspaceView] = useState<"clinician" | "evidence">("clinician");
  const debouncedRawNotes = useDebouncedValue(rawNotes, 400);
  const {
    evidenceMarkersList,
    contradictions,
    severity,
    draft,
    missing,
    evidenceLedger,
    supportNeeds,
    dsmMatrix,
    levelOfSupport,
    clinicianPrompts,
    ndisDomains,
    keyClinicalSignalRows,
  } = useAsdEnginePipeline(debouncedRawNotes);

  const pad = compact ? "p-3" : "p-5";
  const cardR = compact ? "rounded-xl shadow-sm" : "rounded-2xl shadow-sm";
  const h2 = compact ? "text-base font-semibold" : "text-lg font-semibold";
  const outer = cn(compact ? "space-y-3 text-[13px] leading-snug" : "space-y-5");
  const gridGap = compact ? "gap-3" : "gap-5";
  const icon = compact ? "h-4 w-4" : "h-5 w-5";
  const ledgerMax = compact ? "max-h-[240px]" : "max-h-[520px]";
  const scrollMax = compact ? "max-h-[220px]" : "max-h-[340px]";
  const threeCol = compact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-3";

  return (
    <div className={cn(outer, "text-slate-950")}>
      <Tabs value={workspaceView} onValueChange={(v) => setWorkspaceView(v as "clinician" | "evidence")}>
        <TabsList
          className={cn(
            "grid h-auto w-full grid-cols-2 rounded-xl p-1 md:inline-flex md:w-auto",
            compact && "h-8 text-xs"
          )}
        >
          <TabsTrigger value="clinician" className="rounded-lg">
            Clinician view
          </TabsTrigger>
          <TabsTrigger value="evidence" className="rounded-lg">
            Evidence view
          </TabsTrigger>
        </TabsList>
        <TabsContent value="clinician" className={cn("mt-4 border-0 p-0 outline-none", compact && "mt-2 space-y-3")}>
          <Card className={cardR}>
            <CardContent className={pad}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className={h2}>DSM Snapshot</h2>
                  <p className={cn("mt-1 text-slate-600", compact ? "text-[11px]" : "text-xs")}>
                    Compact criterion counts — switch to Evidence view for the full matrix and ledger.
                  </p>
                </div>
                <Badge variant="outline" className={compact ? "text-[10px]" : undefined}>
                  {severity.label}
                </Badge>
              </div>
              <div className="mt-3 overflow-hidden rounded-xl border">
                <table className={cn("w-full text-left", compact ? "text-[10px]" : "text-xs")}>
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="p-2">Code</th>
                      <th className="p-2">N</th>
                      <th className="p-2">Status</th>
                      <th className="hidden sm:table-cell p-2">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dsmMatrix.map((row: any) => (
                      <tr key={row.code} className="border-t">
                        <td className="p-2 font-semibold">{row.code}</td>
                        <td className="p-2 text-slate-700">{row.count}</td>
                        <td className="p-2">
                          <Badge
                            variant={
                              row.status === "Strong"
                                ? "default"
                                : row.status === "Partial"
                                  ? "secondary"
                                  : "outline"
                            }
                            className="text-[10px]"
                          >
                            {row.status}
                          </Badge>
                        </td>
                        <td className="hidden sm:table-cell p-2 text-slate-500">{row.confidence}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className={cn(cardR, compact ? "mt-3" : "mt-4")}>
            <CardContent className={pad}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className={h2}>Key Clinical Signals</h2>
                  <p className={cn("mt-1 text-slate-600", compact ? "text-[11px]" : "text-xs")}>
                    Grouped impression only — no raw marker list or percentages.
                  </p>
                </div>
              </div>
              <ul className={cn("mt-4 space-y-3", compact && "mt-2 space-y-2")}>
                {keyClinicalSignalRows.map((row) => (
                  <li
                    key={row.title}
                    className="flex flex-col gap-1 rounded-xl border border-slate-100 bg-slate-50/60 p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className={cn("font-medium text-slate-900", compact ? "text-xs" : "text-sm")}>
                        {row.title}
                      </div>
                      <p className={cn("mt-1 leading-relaxed text-slate-600", compact ? "text-[11px]" : "text-xs")}>
                        {row.sentence}
                      </p>
                    </div>
                    <Badge
                      variant={
                        row.status === "Strong"
                          ? "default"
                          : row.status === "Moderate"
                            ? "secondary"
                            : "outline"
                      }
                      className="shrink-0 self-start sm:mt-0.5"
                    >
                      {row.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="evidence" className="mt-4 border-0 p-0 outline-none">
          <p
            className={cn(
              "rounded-xl border border-dashed border-slate-200 bg-slate-50/90 p-3 text-slate-600",
              compact ? "text-xs" : "text-sm"
            )}
          >
            <span className="font-medium text-slate-800">Evidence view</span> — full DSM-5 criterion matrix and
            evidence ledger are below (not shown in Clinician view).
          </p>
          <div
            className={cn(
              "mt-2 rounded-xl border border-slate-200 bg-white p-3 font-mono leading-relaxed text-slate-700",
              compact ? "text-[10px]" : "text-[11px]"
            )}
          >
            <div>Input processed: {rawNotes.length.toLocaleString()} characters</div>
            <div className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-words text-slate-600">
              Last 200 chars: {rawNotes.length ? rawNotes.slice(-200) : "—"}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {workspaceView === "evidence" ? (
        <Card className={cardR}>
          <CardContent className={pad}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className={h2}>Clinical signal</h2>
                <p className={cn("mt-1 text-slate-600", compact ? "text-xs" : "text-sm")}>
                  {severity.label} · marker load index {severity.score.toFixed(1)}
                </p>
              </div>
              <Sparkles className={cn(icon, "text-slate-500")} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {evidenceMarkersList.length ? (
                evidenceMarkersList.map((m, idx) => (
                  <Badge
                    key={`${m.code}-${m.label}-${idx}`}
                    variant="outline"
                    className={cn("rounded-full px-3 py-1", compact && "text-[10px]")}
                  >
                    {m.code}: {m.label} · {Math.round(m.confidence * 100)}%
                  </Badge>
                ))
              ) : (
                <p className={cn("text-slate-500", compact ? "text-xs" : "text-sm")}>No markers detected yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {workspaceView === "evidence" ? (
        <Card className={cardR}>
          <CardContent className={pad}>
            <h2 className={h2}>Support needs estimate</h2>
            <p className={cn("mt-1 font-medium", compact ? "text-xs" : "text-sm")}>{supportNeeds.level}</p>
            <p className={cn("mt-2 text-slate-600", compact ? "text-xs" : "text-sm")}>{supportNeeds.text}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className={cn("grid grid-cols-1 md:grid-cols-2", gridGap)}>
        <Card className={cardR}>
          <CardContent className={pad}>
            <div className="flex items-center gap-2">
              <AlertTriangle className={icon} />
              <h2 className={h2}>Missing evidence</h2>
            </div>
            <div className="mt-4 space-y-2">
              {missing.length ? (
                missing.map((m) => (
                  <div key={m} className={cn("rounded-xl border bg-white p-3", compact ? "text-xs" : "text-sm")}>
                    {m}
                  </div>
                ))
              ) : (
                <div className={cn("rounded-xl border bg-white p-3", compact ? "text-xs" : "text-sm")}>
                  Core ASD evidence domains detected. Review quality and cross-setting consistency.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={cardR}>
          <CardContent className={pad}>
            <div className="flex items-center gap-2">
              <ShieldCheck className={icon} />
              <h2 className={h2}>Safety / contradiction checks</h2>
            </div>
            <div className="mt-4 space-y-2">
              {contradictions.length ? (
                contradictions.map((c, idx) => (
                  <div key={idx} className={cn("rounded-xl border bg-amber-50 p-3 text-amber-950", compact ? "text-xs" : "text-sm")}>
                    {c}
                  </div>
                ))
              ) : (
                <div className={cn("rounded-xl border bg-white p-3", compact ? "text-xs" : "text-sm")}>
                  No major contradictions detected from current notes.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {workspaceView === "evidence" ? (
        <div className={cn("grid", threeCol, gridGap)}>
          <Card className={cn(cardR, !compact && "lg:col-span-3")}>
            <CardContent className={pad}>
              <h2 className={h2}>Evidence ledger</h2>
              <p className={cn("mt-1 text-slate-600", compact ? "text-xs" : "text-sm")}>
                Every generated statement should trace back to raw note evidence before it reaches the final report.
              </p>
              <div className={cn("mt-4 space-y-3 overflow-auto pr-2", ledgerMax)}>
                {evidenceLedger.length ? (
                  evidenceLedger.map((item: any) => (
                    <div key={item.id} className={cn("rounded-2xl border bg-white", compact ? "p-3" : "p-4")}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{item.id}</Badge>
                          <Badge>{item.dsmCode}</Badge>
                          <span className={cn("font-semibold", compact ? "text-xs" : "text-sm")}>{item.marker}</span>
                        </div>
                        <Badge
                          variant={
                            item.status === "use" ? "default" : item.status === "clarify" ? "secondary" : "outline"
                          }
                          className={compact ? "text-[10px]" : undefined}
                        >
                          {item.status} · {Math.round(item.confidence * 100)}%
                        </Badge>
                      </div>
                      <div className="mt-3 space-y-2">
                        {item.satelliteNote ? (
                          <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-950">
                            {item.satelliteNote}
                          </div>
                        ) : null}
                        {item.evidence.length ? (
                          item.evidence.map((quote: string, idx: number) => (
                            <div
                              key={idx}
                              className={cn(
                                "rounded-xl bg-slate-50 p-3 leading-6 text-slate-700",
                                compact ? "text-xs" : "text-sm"
                              )}
                            >
                              “{quote}”
                            </div>
                          ))
                        ) : (
                          <div className={cn("rounded-xl bg-slate-50 p-3 text-slate-500", compact ? "text-xs" : "text-sm")}>
                            No clean sentence-level quote isolated yet.
                          </div>
                        )}
                      </div>
                      <div className={cn("mt-3 rounded-xl bg-blue-50 p-3 text-blue-950", compact ? "text-xs" : "text-sm")}>
                        <span className="font-medium">Next clinical question: </span>
                        {item.clinicalQuestion}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={cn("rounded-xl border bg-white p-4 text-slate-500", compact ? "text-xs" : "text-sm")}>
                    No evidence captured yet.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {workspaceView === "evidence" ? (
        <Card className={cardR}>
          <CardContent className={pad}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className={h2}>DSM-5 Criteria Matrix</h2>
                <p className={cn("mt-1 text-slate-600", compact ? "text-xs" : "text-sm")}>
                  Live evidence mapping across diagnostic domains
                </p>
              </div>
              <Badge variant="outline">{severity.label}</Badge>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border">
              <table className={cn("w-full text-left", compact ? "text-xs" : "text-sm")}>
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-3">Code</th>
                    <th className="p-3">Criterion</th>
                    <th className="p-3">Evidence</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {dsmMatrix.map((row: any) => (
                    <tr key={row.code} className="border-t">
                      <td className="p-3 font-semibold">{row.code}</td>
                      <td className="p-3">
                        <div>{row.criterion}</div>
                        <div className="mt-1 text-xs text-slate-500">{row.threshold}</div>
                      </td>
                      <td className="p-3">
                        <div className="text-xs text-slate-600">{row.count} markers</div>
                        <div className="mt-1 text-xs text-slate-500">{row.labels?.slice(0, 2).join(", ")}</div>
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={
                            row.status === "Strong"
                              ? "default"
                              : row.status === "Partial"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {row.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs text-slate-500">{row.confidence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className={cn("grid", threeCol, gridGap)}>
        <Card className={cardR}>
          <CardContent className={pad}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className={h2}>DSM-5-TR level of support estimate</h2>
              <Badge variant="outline">Advisory</Badge>
            </div>
            <p className={cn("text-slate-600", compact ? "text-[11px]" : "text-xs")}>
              Separate Criterion A and B specifiers per DSM-5-TR. This is a draft heuristic from live markers only—not a
              diagnosis and not NDIS eligibility advice.
            </p>
            {levelOfSupport.determinable ? (
              <div className={cn("mt-4 space-y-3", compact ? "text-xs" : "text-sm")}>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Overall L{levelOfSupport.overallLevel}</Badge>
                  <Badge variant="outline">A: L{levelOfSupport.levelA}</Badge>
                  <Badge variant="outline">B: L{levelOfSupport.levelB}</Badge>
                </div>
                {workspaceView === "evidence" ? (
                  <>
                    <pre className="whitespace-pre-wrap rounded-xl border bg-slate-50 p-3 text-xs leading-relaxed text-slate-800">
                      {levelOfSupport.formattedSpecifier}
                    </pre>
                    {levelOfSupport.ndisAlignment ? (
                      <div className="rounded-xl border border-amber-100 bg-amber-50/80 p-3 text-xs text-amber-950">
                        <span className="font-medium">Functional capacity / planning signal: </span>
                        {levelOfSupport.ndisAlignment.eligibilitySignal}
                      </div>
                    ) : null}
                    {levelOfSupport.coherenceFlags?.length ? (
                      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800">
                        <span className="font-medium text-slate-700">Coherence checks</span>
                        {levelOfSupport.coherenceFlags.map((f: any, i: number) => (
                          <div key={i} className="text-slate-600">
                            {f.message}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className={cn("leading-relaxed text-slate-600", compact ? "text-[11px]" : "text-xs")}>
                    Narrative-only drafts are capped at Level 2 unless the notes explicitly describe Level 3 support
                    needs. Open Evidence view for the full specifier block, eligibility planning signal, and
                    standardised-assessment coherence checks.
                  </p>
                )}
              </div>
            ) : (
              <p className={cn("mt-4 text-slate-600", compact ? "text-xs" : "text-sm")}>
                {levelOfSupport.reason || "Complete Criterion A and B thresholds to estimate separate A/B support levels."}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className={cardR}>
          <CardContent className={pad}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className={h2}>Live clinician prompts</h2>
              <Badge variant="outline">Co-pilot</Badge>
            </div>
            <p className={cn("text-slate-600", compact ? "text-[11px]" : "text-xs")}>{clinicianPrompts.summary}</p>
            <div className={cn("mt-4 space-y-3 overflow-auto pr-1", scrollMax)}>
              {clinicianPrompts.prompts?.length ? (
                clinicianPrompts.prompts.slice(0, 8).map((p: any, idx: number) => (
                  <div key={idx} className={cn("rounded-xl border bg-white p-3", compact ? "text-xs" : "text-sm")}>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          p.priority === "Critical"
                            ? "default"
                            : p.priority === "High"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {p.priority}
                      </Badge>
                      <span className="text-xs font-medium text-slate-500">{p.criterion}</span>
                    </div>
                    <div className="font-medium text-slate-900">{p.category}</div>
                    <p className={cn("mt-2 leading-relaxed text-slate-700", compact ? "text-[11px]" : "text-xs")}>
                      {p.promptForClinician}
                    </p>
                  </div>
                ))
              ) : (
                <p className={cn("text-slate-500", compact ? "text-xs" : "text-sm")}>
                  No prompts yet—add note content to populate the matrix.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={cardR}>
          <CardContent className={pad}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className={h2}>NDIS functional capacity domains</h2>
              <Badge variant="outline">Draft mapping</Badge>
            </div>
            <p className={cn("text-slate-600", compact ? "text-[11px]" : "text-xs")}>{ndisDomains.summary}</p>
            <p className={cn("mt-2 text-slate-500", compact ? "text-[10px]" : "text-xs")}>
              Six-domain rollup from detected markers for report drafting. NDIS access is not inferred or guaranteed
              from this view.
            </p>
            <div className={cn("mt-4 space-y-2 overflow-auto pr-1", scrollMax)}>
              {ndisDomains.domains &&
                Object.entries(ndisDomains.domains).map(([key, d]: [string, any]) => (
                  <div
                    key={key}
                    className={cn("flex items-start justify-between gap-2 rounded-xl border bg-white p-3", compact ? "text-xs" : "text-sm")}
                  >
                    <div>
                      <div className="font-medium text-slate-900">{d.label}</div>
                      <div className={cn("mt-1 text-slate-600 line-clamp-3", compact ? "text-[11px]" : "text-xs")}>
                        {workspaceView === "clinician" && key === "selfCare"
                          ? buildClinicianSelfCareStatement(d)
                          : d.statement}
                      </div>
                    </div>
                    <Badge variant={d.markerCount > 0 ? "secondary" : "outline"}>{d.severity}</Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className={cardR}>
        <CardContent className={pad}>
          <div className={cn("mb-4 flex items-center gap-2", compact && "mb-2")}>
            <FileText className={icon} />
            <h2 className={h2}>Live draft report sections</h2>
          </div>
          <Tabs defaultValue="a1">
            <TabsList className={cn("grid w-full grid-cols-5 rounded-xl", compact && "h-8 text-[10px]")}>
              <TabsTrigger value="a1">A1</TabsTrigger>
              <TabsTrigger value="a2">A2</TabsTrigger>
              <TabsTrigger value="a3">A3</TabsTrigger>
              <TabsTrigger value="b">B Criteria</TabsTrigger>
              <TabsTrigger value="formulation">Formulation</TabsTrigger>
            </TabsList>
            <TabsContent
              value="a1"
              className={cn("mt-4 rounded-xl bg-white p-4 leading-7", compact ? "text-xs leading-relaxed" : "text-sm")}
            >
              {draft.A1}
            </TabsContent>
            <TabsContent
              value="a2"
              className={cn("mt-4 rounded-xl bg-white p-4 leading-7", compact ? "text-xs leading-relaxed" : "text-sm")}
            >
              {draft.A2}
            </TabsContent>
            <TabsContent
              value="a3"
              className={cn("mt-4 rounded-xl bg-white p-4 leading-7", compact ? "text-xs leading-relaxed" : "text-sm")}
            >
              {draft.A3}
            </TabsContent>
            <TabsContent
              value="b"
              className={cn(
                "mt-4 whitespace-pre-line rounded-xl bg-white p-4 leading-7",
                compact ? "text-xs leading-relaxed" : "text-sm"
              )}
            >
              {draft.B}
            </TabsContent>
            <TabsContent
              value="formulation"
              className={cn("mt-4 rounded-xl bg-white p-4 leading-7", compact ? "text-xs leading-relaxed" : "text-sm")}
            >
              {draft.formulation}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
