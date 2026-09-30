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

### Free / low-cost options

| Component | Platform          | Notes                                              |
|-----------|-------------------|----------------------------------------------------|
| Frontend  | Vercel / Netlify  | Push to GitHub; auto-deploys on push to main      |
| Backend   | Render / Railway  | Docker Compose or Dockerfile; free tier available |
| Database  | SQLite (file)     | For initial deployment; migrate to PostgreSQL later|

### Production PostgreSQL

When ready to move off SQLite:

1. Provision a PostgreSQL instance (Render DB, Railway Postgres, Supabase, etc.)
2. Set `GLOW_DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/glow`
3. Run `alembic upgrade head`
4. Re-encrypt any existing SQLite data if needed

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
