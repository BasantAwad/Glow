# Glow

Glow is an adult-focused AI mental-health support and care-navigation product. It is **not** a human therapist, diagnostic service, emergency service, or replacement for professional care. Glow supports; it does not treat.

- Live (production): https://glow-virid-alpha.vercel.app
- API health: https://glow-virid-alpha.vercel.app/api/healthz

## Repository layout

- `apps/api`: Python/FastAPI server — auth, consent, sessions, safety control plane, model gateway, TTS/STT, billing, persistence.
- `apps/web`: Next.js 16 / TypeScript web client.
- `docs`: architecture, safety, privacy, deployment, and continuation notes.
- `docs/adr`: material technical and product decisions.
- `Design`: design assets.

## Stack

- Backend: FastAPI (Python 3.13), SQLAlchemy (async) + Alembic, Postgres (Neon in production; SQLite locally).
- Frontend: Next.js 16 (App Router), React, TypeScript, Tailwind.
- LLM: OpenAI-compatible chat APIs (OpenRouter by default in production) with model-level failover and a local rule-based engine as last resort.
- Realistic avatar: Tavus embed (third-party).
- Deployment: Vercel Services (two services: `api` FastAPI + `web` Next.js) sharing one origin via `/api`, with Neon Postgres. Render is not used.

## Features

- Text chat with an AI support companion (multi-turn sessions, memory, mood tracking).
- Journaling and reflections.
- Mood check-in, guided exercises/practices, wellness tools, learning content.
- Session history and summaries.
- Realistic video presence (Tavus embed).
- Games and wellness activities.
- Multi-language UI: English, Spanish, French, Arabic.
- Account system: register/login, email verification, password reset, profile, consent records.
- Billing (Paymob) for premium tiers; crisis resources always available regardless of payment status.
- Voice: TTS/STT gateways (optional).
- Safety control plane outside the LLM: crisis FSM, policy enforcement, content safety.

## Requirements

- Python 3.13 (backend requires 3.11+; 3.13 is the selected target).
- Node.js 20.9+ and npm 10+.

## Local development

```powershell
# Backend
python -m venv .venv
.\.venv\Scripts\python -m pip install -e ".\apps\api[dev]"
.\.venv\Scripts\python -m uvicorn glow_api.main:app --app-dir .\apps\api\src --reload

# Frontend (separate terminal)
npm install
npm run dev:web        # serves on port 3001
```

Set `NEXT_PUBLIC_API_URL=http://localhost:8000` in `apps/web/.env.local`. Copy `apps/api/.env.example` → `apps/api/.env` and fill in secrets (auth key, master key). See `.env.example` at repo root for the full list.

API health check: `GET /healthz` → `{"status":"ok",...}`.

## Database

Alembic migrations are the source of truth. Apply with:

```powershell
cd apps/api
alembic upgrade head
```

Production uses Neon Postgres (`GLOW_DATABASE_URL=postgresql+asyncpg://...`). Local dev defaults to SQLite.

## Model routing

`GLOW_LLM_PROVIDER` selects the engine: `auto` (default), `openai_compatible`, `huggingface`, `local`, `disabled`.

- `openai_compatible`: any OpenAI-compatible chat API (OpenRouter, Groq, Ollama, vLLM). Configure `GLOW_LLM_API_BASE`, `GLOW_LLM_API_KEY`, `GLOW_LLM_MODEL_ID`.
- `GLOW_LLM_MODEL_FALLBACK_IDS`: comma-separated extra model IDs tried on the same endpoint before the local engine (useful for free models whose upstream pools are rate-limited).
- `GLOW_LLM_FALLBACK_PROVIDER` / `GLOW_LLM_FALLBACK_*`: secondary provider.
- `GLOW_LLM_LOCAL_FALLBACK_ENABLED`: final rule-based engine (on by default).
- `huggingface`: Hugging Face Router (requires token; sends session text to the configured endpoint — explicit opt-in).

## Deployment (Vercel + Neon)

See `vercel.json` and `DEPLOY.md`. Summary:

- Two Vercel Services: `api` (FastAPI, root `apps/api`) and `web` (Next.js, root `apps/web`).
- Top-level rewrites route `/api/*` → `api` service and `/*` → `web` service; the api service strips the `/api` prefix.
- Same-origin API: `NEXT_PUBLIC_API_URL=/api`.
- Set all secrets/env vars via `vercel env` (never commit). Required: `GLOW_DATABASE_URL`, `GLOW_AUTH_SECRET_KEY`, `GLOW_MASTER_KEY`, `GLOW_LLM_API_BASE`, `GLOW_LLM_API_KEY`, `GLOW_LLM_MODEL_ID`, `GLOW_CORS_ORIGINS`, `GLOW_WEB_BASE_URL`, `GLOW_SERVICE_NAME`, `GLOW_ENVIRONMENT=production`.
- Apply migrations to Neon before/after deploy: `alembic upgrade head`.
- Deploy: `vercel deploy --prod`.

## Tavus presence (optional)

The `/presence` page embeds a Tavus realistic-video companion. It uses a hardcoded demo deployment ID by default. To use your own, set `NEXT_PUBLIC_TAVUS_DEPLOYMENT_ID` (Vercel env or `.env.local`) to your Tavus deployment ID.

## Safety

Glow is not a diagnostic tool or replacement for licensed care. Safety logic lives in a deterministic control plane outside the LLM (crisis FSM, policy, content safety). Crisis resources remain accessible regardless of payment status. See `docs/clinical-safety.md`, `docs/crisis-protocol.md`, `docs/threat-model.md`.

## License

See repository for license details. All rights reserved unless otherwise noted.
