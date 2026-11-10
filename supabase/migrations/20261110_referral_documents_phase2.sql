-- Texlex Phase 2 — multi-attachment labelling (PDF / JPEG / PNG / DOCX)
-- All originals stay in referral-documents storage; these columns mark which
-- attachments carried referral patient/parent/GP information.

alter table public.referral_documents
  add column if not exists contains_referral_info boolean,
  add column if not exists extraction_role text;

do $$
begin
  alter table public.referral_documents
    drop constraint if exists referral_documents_extraction_role_check;
  alter table public.referral_documents
    add constraint referral_documents_extraction_role_check
    check (
      extraction_role is null
      or extraction_role in ('primary', 'supporting', 'none')
    );
exception
  when undefined_table then null;
end $$;

comment on column public.referral_documents.contains_referral_info is
  'True when extraction found patient/parent/GP referral signal in this file.';
comment on column public.referral_documents.extraction_role is
  'primary = fields used for the referral row; supporting = merged extras; none = stored only.';
