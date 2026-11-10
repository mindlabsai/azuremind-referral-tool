# Inbound GP email — production by tomorrow

Texlex side is ready. You only need Google Cloud + Vercel env + one OAuth click.

## A. Supabase (5 min)
1. SQL Editor → run `supabase/migrations/20261106_referral_intake_phase1.sql`
2. Project Settings → API → copy **service_role** → Vercel + `.env.local` as `SUPABASE_SERVICE_ROLE_KEY`

## B. Google Cloud (20 min)
1. https://console.cloud.google.com → project for Azure Mind / Perth Paediatrics
2. Enable APIs: **Gmail API**, **Cloud Pub/Sub API**
3. **APIs & Services → OAuth consent screen** → Internal (Workspace)
4. **Credentials → Create OAuth client ID → Web application**
   - Authorized redirect URIs (both):
     - `http://localhost:3001/api/referral-intake/oauth/callback`
     - `https://YOUR_VERCEL_DOMAIN/api/referral-intake/oauth/callback`
5. Copy Client ID + Client Secret
6. **Pub/Sub → Create topic** `texlex-gmail-referrals`
7. Topic permissions → add principal  
   `gmail-api-push@system.gserviceaccount.com` → role **Pub/Sub Publisher**
8. **Create push subscription** on that topic:
   - Endpoint: `https://YOUR_VERCEL_DOMAIN/api/referral-intake/pubsub`
   - Ack deadline 60–120s

## C. Vercel env
```
TEXLEX_REFERRAL_INTAKE_ENABLED=1
TEXLEX_REFERRAL_INTAKE_LIVE=0
TEXLEX_REFERRAL_LIVE_COMMS=0
TEXLEX_DEFAULT_CLINIC_SLUG=perth-paediatrics
TEXLEX_TOKEN_ENCRYPTION_KEY=<same long random as local>
APP_URL=https://YOUR_VERCEL_DOMAIN
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=https://YOUR_VERCEL_DOMAIN/api/referral-intake/oauth/callback
GOOGLE_PUBSUB_TOPIC=projects/YOUR_PROJECT_ID/topics/texlex-gmail-referrals
SUPABASE_SERVICE_ROLE_KEY=...
CRON_SECRET=<already have>
```
Redeploy. Crons already registered: watch renew daily 02:00 UTC, recover every 6h.

## D. Connect mailbox (2 min)
1. Sign in to Texlex as staff
2. Chrome profile must be the **clinic referral Gmail** (Workspace mailbox)
3. Inbox → **Connect Gmail mailbox** → Allow
4. Confirm Inbox lists the mailbox + “token saved”
5. Set `TEXLEX_REFERRAL_INTAKE_LIVE=1` on Vercel → redeploy
6. Hit once (with Bearer CRON_SECRET):  
   `GET /api/cron/referral-intake-watch`
7. Email a synthetic PDF referral to that mailbox → appears in Inbox

## E. Do not flip
- `TEXLEX_REFERRAL_LIVE_COMMS` stays `0` (no parent SMS/email from intake)
