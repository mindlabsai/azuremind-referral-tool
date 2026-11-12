import { halaxyCreatePatientTask } from "@/lib/halaxy";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { patientId?: string; title?: string; detail?: string };
    if (!body.patientId || !body.title?.trim()) {
      return Response.json({ success: false, error: "Missing fields" }, { status: 400 });
    }
    const task = await halaxyCreatePatientTask({
      patientId: body.patientId,
      title: body.title.trim(),
      detail: body.detail?.trim() || body.title.trim(),
    });
    return Response.json({
      success: true,
      taskCreated: task.created,
      taskError: task.error ?? null,
    });
  } catch (error) {
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
