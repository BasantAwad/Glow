# Glow — Deploy Runbook (first deployment, free tier)

Step-by-step to take Glow from this machine to a live URL.
Time: ~2 hours. Cost: 0 EGP.

---

## 0. Prerequisites
- GitHub account; push this repo to a **private** GitHub repository:
  ```
  git remote add origin https://github.com/<you>/glow.git
  git push -u origin main
  ```
- Accounts: render.com, vercel.com, neon.tech (all free signups).

## 1. Database — Neon PostgreSQL
1. Create a project at neon.tech → copy the connection string
   (`postgresql://user:pass@host/db?sslmode=require`).
2. Keep it for step 3.

## 2. Backend — Render
1. New → Web Service → connect your GitHub repo.
2. Settings:
   - Runtime: Docker (add the Dockerfile below) or Python 3.13
   - Build: `pip install -e "apps/api[dev]"`
   - Start: `uvicorn glow_api.main:app --host 0.0.0.0 --port $PORT --app-dir apps/api/src`
3. Environment variables (Render dashboard → Environment):
   - `GLOW_ENVIRONMENT=production`
   - `GLOW_DATABASE_URL=<neon url>`
   - `GLOW_AUTH_SECRET_KEY=<python -c "import secrets;print(secrets.token_hex(32))">`
   - `GLOW_MASTER_KEY=<same generator>`
   - `GLOW_LLM_API_BASE=https://openrouter.ai/api/v1`
   - `GLOW_LLM_API_KEY=<your openrouter key>`
   - `GLOW_LLM_MODEL_ID=nvidia/nemotron-3-super-120b-a12b:free`
   - Paymob keys (when you have them)
4. Run migrations once from your machine against prod DB:
   ```
   GLOW_DATABASE_URL="<neon url>" alembic -c apps/api/alembic.ini upgrade head
   ```
5. Note your backend URL, e.g. `https://glow-api.onrender.com`.

## 3. Frontend — Vercel
1. New Project → import the same repo.
2. Root directory: `apps/web`
3. Environment variable:
   - `NEXT_PUBLIC_GLOW_API_URL=https://glow-api.onrender.com`
4. Deploy. Note your frontend URL.

## 4. Wire them together
- Render backend: set CORS allowed origin to your Vercel URL
  (edit `main.py` allow_origins before first deploy).
- Vercel frontend env var already points at Render.

## 5. Verify
- `curl https://glow-api.onrender.com/healthz` → `{"status":"ok"}`
- Open the site, register an account, send one chat message.
- Check `/billing/status` responds with your session count.

## 6. Paymob webhook (after merchant approval)
- Dashboard → Developers → Webhooks:
  `https://<backend>/billing/webhook/paymob`
- Test a sandbox payment end-to-end before enabling live keys.

---

## Rollback
Both Render and Vercel keep previous deployments — "Rollback" button in
each dashboard reverts in seconds.

## Secrets hygiene
- `.env` is gitignored — never committed.
- Rotate `GLOW_AUTH_SECRET_KEY` via `GLOW_AUTH_SECRET_KEY_V2` (see ADR 0002).
