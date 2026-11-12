-- Texlex Phase 3 — patient identity conflicts + document resolution for human review

alter table public.referral_documents
  add column if not exists identity_conflict boolean,
  add column if not exists conflict_resolution text,
  add column if not exists extracted_child_first text,
  add column if not exists extracted_child_last text,
  add column if not exists extracted_child_dob text;

do $$
begin
  alter table public.referral_documents
    drop constraint if exists referral_documents_extraction_role_check;
  alter table public.referral_documents
    add constraint referral_documents_extraction_role_check
    check (
      extraction_role is null
      or extraction_role in ('primary', 'supporting', 'none', 'conflict')
    );
exception
  when undefined_table then null;
end $$;

do $$
begin
  alter table public.referral_documents
    drop constraint if exists referral_documents_conflict_resolution_check;
  alter table public.referral_documents
    add constraint referral_documents_conflict_resolution_check
    check (
      conflict_resolution is null
      or conflict_resolution in ('excluded', 'accepted_same_patient')
    );
exception
  when undefined_table then null;
end $$;

alter table public.referrals
  add column if not exists patient_identity_conflict boolean default false;

comment on column public.referral_documents.identity_conflict is
  'True when this attachment’s child identity conflicts with the primary referral document.';
comment on column public.referral_documents.conflict_resolution is
  'Staff resolution: excluded (keep file, ignore for fields) or accepted_same_patient.';
comment on column public.referrals.patient_identity_conflict is
  'True when attachments contain conflicting child identities; blocks approve until resolved.';

-- After applying this migration in production, run the historical backfill once:
--   GET /api/cron/referral-intake-backfill-identity
--   Authorization: Bearer $CRON_SECRET
-- That re-reads multi-attachment referrals (e.g. Marcie PNG + Zoe DOCX) and sets
-- identity_conflict / extraction_role=conflict. It does not delete documents.
