import { NextResponse } from "next/server";
import { halaxyDownloadPatientFile, isHalaxyConfigured } from "@/lib/halaxy";
import { COLLATERAL_MAX_FILE_BYTES } from "@/lib/collateral/collateral-docs-client";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, context: RouteContext) {
  if (!isHalaxyConfigured()) {
    return NextResponse.json({ error: "Halaxy credentials not configured." }, { status: 503 });
  }
  const { id } = await context.params;
  const attachmentId = decodeURIComponent(id ?? "").trim();
  if (!attachmentId) return NextResponse.json({ error: "Missing attachment id" }, { status: 400 });
  try {
    const file = await halaxyDownloadPatientFile(attachmentId);
    if (file.buffer.length > COLLATERAL_MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Attachment exceeds the 25 MB collateral limit." }, { status: 413 });
    }
    return NextResponse.json({
      id: attachmentId,
      filename: file.filename,
      contentType: file.contentType,
      size: file.buffer.length,
      contentBase64: file.buffer.toString("base64"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not download the Halaxy file.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
