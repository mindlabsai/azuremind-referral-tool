-- Texlex Phase 1 — permanent referral document storage (Supabase Storage)
-- Private bucket. Staff open originals via short-lived signed URLs issued by the app
-- after clinic membership checks. Service role uploads from the intake pipeline.
-- Do not add anon/authenticated storage.objects policies for this bucket.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'referral-documents',
  'referral-documents',
  false,
  52428800,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/jpg',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/octet-stream'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
