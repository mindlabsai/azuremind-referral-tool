# Texlex Referral Intake — Phase 1

Automated GP email → PDF extract → referral record → inbox dashboard.

## Safety (enforced in code)

- `TEXLEX_REFERRAL_INTAKE_LIVE` defaults off — Pub/Sub acknowledges without processing.
- Intake **never** sends parent email/SMS (even if `TEXLEX_REFERRAL_LIVE_COMMS=1`).
- No automatic clinician redistribution or clinical decisions.
- Uncertain extraction → `awaiting_review` + `needs_human_review`.

## Apply schema

Run `supabase/migrations/20261106_referral_intake_phase1.sql` in the Supabase SQL editor.

## Local flags

See `env.example.referral-intake`. Minimum for dashboard/synthetic:

```
TEXLEX_REFERRAL_INTAKE_ENABLED=1
TEXLEX_REFERRAL_INTAKE_LIVE=0
TEXLEX_REFERRAL_LIVE_COMMS=0
```

## Routes

| Path | Purpose |
|------|---------|
| `/referral-inbox` | Dashboard |
| `/api/referral-intake/status` | Feature flags |
| `/api/referral-intake/inbox` | List by clinic/status |
| `/api/referral-intake/review` | Human status transitions |
| `/api/referral-intake/process-synthetic` | Synthetic create + dedupe check |
| `/api/referral-intake/oauth/start` | Gmail OAuth start (scaffolded) |
| `/api/referral-intake/oauth/callback` | OAuth callback |
| `/api/referral-intake/pubsub` | Pub/Sub push (gated) |
| `/api/referral-intake/watch/renew` | Watch renewal cron (gated) |
| `/api/referral-intake/recover` | Missed-notification scan (gated) |

## Tests

```bash
npm run test:referral-intake
# with server + migration + TEXLEX_REFERRAL_INTAKE_ENABLED=1:
SYNTHETIC_VIA_HTTP=1 npm run test:referral-intake-synthetic
```

## Google Workspace (blocked until credentials)

1. Google Cloud project with Gmail API + Pub/Sub API enabled.
2. OAuth client (Web) with redirect `…/api/referral-intake/oauth/callback`.
3. Scope: `https://www.googleapis.com/auth/gmail.readonly` only.
4. Pub/Sub topic + push subscription → `/api/referral-intake/pubsub`.
5. Grant `gmail-api-push@system.gserviceaccount.com` publish on the topic.
6. Workspace admin consent for the clinic mailbox user.
7. Set `TEXLEX_TOKEN_ENCRYPTION_KEY`, connect via OAuth start, then set `TEXLEX_REFERRAL_INTAKE_LIVE=1` only after dry-run review.
