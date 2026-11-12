import { halaxyUploadPatientFile } from "@/lib/halaxy";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      patientId: string;
      filename: string;
      content: string;
      contentType: string;
      encoding?: "base64" | "utf8";
      description?: string;
      createTask?: boolean;
      taskTitle?: string;
    };
    if (!body.patientId || !body.filename || body.content == null) {
      return Response.json({ success: false, error: "Missing fields" }, { status: 400 });
    }
    const data = body.encoding === "base64" ? Buffer.from(body.content, "base64") : body.content;
    const result = await halaxyUploadPatientFile({
      patientId: body.patientId,
      filename: body.filename,
      content: data,
      contentType: body.contentType,
      description: body.description ?? "",
      createTask: body.createTask === true,
      taskTitle: body.taskTitle,
    });
    return Response.json({
      success: true,
      id: result.id,
      taskCreated: result.taskCreated,
      taskError: result.taskError ?? null,
    });
  } catch (error) {
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
