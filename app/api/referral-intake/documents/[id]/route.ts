import { NextResponse } from "next/server";
import { referralDocumentSignedUrlTtlSeconds } from "@/lib/referral-intake/config";
import { createReferralDocumentSignedUrl } from "@/lib/referral-intake/document-store";
import { referralIntakeSupabase } from "@/lib/referral-intake/supabase-admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Authorised staff → short-lived signed URL for the original referral document.
 * Clinic membership is checked before the service role mints the URL.
 */
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ success: false, error: "Missing document id" }, { status: 400 });
  }

  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
  }

  let admin;
  try {
    admin = referralIntakeSupabase();
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Storage unavailable" },
      { status: 500 }
    );
  }

  const { data: doc, error: docError } = await admin
    .from("referral_documents")
    .select("id, clinic_id, filename, content_type, storage_driver, storage_path")
    .eq("id", id)
    .maybeSingle();

  if (docError) {
    return NextResponse.json({ success: false, error: docError.message }, { status: 500 });
  }
  if (!doc) {
    return NextResponse.json({ success: false, error: "Document not found" }, { status: 404 });
  }
  if (doc.storage_driver !== "supabase" || !doc.storage_path) {
    return NextResponse.json(
      {
        success: false,
        error: "Original is not in Supabase Storage. Re-process the referral after storage is live.",
      },
      { status: 409 }
    );
  }

  if (doc.clinic_id) {
    const { data: membership } = await userClient
      .from("clinic_memberships")
      .select("clinic_id")
      .eq("user_id", user.id)
      .eq("clinic_id", doc.clinic_id)
      .maybeSingle();
    if (!membership?.clinic_id) {
      return NextResponse.json({ success: false, error: "Forbidden for this clinic" }, { status: 403 });
    }
  }

  try {
    const expiresIn = referralDocumentSignedUrlTtlSeconds();
    const signed = await createReferralDocumentSignedUrl(String(doc.storage_path), expiresIn);
    const url = new URL(req.url);
    if (url.searchParams.get("redirect") === "1" || url.searchParams.get("download") === "1") {
      return NextResponse.redirect(signed.url, { status: 302 });
    }
    return NextResponse.json({
      success: true,
      url: signed.url,
      expiresIn: signed.expiresIn,
      filename: doc.filename,
      contentType: doc.content_type,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
