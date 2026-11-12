import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { referralDocumentsBucket } from "./config";
import { referralIntakeSupabase } from "./supabase-admin";

export type StoredDocument = {
  sha256: string;
  storageDriver: "supabase";
  storagePath: string;
  byteSize: number;
  contentType: string;
};

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/octet-stream",
]);

let bucketReady: Promise<void> | null = null;

export function sha256Buffer(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function buildReferralDocumentPath(args: {
  clinicSlug: string;
  sha256: string;
  filename: string;
}): string {
  const safeName = args.filename.replace(/[^\w.\-]+/g, "_").slice(0, 180) || "referral.bin";
  return `${args.clinicSlug}/${args.sha256.slice(0, 2)}/${args.sha256}-${safeName}`;
}

function normalizeContentType(filename: string, contentType?: string): string {
  const raw = (contentType || "").trim().toLowerCase();
  if (raw && ALLOWED_MIME.has(raw)) return raw === "image/jpg" ? "image/jpeg" : raw;
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".doc")) return "application/msword";
  return "application/octet-stream";
}

async function ensureReferralDocumentsBucket(supabase: SupabaseClient): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const bucket = referralDocumentsBucket();
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      if (listError) {
        throw new Error(`Could not list storage buckets: ${listError.message}`);
      }
      const exists = (buckets ?? []).some((b) => b.id === bucket || b.name === bucket);
      if (exists) return;

      const { error: createError } = await supabase.storage.createBucket(bucket, {
        public: false,
        fileSizeLimit: 52428800,
        allowedMimeTypes: [
          "application/pdf",
          "image/jpeg",
          "image/png",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/msword",
          "application/octet-stream",
        ],
      });
      if (createError && !/already exists|duplicate/i.test(createError.message)) {
        throw new Error(
          `Create storage bucket "${bucket}" failed: ${createError.message}. ` +
            "Apply supabase/migrations/20261110_referral_documents_storage.sql in Supabase."
        );
      }
    })().catch((error) => {
      bucketReady = null;
      throw error;
    });
  }
  await bucketReady;
}

/**
 * Persist original referral bytes in private Supabase Storage.
 * Path is content-addressed so retries upsert the same object (no duplicates).
 */
export async function storeReferralDocument(args: {
  clinicSlug: string;
  filename: string;
  bytes: Buffer;
  contentType?: string;
}): Promise<StoredDocument> {
  const supabase = referralIntakeSupabase();
  await ensureReferralDocumentsBucket(supabase);

  const sha256 = sha256Buffer(args.bytes);
  const contentType = normalizeContentType(args.filename, args.contentType);
  const storagePath = buildReferralDocumentPath({
    clinicSlug: args.clinicSlug,
    sha256,
    filename: args.filename,
  });
  const bucket = referralDocumentsBucket();

  const { error } = await supabase.storage.from(bucket).upload(storagePath, args.bytes, {
    contentType,
    upsert: true,
    cacheControl: "private, max-age=31536000",
  });

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  return {
    sha256,
    storageDriver: "supabase",
    storagePath,
    byteSize: args.bytes.length,
    contentType,
  };
}

export async function readStoredReferralDocument(storagePath: string): Promise<Buffer> {
  if (storagePath.startsWith("memory://") || storagePath.startsWith("local://")) {
    throw new Error(
      "Document is not in Supabase Storage. Re-run recover after deploying permanent storage."
    );
  }
  const supabase = referralIntakeSupabase();
  const bucket = referralDocumentsBucket();
  const { data, error } = await supabase.storage.from(bucket).download(storagePath);
  if (error || !data) {
    throw new Error(error?.message || "Could not download referral document from storage.");
  }
  const ab = await data.arrayBuffer();
  return Buffer.from(ab);
}

/** Short-lived signed URL for authorised staff (server-side only). */
export async function createReferralDocumentSignedUrl(
  storagePath: string,
  expiresInSeconds = 300
): Promise<{ url: string; expiresIn: number }> {
  const supabase = referralIntakeSupabase();
  const bucket = referralDocumentsBucket();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Could not create signed URL for referral document.");
  }
  return { url: data.signedUrl, expiresIn: expiresInSeconds };
}

export async function referralDocumentsBucketReady(): Promise<boolean> {
  try {
    const supabase = referralIntakeSupabase();
    await ensureReferralDocumentsBucket(supabase);
    return true;
  } catch {
    return false;
  }
}
