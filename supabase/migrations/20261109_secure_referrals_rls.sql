-- Texlex security lockdown — fixes Supabase Advisor:
--   RLS Disabled in Public: public.referrals
--   RLS Disabled in Public: public.report_states
--   Sensitive columns exposed: public.report_states
--
-- Safe to run: does NOT delete patient/referral rows.
-- Editor may still warn about DROP POLICY / UPDATE — those only replace
-- access rules and set clinic_id on null rows. Choose "Run anyway".

-- ---------------------------------------------------------------------------
-- Clinics (RLS on immediately after create)
-- ---------------------------------------------------------------------------
create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  timezone text not null default 'Australia/Perth',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.clinics enable row level security;

insert into public.clinics (slug, display_name)
values
  ('perth-paediatrics', 'Perth Paediatrics'),
  ('azure-mind', 'Azure Mind')
on conflict (slug) do nothing;

do $$ begin
  create policy clinics_select_member on public.clinics
    for select to authenticated
    using (id in (select public.texlex_user_clinic_ids()) or active = true);
exception
  when undefined_function then
    -- helper created below; policy recreated at end
    null;
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Clinic memberships (RLS on immediately)
-- ---------------------------------------------------------------------------
create table if not exists public.clinic_memberships (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'clinician',
  created_at timestamptz not null default now(),
  unique (clinic_id, user_id)
);

alter table public.clinic_memberships enable row level security;

create index if not exists clinic_memberships_user_idx
  on public.clinic_memberships (user_id);

insert into public.clinic_memberships (clinic_id, user_id, role)
select c.id, u.id, 'clinician'
from auth.users u
cross join public.clinics c
where c.slug in ('perth-paediatrics', 'azure-mind')
on conflict (clinic_id, user_id) do nothing;

do $$ begin
  create policy clinic_memberships_select_own on public.clinic_memberships
    for select to authenticated
    using (user_id = auth.uid());
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Helper: caller clinic ids
-- ---------------------------------------------------------------------------
create or replace function public.texlex_user_clinic_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select clinic_id
  from public.clinic_memberships
  where user_id = auth.uid();
$$;

revoke all on function public.texlex_user_clinic_ids() from public;
grant execute on function public.texlex_user_clinic_ids() to authenticated;

-- clinics policy (now that helper exists)
do $$ begin
  create policy clinics_select_member on public.clinics
    for select to authenticated
    using (id in (select public.texlex_user_clinic_ids()) or active = true);
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- referrals — Advisor critical
-- ---------------------------------------------------------------------------
alter table public.referrals
  add column if not exists clinic_id uuid references public.clinics (id) on delete set null;

alter table public.referrals enable row level security;

do $$ begin
  create policy referrals_select_member on public.referrals
    for select to authenticated
    using (
      clinic_id in (select public.texlex_user_clinic_ids())
      or (
        clinic_id is null
        and exists (select 1 from public.texlex_user_clinic_ids())
      )
    );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create policy referrals_insert_member on public.referrals
    for insert to authenticated
    with check (
      clinic_id in (select public.texlex_user_clinic_ids())
      or (
        clinic_id is null
        and exists (select 1 from public.texlex_user_clinic_ids())
      )
    );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create policy referrals_update_member on public.referrals
    for update to authenticated
    using (
      clinic_id in (select public.texlex_user_clinic_ids())
      or (
        clinic_id is null
        and exists (select 1 from public.texlex_user_clinic_ids())
      )
    )
    with check (
      clinic_id in (select public.texlex_user_clinic_ids())
      or (
        clinic_id is null
        and exists (select 1 from public.texlex_user_clinic_ids())
      )
    );
exception
  when duplicate_object then null;
end $$;

-- Backfill only: assign clinic when missing (does not delete rows)
update public.referrals r
set clinic_id = c.id
from public.clinics c
where r.clinic_id is null
  and c.slug = 'perth-paediatrics';

-- ---------------------------------------------------------------------------
-- report_states — Advisor critical
-- ---------------------------------------------------------------------------
alter table public.report_states enable row level security;

do $$ begin
  create policy report_states_select_auth on public.report_states
    for select to authenticated
    using (auth.uid() is not null);
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create policy report_states_insert_auth on public.report_states
    for insert to authenticated
    with check (auth.uid() is not null);
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create policy report_states_update_auth on public.report_states
    for update to authenticated
    using (auth.uid() is not null)
    with check (auth.uid() is not null);
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Optional intake tables (only if they already exist)
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.referral_mailboxes') is not null then
    execute 'alter table public.referral_mailboxes enable row level security';
    begin
      execute $p$
        create policy referral_mailboxes_select_member on public.referral_mailboxes
          for select to authenticated
          using (clinic_id in (select public.texlex_user_clinic_ids()))
      $p$;
    exception when duplicate_object then null;
    end;
  end if;

  if to_regclass('public.referral_intake_events') is not null then
    execute 'alter table public.referral_intake_events enable row level security';
    begin
      execute $p$
        create policy referral_intake_events_select_member on public.referral_intake_events
          for select to authenticated
          using (
            clinic_id in (select public.texlex_user_clinic_ids())
            or clinic_id is null
          )
      $p$;
    exception when duplicate_object then null;
    end;
  end if;

  if to_regclass('public.referral_documents') is not null then
    execute 'alter table public.referral_documents enable row level security';
    begin
      execute $p$
        create policy referral_documents_select_member on public.referral_documents
          for select to authenticated
          using (clinic_id in (select public.texlex_user_clinic_ids()))
      $p$;
    exception when duplicate_object then null;
    end;
  end if;

  if to_regclass('public.referral_audit_events') is not null then
    execute 'alter table public.referral_audit_events enable row level security';
    begin
      execute $p$
        create policy referral_audit_events_select_member on public.referral_audit_events
          for select to authenticated
          using (
            clinic_id in (select public.texlex_user_clinic_ids())
            or clinic_id is null
          )
      $p$;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
