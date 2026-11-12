# Supabase security lockdown (Advisor fixes)

Fixes the three Production Advisor issues:

1. RLS Disabled in Public — `public.referrals`
2. RLS Disabled in Public — `public.report_states`
3. Sensitive columns exposed — `public.report_states`

## What you do in Supabase (now)

1. Open **SQL Editor** on project **Azure Mind Admin** (`main` / PRODUCTION).
2. Paste and run the full file:
   [`supabase/migrations/20261109_secure_referrals_rls.sql`](../supabase/migrations/20261109_secure_referrals_rls.sql)
3. Refresh **Advisor** — the three critical RLS issues should clear.
4. **Auth → Providers**: keep email login; **disable public sign-ups** (invite users only).
5. Confirm staff appear under **Auth → Users**. The migration auto-adds each existing user to Perth Paediatrics + Azure Mind memberships.
6. Optional after lockdown: **Project Settings → API → reset anon key**, then update `.env.local` and Vercel `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## What the app code does

- Root `middleware.ts` requires login for app + PHI APIs.
- Referrals / report-state APIs use the signed-in session (RLS applies).
- Cron / unsubscribe / intake keep **service role** on the server only.
- Unsubscribe links are HMAC-signed (`CRON_SECRET` or `UNSUBSCRIBE_SECRET`).

## Quick verify

| Check | Expected |
|-------|----------|
| Logged out → `/` | Redirect to `/login` |
| Table Editor → referrals as anon API | No rows / denied |
| Signed in clinician → referral desk | Works |
| Advisor | No “RLS Disabled in Public” on those tables |

## If a new staff member cannot see data

Insert a membership (SQL Editor):

```sql
insert into public.clinic_memberships (clinic_id, user_id, role)
select c.id, u.id, 'clinician'
from auth.users u
join public.clinics c on c.slug = 'perth-paediatrics'
where u.email = 'them@example.com'
on conflict do nothing;
```
