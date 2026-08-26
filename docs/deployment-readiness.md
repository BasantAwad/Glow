# Glow — Deployment Readiness Audit

**Date:** 2026-08-26
**Purpose:** Honest assessment of what is done vs. what blocks a flawless
public launch. Written for a first-time deployer.

---

## Verdict

**The product works end-to-end and can be deployed privately today.**
For a **public marketing launch in Egypt**, complete the blockers below —
roughly 1–2 weeks of focused work plus Paymob's merchant approval.

---

## What is DONE (working, verified)

| Area | Status |
|---|---|
| Text conversations (LLM via OpenRouter free tier) | ✅ Live-tested |
| Voice (faster-whisper STT + Kokoro TTS) | ✅ Working |
| Avatar presence (VRM + three.js lip-sync) | ✅ Working |
| Registration / login / sign-out | ✅ Verified |
| Passwords: Argon2id, lockout, rate limits | ✅ |
| Diagnosis disclosure (encrypted, revocable) | ✅ |
| Private journal + mood tracking | ✅ |
| Silence check-ins + typing indicators | ✅ |
| Multilingual UI (EN/AR RTL/ES/FR) + Arabic AI replies | ✅ |
| Billing: Paymob gateway code + webhook HMAC verification | ✅ Code done |
| Safety control plane + crisis FSM (deterministic) | ✅ |
| Encryption at rest for sensitive fields | ✅ |

---

## BLOCKERS before public launch

### 1. Paymob merchant account (human task, ~1 week)
The code is ready but needs real credentials:
- Register at paymob.com (business or sole-proprietor; Egypt).
- From the dashboard collect: `Secret Key`, `Public Key`, `HMAC Secret`,
  and your card `Integration ID`.
- Put them in `.env` as `GLOW_PAYMOB_SECRET_KEY`, `GLOW_PAYMOB_PUBLIC_KEY`,
  `GLOW_PAYMOB_HMAC_SECRET`, `GLOW_PAYMOB_INTEGRATION_ID`.
- Register your webhook URL in the dashboard
  (`https://your-domain/api/billing/webhook/paymob`).
- Test with Paymob sandbox cards before going live.
Until then `/billing/checkout` returns "Payments are not configured yet" —
the rest of the app works fine without it.

### 2. PostgreSQL migration (required before real users)
SQLite is dev-only. Free hosted PostgreSQL options: Neon, Supabase,
or Aiven. Set `GLOW_DATABASE_URL` to the Postgres URL and run Alembic.
All queries already use SQLAlchemy ORM → this is config + migration only.

### 3. Real authentication hardening for production
Current auth is solid for a pilot but before scale:
- Move JWTs from sessionStorage to HttpOnly cookies (XSS-hardening).
- Add refresh tokens + logout-everywhere (token revocation list).
- Add email verification and password reset (needs an email provider —
  Resend has a free tier).

### 4. Legal pages (required by Egyptian law & app norms)
- Privacy Policy (data collected, retention, deletion rights)
- Terms of Service (AI disclaimer, no-suicide-treatment claims)
- Medical disclaimer reviewed by an Egyptian lawyer — mental-health apps
  have specific rules about what they may claim.
Templates exist but a lawyer should review once.

### 5. Crisis resources for Egypt
The crisis FSM points users to emergency services generically. For launch:
- Add the real Egyptian crisis/suicide-prevention hotline(s) to the
  resource registry (currently generic "contact local emergency services").
- Have the response scripts clinically reviewed (per CLAUDE.md this was
  always a launch gate).

---

## IMPORTANT but not blocking (first 2 weeks after launch)

- **CI/CD**: GitHub Actions running pytest + typecheck on every PR.
- **Monitoring**: Sentry free tier for error tracking; UptimeRobot for
  availability pings.
- **Backups**: automated daily Postgres dumps (even a cron + S3 counts).
- **CORS lockdown**: currently `allow_origins=["*"]` for dev — set to your
  real domain in production env.
- **HTTPS**: non-negotiable; most hosts below give it free.
- **Arabic clinical review**: the CLAUDE.md gate on Arabic therapy replies
  was enabled at founder request — get an Arabic-speaking clinician to
  review sample conversations.

---

## FREE hosting recommendation (fits this stack)

**Recommended: Render.com free tier + Neon free Postgres**

| Component | Service | Free tier |
|---|---|---|
| Next.js frontend | Vercel Hobby | ✅ perfect fit |
| FastAPI backend | Render Web Service | ✅ spins down when idle |
| PostgreSQL | Neon | ✅ 0.5 GB (plenty for launch) |
| Error tracking | Sentry | ✅ |

Alternative all-in-one: **Railway** (one service each for web+API+DB,
simplest first-deploy experience, ~$5/mo after trial) or **Fly.io**.

Deployment steps are in `docs/deploy-runbook.md`.

### Hosting caveat (voice/avatar)
Render free tier spins down after idle → first voice request may take
~30s to wake. Acceptable for a pilot; upgrade ($7/mo) removes it.
Kokoro TTS runs on CPU (~2s/sentence) which is acceptable; if latency
matters later, add a paid GPU inference endpoint.

---

## Launch sequence (recommended order)

1. Deploy to Render + Vercel + Neon (private URL). Verify health.
2. Complete Paymob merchant registration; wire keys; test sandbox payment.
3. Lawyer-reviewed privacy/terms/disclaimer pages live.
4. Egyptian crisis hotline added + clinician review of scripts.
5. Email verification + password reset shipped.
6. Soft launch to 10–50 trusted users; watch Sentry daily.
7. Public marketing begins.
