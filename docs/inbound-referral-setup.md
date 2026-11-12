# Inbound GP referral emails — setup order

## Already done in code
- Gmail OAuth / Pub/Sub / watch / recovery routes (gated)
- Intake pipeline + Inbox UI at `/referral-inbox`
- RLS + clinic memberships

## Step 1 — Supabase tables (SQL Editor)
Run in order:
1. [`supabase/migrations/20261106_referral_intake_phase1.sql`](../supabase/migrations/20261106_referral_intake_phase1.sql)  
2. [`supabase/migrations/20261110_referral_documents_storage.sql`](../supabase/migrations/20261110_referral_documents_storage.sql) — private `referral-documents` bucket  
3. [`supabase/migrations/20261110_referral_documents_phase2.sql`](../supabase/migrations/20261110_referral_documents_phase2.sql) — multi-attachment labels  

(clinics may already exist from the security migration — that is fine).

Supported inbound attachments: **PDF** (text + scanned vision), **JPEG/PNG** (Claude vision), **DOCX** (Word text). All attachments on one email are stored; referral-bearing files are labelled `primary` / `supporting` / `none`.

## Step 2 — Local env (safe mode)
In `.env.local`:

```
TEXLEX_REFERRAL_INTAKE_ENABLED=1
TEXLEX_REFERRAL_INTAKE_LIVE=0
TEXLEX_REFERRAL_LIVE_COMMS=0
TEXLEX_DEFAULT_CLINIC_SLUG=perth-paediatrics
TEXLEX_TOKEN_ENCRYPTION_KEY=<long random>
SUPABASE_SERVICE_ROLE_KEY=<from Supabase Project Settings → API → service_role>
```

Restart: `npm run fresh`  
Inbox should show **Intake enabled · Mailbox safe · Comms off** (no red “disabled” banner).

## Step 3 — Google Workspace (before live)
1. Google Cloud project linked to the clinic Workspace.
2. Enable **Gmail API** + **Cloud Pub/Sub API**.
3. OAuth consent (Internal) + Web client:
   - Redirect: `http://localhost:3001/api/referral-intake/oauth/callback`
   - Later add production callback URL on Vercel.
4. Scope: `https://www.googleapis.com/auth/gmail.readonly` only.
5. Pub/Sub topic e.g. `texlex-gmail-referrals` + push subscription →  
   `https://YOUR_VERCEL_HOST/api/referral-intake/pubsub`
6. Grant publish to `gmail-api-push@system.gserviceaccount.com`.
7. Put into `.env.local`:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_PUBSUB_TOPIC=projects/PROJECT_ID/topics/texlex-gmail-referrals`
8. Sign in to Texlex, open  
   `/api/referral-intake/oauth/start?clinicSlug=perth-paediatrics`  
   while logged into the **clinic referral mailbox** Google account.
9. Only then set `TEXLEX_REFERRAL_INTAKE_LIVE=1` and renew watch via  
   `POST /api/referral-intake/watch/renew` with `Authorization: Bearer $CRON_SECRET`.

## Safety
- Keep `TEXLEX_REFERRAL_LIVE_COMMS=0` — intake never emails/SMS parents.
- No automatic redistribution or clinical decisions.
