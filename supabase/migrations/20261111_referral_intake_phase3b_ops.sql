-- Phase 3B ops: immediate auto-ready kill switch + QA sampling for auto-ready decisions.
-- Apply in Supabase SQL editor (service role / dashboard).

-- Global operational flags (read on every intake decision — no redeploy required)
create table if not exists public.referral_ops_flags (
  key text primary key,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by text not null default 'system',
  note text
);

insert into public.referral_ops_flags (key, enabled, note)
values (
  'auto_ready_enabled',
  true,
  'When false, every new referral is forced to awaiting_review (immediate; no redeploy).'
)
on conflict (key) do nothing;

alter table public.referral_ops_flags enable row level security;

-- Service role bypasses RLS; no anon/authenticated policies on purpose.

-- Auto-ready QA fields on referrals
alter table public.referrals
  add column if not exists auto_ready_at timestamptz,
  add column if not exists auto_ready_qa_status text,
  add column if not exists auto_ready_qa_notes text,
  add column if not exists auto_ready_qa_at timestamptz,
  add column if not exists auto_ready_qa_by text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'referrals_auto_ready_qa_status_check'
  ) then
    alter table public.referrals
      add constraint referrals_auto_ready_qa_status_check
      check (
        auto_ready_qa_status is null
        or auto_ready_qa_status in ('pending', 'confirmed', 'incorrect')
      );
  end if;
end $$;

create index if not exists referrals_auto_ready_qa_idx
  on public.referrals (auto_ready_qa_status, auto_ready_at desc nulls last)
  where auto_ready_at is not null;
