import { NextResponse } from "next/server";
import {
  clinikoDownloadPatientAttachment,
  isClinikoConfigured,
} from "@/lib/cliniko";
import { COLLATERAL_MAX_FILE_BYTES } from "@/lib/collateral/collateral-docs-client";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, context: RouteContext) {
  if (!isClinikoConfigured()) {
    return NextResponse.json({ error: "Cliniko credentials not configured." }, { status: 503 });
  }

  const { id } = await context.params;
  const attachmentId = id?.trim();
  if (!attachmentId) {
    return NextResponse.json({ error: "Missing attachment id" }, { status: 400 });
  }

  try {
    const file = await clinikoDownloadPatientAttachment(attachmentId);
    if (file.size > COLLATERAL_MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "Attachment exceeds the 25 MB collateral limit." },
        { status: 413 }
      );
    }
    return NextResponse.json({
      id: file.id,
      filename: file.filename,
      contentType: file.contentType,
      size: file.size,
      contentBase64: file.buffer.toString("base64"),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not download Cliniko attachment.";
    const status = message.includes("not found") ? 404 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
