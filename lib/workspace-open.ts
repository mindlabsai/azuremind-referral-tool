import type { PracticeSource } from "@/lib/practice-source";

export type WorkspaceOpenRequest = {
  patientId: string;
  source: PracticeSource;
  appointmentStartsAt: string | null;
  importFiles: boolean;
};

export function readWorkspaceOpen(search: string): WorkspaceOpenRequest | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const patientId = params.get("patientId")?.trim() ?? "";
  const source = params.get("source");
  if (!patientId || (source !== "cliniko" && source !== "halaxy")) return null;
  const at = params.get("at")?.trim() || null;
  return {
    patientId,
    source,
    appointmentStartsAt: at && Number.isFinite(Date.parse(at)) ? at : null,
    importFiles: source === "cliniko" && params.get("files") === "1",
  };
}

export function workspaceReportPath(
  engine: "adhd" | "asd",
  args: {
    patientId: string;
    source: PracticeSource;
    appointmentStartsAt?: string | null;
    importFiles?: boolean;
  }
): string {
  const params = new URLSearchParams({
    patientId: args.patientId,
    source: args.source,
  });
  if (args.appointmentStartsAt) params.set("at", args.appointmentStartsAt);
  if (args.importFiles && args.source === "cliniko") params.set("files", "1");
  return `/${engine}-engine/report?${params.toString()}`;
}
