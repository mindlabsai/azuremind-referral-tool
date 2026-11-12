import { NextResponse } from "next/server";
import { getIntakeReadiness } from "@/lib/referral-intake/readiness";

export const runtime = "nodejs";

/** Production readiness + feature flags for inbound referral intake. */
export async function GET() {
  const readiness = await getIntakeReadiness();
  return NextResponse.json({ success: true, ...readiness });
}
