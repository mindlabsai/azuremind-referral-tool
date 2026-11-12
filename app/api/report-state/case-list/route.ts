import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  auditorCaseRowFromDraftState,
  type AuditorCaseRow,
} from "@/lib/texlex-auditor-case-list";
import type { TexlexEngineId } from "@/lib/texlex-report-state";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function isEngineId(value: string | null): value is TexlexEngineId {
  return value === "adhd" || value === "asd";
}

function patientIdFromRowKey(engine: TexlexEngineId, patientId: string): string | null {
  const prefix = `${engine}:`;
  if (patientId.startsWith(prefix)) {
    const rest = patientId.slice(prefix.length);
    return rest || null;
  }
  if (!patientId.includes(":")) return patientId;
  return null;
}

/** List cloud drafts as auditor case-list rows (no name filter). */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const engine = url.searchParams.get("engine");
    if (!isEngineId(engine)) {
      return Response.json({ success: false, error: "engine must be adhd or asd" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("report_states")
      .select("patient_id, state, updated_at")
      .like("patient_id", `${engine}:%`)
      .limit(500);

    if (error) {
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    const rows: AuditorCaseRow[] = [];
    for (const row of data ?? []) {
      const state =
        row.state && typeof row.state === "object" ? (row.state as Record<string, unknown>) : null;
      if (!state) continue;
      const tagged = typeof state.engine === "string" ? state.engine : null;
      if (tagged && tagged !== engine) continue;
      const rawKey = typeof row.patient_id === "string" ? row.patient_id : "";
      const patientId = patientIdFromRowKey(engine, rawKey);
      const caseRow = auditorCaseRowFromDraftState({
        state,
        source: "cloud",
        storageKey: rawKey,
        patientId,
        lastSavedFallback: typeof row.updated_at === "string" ? row.updated_at : null,
      });
      if (caseRow) rows.push(caseRow);
    }

    rows.sort((a, b) =>
      (b.dateReportCompleted || b.lastSaved || "").localeCompare(
        a.dateReportCompleted || a.lastSaved || ""
      )
    );

    return Response.json({ success: true, rows });
  } catch (e) {
    return Response.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
