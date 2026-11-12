import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { draftNameMatches, type NamedDraftHit } from "@/lib/texlex-draft-name-search";
import type { TexlexEngineId } from "@/lib/texlex-report-state";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function isEngineId(value: string | null): value is TexlexEngineId {
  return value === "adhd" || value === "asd";
}

function clientNameFromState(state: unknown): string {
  if (!state || typeof state !== "object") return "";
  const details = (state as { patientDetails?: unknown }).patientDetails;
  if (!details || typeof details !== "object") return "";
  const name = (details as { clientName?: unknown }).clientName;
  return typeof name === "string" ? name : "";
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

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const engine = url.searchParams.get("engine");
    const q = url.searchParams.get("q") ?? "";
    if (!isEngineId(engine)) {
      return Response.json({ success: false, error: "engine must be adhd or asd" }, { status: 400 });
    }
    if (q.trim().length < 3) {
      return Response.json({ success: true, hits: [] as NamedDraftHit[] });
    }

    const { data, error } = await supabase
      .from("report_states")
      .select("patient_id, state, updated_at")
      .like("patient_id", `${engine}:%`)
      .limit(200);

    if (error) {
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    const hits: NamedDraftHit[] = [];
    for (const row of data ?? []) {
      const state =
        row.state && typeof row.state === "object" ? (row.state as Record<string, unknown>) : null;
      if (!state) continue;
      const tagged = typeof state.engine === "string" ? state.engine : null;
      if (tagged && tagged !== engine) continue;
      const clientName = clientNameFromState(state);
      if (!draftNameMatches(clientName, q)) continue;
      const rawKey = typeof row.patient_id === "string" ? row.patient_id : "";
      const patientId = patientIdFromRowKey(engine, rawKey);
      hits.push({
        id: `cloud:${rawKey}`,
        source: "cloud",
        engine,
        clientName,
        lastSaved:
          (typeof state.lastSaved === "string" && state.lastSaved) ||
          (typeof row.updated_at === "string" ? row.updated_at : null),
        patientId,
        storageKey: rawKey,
        state,
      });
    }

    hits.sort((a, b) => (b.lastSaved ?? "").localeCompare(a.lastSaved ?? ""));
    return Response.json({ success: true, hits });
  } catch (e) {
    return Response.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
