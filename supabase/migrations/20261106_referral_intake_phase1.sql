-- Texlex Phase 1 — automated referral intake (multi-clinic ready)
-- Apply manually in Supabase SQL editor. Does not alter existing send/follow-up behaviour
-- for rows that leave new columns null.

-- Clinics (Perth Paediatrics first; Azure Mind remains the operating practice)
create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  timezone text not null default 'Australia/Perth',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.clinics (slug, display_name)
values
  ('perth-paediatrics', 'Perth Paediatrics'),
  ('azure-mind', 'Azure Mind')
on conflict (slug) do nothing;

-- Mailboxes watched for inbound GP referrals
create table if not exists public.referral_mailboxes (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  email_address text not null unique,
  google_user_id text,
  watch_history_id text,
  watch_expiration timestamptz,
  last_history_id text,
  last_polled_at timestamptz,
  oauth_refresh_token_encrypted text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Idempotent Gmail / intake processing ledger
create table if not exists public.referral_intake_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics (id) on delete set null,
  mailbox_id uuid references public.referral_mailboxes (id) on delete set null,
  provider text not null default 'gmail',
  provider_message_id text not null,
  provider_thread_id text,
  history_id text,
  dedupe_key text not null unique,
  processing_status text not null default 'received'
    check (processing_status in (
      'received', 'processing', 'extracted', 'needs_review', 'ready', 'failed', 'duplicate'
    )),
  error_message text,
  raw_headers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists referral_intake_events_status_idx
  on public.referral_intake_events (processing_status, created_at desc);

-- Original documents (bytes in Supabase Storage bucket referral-documents; DB holds references)
create table if not exists public.referral_documents (
  id uuid primary key default gen_random_uuid(),
  intake_event_id uuid references public.referral_intake_events (id) on delete cascade,
  referral_id uuid,
  clinic_id uuid references public.clinics (id) on delete set null,
  filename text not null,
  content_type text not null default 'application/pdf',
  byte_size integer not null default 0,
  sha256 text not null,
  storage_driver text not null default 'local',
  storage_path text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists referral_documents_sha_clinic_idx
  on public.referral_documents (clinic_id, sha256);

-- Audit trail
create table if not exists public.referral_audit_events (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid,
  intake_event_id uuid,
  clinic_id uuid,
  actor text not null default 'system',
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists referral_audit_events_referral_idx
  on public.referral_audit_events (referral_id, created_at desc);

-- Extend existing referrals table (nullable = backward compatible)
alter table public.referrals
  add column if not exists clinic_id uuid references public.clinics (id) on delete set null,
  add column if not exists intake_event_id uuid references public.referral_intake_events (id) on delete set null,
  add column if not exists referral_source text,
  add column if not exists received_at timestamptz,
  add column if not exists first_contact_at timestamptz,
  add column if not exists referring_practitioner text,
  add column if not exists referring_practitioner_type text,
  add column if not exists referring_practitioner_email text,
  add column if not exists extraction_status text,
  add column if not exists extraction_confidence text,
  add column if not exists extraction_warnings jsonb default '[]'::jsonb,
  add column if not exists contact_status text,
  add column if not exists booking_status text,
  add column if not exists dashboard_status text,
  add column if not exists needs_human_review boolean default false,
  add column if not exists allocated_clinician_id text,
  add column if not exists allocated_clinician_role text,
  add column if not exists closed_at timestamptz,
  add column if not exists closed_reason text,
  add column if not exists administrator_id text,
  add column if not exists duplicate_of_referral_id uuid,
  add column if not exists original_document_id uuid;

create index if not exists referrals_dashboard_status_idx
  on public.referrals (dashboard_status, received_at desc nulls last, created_at desc);

create index if not exists referrals_clinic_received_idx
  on public.referrals (clinic_id, received_at desc nulls last);

-- Clinic-scoped access (apply after confirming auth.uid() clinic membership model).
-- Phase 1 uses service-role writes from the intake pipeline; tighten before multi-tenant go-live.
-- alter table public.referrals enable row level security;
-- create policy referrals_clinic_select on public.referrals
--   for select using (
--     clinic_id in (
--       select clinic_id from public.clinic_memberships where user_id = auth.uid()
--     )
--   );

-- Future: clinic_memberships + clinician allocation tables for multi-practice routing
-- create table if not exists public.clinic_memberships (
--   id uuid primary key default gen_random_uuid(),
--   clinic_id uuid not null references public.clinics (id) on delete cascade,
--   user_id uuid not null,
--   role text not null default 'clinician',
--   unique (clinic_id, user_id)
-- );
