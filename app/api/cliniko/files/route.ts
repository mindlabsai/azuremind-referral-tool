import {
  clinikoUploadPatientAttachment,
  clinikoGetLatestStateAttachment,
} from "@/lib/cliniko";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      patientId: string;
      filename: string;
      content: string;
      contentType: string;
      encoding?: "base64" | "utf8";
      description?: string;
    };
    if (!body.patientId || !body.filename || body.content == null) {
      return Response.json({ success: false, error: "Missing fields" }, { status: 400 });
    }
    const data =
      body.encoding === "base64" ? Buffer.from(body.content, "base64") : body.content;
    const result = await clinikoUploadPatientAttachment(
      body.patientId,
      body.filename,
      data,
      body.contentType,
      body.description ?? ""
    );
    return Response.json({ success: true, id: result.id });
  } catch (e) {
    return Response.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const patientId = new URL(req.url).searchParams.get("patientId");
    if (!patientId) {
      return Response.json({ success: false, error: "Missing patientId" }, { status: 400 });
    }
    const latest = await clinikoGetLatestStateAttachment(patientId);
    return Response.json({ success: true, latest });
  } catch (e) {
    return Response.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
