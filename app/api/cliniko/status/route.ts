import { NextResponse } from "next/server";
import { clinikoGetCustomFieldDefinitions, isClinikoConfigured } from "@/lib/cliniko";

export const runtime = "nodejs";

export async function GET() {
  if (!isClinikoConfigured()) {
    console.warn("Cliniko credentials not configured.");
    return NextResponse.json({ configured: false, connected: false });
  }

  try {
    const definitions = await clinikoGetCustomFieldDefinitions();
    return NextResponse.json({
      configured: true,
      connected: true,
      customFieldCount: definitions.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cliniko connection failed.";
    return NextResponse.json({
      configured: true,
      connected: false,
      error: message,
    });
  }
}
