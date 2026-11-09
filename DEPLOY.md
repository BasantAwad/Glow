# Glow — Full-stack deployment checklist

## 1. Prerequisites

- Python 3.13 (backend)
- Node.js 20.9+, npm 10+ (frontend)
- Docker + Docker Compose (containerised deployment)
- A running vLLM endpoint (optional — without it, LLM calls fail with ProviderNotConfiguredError)

## 2. Backend setup

### 2a. Environment variables

Copy `apps/api/.env.example` to `apps/api/.env` and fill in:

```
GLOW_ENVIRONMENT=production
GLOW_SERVICE_NAME=glow-api
GLOW_DATABASE_URL=sqlite+aiosqlite:///./glow.db

# Auth — MUST be set for any protected endpoint
GLOW_AUTH_SECRET_KEY=<hex-encoded, min 32 bytes>

# Encryption — MUST be set for transcript storage
GLOW_MASTER_KEY=<hex-encoded, 32 bytes>

# LLM — set to your vLLM endpoint, e.g. http://localhost:8000/v1
GLOW_LLM_API_BASE=<your-vllm-url>
GLOW_LLM_MODEL_ID=Qwen/Qwen2.5-14B-Instruct

# TTS — path to kokoro model on host (mounted into container)
GLOW_TTS_MODEL_PATH=/app/data/kokoro-v1.0.onnx
GLOW_TTS_VOICE_ID=a

# STT
GLOW_STT_MODEL_ID=tiny
```

### 2b. Start with Docker Compose

```bash
docker compose up -d --build
```

The API will be available at `http://localhost:8000`.

Health check:
```bash
curl http://localhost:8000/healthz
# => {"status":"ok","service":"glow-api","environment":"production"}
```

### 2c. Run database migrations

```bash
docker compose exec api alembic upgrade head
```

### 2d. Without Docker

```bash
cd apps/api
pip install -e ".[dev]"
uvicorn glow_api.main:app --host 0.0.0.0 --port 8000
```

## 3. Frontend setup

### 3a. Environment

Create `apps/web/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

For production, set it to your deployed backend URL.

### 3b. Build

```bash
cd apps/web
npm install
npm run build
```

### 3c. Serve

```bash
npm run start   # serves the built production bundle on localhost:3000
```

## 4. Frontend Docker (standalone)

When deploying the frontend separately (e.g. to Vercel, Netlify, or a standalone container), use:

```dockerfile
FROM node:20-slim AS builder
WORKDIR /build
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci
COPY apps/web/ ./
ENV NEXT_PUBLIC_API_URL=http://localhost:8000
RUN npm run build

FROM node:20-slim
WORKDIR /app
COPY --from=builder /build/.next ./.next
COPY --from=builder /build/public ./public
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/package.json ./
CMD ["npx", "next", "start", "-p", "3000"]
```

## 5. Deployment targets

### Free / low-cost options (practical)

| Component | Platform | Notes |
|---|---|---|
| Frontend | Vercel (Hobby) | Good fit for Next.js. Set `NEXT_PUBLIC_GLOW_API_URL` to the deployed API URL. |
| Backend | Render / Railway / Fly.io | Deploy the FastAPI app from `apps/api`. Free tiers may sleep/spin down; first request can be slow. |
| Database | Neon / Supabase Postgres (free tier) | **Use Postgres for any deployment where data must persist.** SQLite on most free ephemeral filesystems can be lost on restart/redeploy. |

### Required production/cross-origin settings

When frontend and API are on different domains (e.g. `https://app.example` + `https://api.example`):

```env
GLOW_ENVIRONMENT=production
GLOW_CORS_ORIGINS=https://app.example
GLOW_AUTH_COOKIE_ENABLED=true
GLOW_AUTH_COOKIE_SAMESITE=none
GLOW_AUTH_COOKIE_SECURE=true
GLOW_AUTH_SECRET_KEY=<hex secret>
GLOW_MASTER_KEY=<hex 32-byte key>
GLOW_DATABASE_URL=postgresql+asyncpg://user:pass@host/db  # from Neon/Supabase; provider may give postgres://, convert if needed
```

Notes:
- `SameSite=none` cookies require HTTPS and `Secure=true`.
- The API already supports bearer tokens; cookie persistence is an additional convenience.
- Run migrations in controlled deployments: `alembic upgrade head` (with DB env configured). The app also runs `create_all` on startup as a local/dev convenience; do not rely on that alone for production schema management.

### Conversational model (LLM) — recommended free chain

**Recommended order: Groq (primary) → OpenRouter free model (secondary) → local rule-based engine (last resort).**

Why:
- **Groq** has a free tier, low latency, and a stable OpenAI-compatible API — best fit for conversational chat.
- **OpenRouter** has free models (`:free` suffix) and the same API shape — a good secondary when Groq is rate-limited/unavailable. Free model availability can change; check OpenRouter's model list.
- The **local engine** never depends on a network/provider, so the app keeps responding even if both external providers fail. It is rule-based, not a neural/clinical model; safety checks still run.

```env
# Primary: Groq
GLOW_LLM_PROVIDER=openai_compatible
GLOW_LLM_API_BASE=https://api.groq.com/openai/v1
GLOW_LLM_API_KEY=<GROQ_API_KEY>
GLOW_LLM_MODEL_ID=llama-3.3-70b-versatile

# Secondary: OpenRouter free model
GLOW_LLM_FALLBACK_PROVIDER=openai_compatible
GLOW_LLM_FALLBACK_API_BASE=https://openrouter.ai/api/v1
GLOW_LLM_FALLBACK_API_KEY=<OPENROUTER_API_KEY>
GLOW_LLM_FALLBACK_MODEL_ID=meta-llama/llama-3.3-70b-instruct:free

# Final fallback: local engine (required explicit opt-in outside development)
GLOW_LLM_LOCAL_FALLBACK_ENABLED=true
```

Notes:
- The chain is tried in order only when a provider is unconfigured, errors, or returns empty text. Once streaming has started, it does not switch providers mid-stream.
- `GLOW_LLM_LOCAL_FALLBACK_ENABLED` defaults to true so provider outages degrade to the local engine instead of breaking chat. Set it to `false` if you explicitly do not want local replies.
- `GLOW_LLM_TIMEOUT_SEC` (default `30`) caps each provider request. Lower it for slow free tiers so the fallback chain answers sooner; raise it for slow self-hosted models.
- Session text is sent to each external endpoint that is attempted; choose providers consistent with your privacy/legal requirements.
- **Hugging Face Router (explicit):** `GLOW_LLM_PROVIDER=huggingface`, `GLOW_HF_TOKEN` (or `HUGGINGFACE_API_KEY`), `GLOW_HF_MODEL_ID`. Access depends on your HF account, model/provider availability, and permissions.
- **Ollama (self-hosted free neural option):** `GLOW_LLM_API_BASE=http://localhost:11434/v1`, `GLOW_LLM_MODEL_ID=<installed model>`, no API key required. Use a 3B+ model (e.g. `llama3.2:3b`) for usable supportive conversation; very small models (0.5B) respond but quality is poor. Everything stays on the machine, so this is the most privacy-preserving neural option for local/demo use, but it is not suitable for a free cloud host without compute.
- **Pollinations (keyless free demo option):** `GLOW_LLM_API_BASE=https://text.pollinations.ai/openai`, `GLOW_LLM_MODEL_ID=openai`, no API key. It worked for real multi-turn tests here, but the anonymous tier is rate-limited and can time out, so the local fallback may answer some turns. **Privacy warning:** this is a public third-party service; do not send real user mental-health text to it without informed consent and a proper data-processing review. Treat it as a demo/testing option, not a production provider.
- **Fully local chain example (neural + last-resort rule engine):**

```env
GLOW_LLM_PROVIDER=openai_compatible
GLOW_LLM_API_BASE=http://127.0.0.1:11434/v1
GLOW_LLM_API_KEY=ollama
GLOW_LLM_MODEL_ID=llama3.2:3b
GLOW_LLM_FALLBACK_PROVIDER=local
GLOW_LLM_LOCAL_FALLBACK_ENABLED=true
```

### Optional web search tool (opt-in, informational only)

The primary model may call a `web_search` tool for general factual questions.
The curated evidence corpus stays authoritative; search never runs for crisis,
diagnosis, or medication questions. Full guardrails: `docs/web-search.md`.

```env
GLOW_WEB_SEARCH_ENABLED=true
GLOW_SEARCH_PROVIDER=tavily        # or brave
GLOW_SEARCH_API_KEY=<free-tier-key>
GLOW_SEARCH_MAX_RESULTS=3
GLOW_SEARCH_MAX_PER_SESSION=5
GLOW_SEARCH_TIMEOUT_SEC=8
```

Free tiers need no card: Tavily ~1,000 searches/month, Brave ~2,000/month.
Review the provider's data-processing terms before enabling in production —
queries (never transcripts) leave the server.

### PostgreSQL migration

1. Provision a PostgreSQL instance (Neon, Supabase, Render Postgres, Railway, etc.).
2. Set `GLOW_DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/glow` (ensure the driver scheme matches your environment; `asyncpg` is included).
3. Set required secrets (`GLOW_AUTH_SECRET_KEY`, `GLOW_MASTER_KEY`).
4. Run `alembic upgrade head`.
5. Verify `/healthz`, auth, journal/mood, and a real multi-turn chat. Re-test before routing users.

## 5b. One-click free deploy (Render + Vercel + Neon)

Everything below is free-tier. Run in order:

1. **Neon (Postgres):** create a free project at neon.tech and copy the
   pooled connection string.
2. **GitHub:** push this repo (`.env` files, `.venv`, `test-runtime/` are
   gitignored — never commit secrets).
   > Force-add the templates first (they are gitignored by the `.env.*` rule):
   > `git add -f .env.example apps/api/.env.example`
3. **Render (API):** dashboard → New → Blueprint → point at `render.yaml`
   (Docker build from repo root, health check `/healthz`). In the service
   settings, set `GLOW_DATABASE_URL` (Neon URL) and `GLOW_LLM_API_KEY`
   (OpenRouter). Keep the generated `GLOW_MASTER_KEY` / `GLOW_AUTH_SECRET_KEY`
   — or paste the current ones from `apps/api/.env` if you want existing
   encrypted data to remain readable.
4. **Vercel (web):** import the repo, Framework Preset = Next.js,
   Root Directory = `apps/web`, set
   `NEXT_PUBLIC_GLOW_API_URL=https://glow-api.onrender.com`
   (your Render domain) and deploy.
5. **Back on Render:** set `GLOW_CORS_ORIGINS` to your Vercel domain
   (e.g. `https://your-app.vercel.app`), then Redeploy. HTTPS is automatic
   on both; the API sets HSTS and cross-site cookies (`SameSite=None`,
   `Secure`) when `GLOW_ENVIRONMENT=production`.
6. **Smoke test:** `/healthz` 200 → register in the browser (age/gender/
   medication fields included) → one chat turn → journal save → mood
   check-in. Restart the API and confirm re-login works.

Free-tier caveats (documented, not blockers): Render free spins down after
idle (first request can take ~30s); the OpenRouter free model can return
429 rate limits, in which case chat degrades to the local engine.

**Billing (Paymob): deferred by decision.** The checkout/webhook code ships
and returns a clean "not configured" state; merchant credentials are a
future plan, not a launch blocker. When added, use the sandbox cards end to
end, then register the webhook URL — see §6 launch sequence. Paymob
billing, email verification, and the Tavus voice companion need real
credentials before they do anything live.

## 6. SMOKE TEST (run after deployment)

```bash
# Health
curl -f http://localhost:8000/healthz

# Create a user + consent (requires auth — see test_auth.py for the flow)
# This is a placeholder — replace with your actual auth token
curl -f -X POST http://localhost:8000/sessions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## 7. Troubleshooting

- **503 / ProviderNotConfiguredError on /sessions**: auth secret key not set, or LLM not configured
- **TTS not working**: GLOW_TTS_MODEL_PATH not mounted, or kokoro-onnx not installed
- **STT not working**: faster-whisper not installed, or model not downloaded
- **CORS errors**: check that NEXT_PUBLIC_API_URL matches the deployed backend URL

## 8. Architecture overview

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Next.js     │────▶│  FastAPI (8000)  │────▶│  SQLite / PG     │
│  Frontend    │     │  - /sessions     │     │  (database)      │
│  (3000)      │     │  - /avatar       │     └──────────────────┘
│              │     │  - /healthz      │
└──────────────┘     │  - CORS          │     ┌──────────────────┐
                      └──────────────────┘     │  vLLM (optional) │
                                               │  Kokoro TTS      │
                                               │  FasterWhisper   │
                                               └──────────────────┘
```
