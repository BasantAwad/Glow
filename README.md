# Glow

Glow is an adult-focused AI mental-health support and care-navigation product. It is not a human therapist, diagnostic service, emergency service, or replacement for professional care.

## Repository layout

- `apps/api`: Python/FastAPI server, policy enforcement, and future persistence boundaries.
- `apps/web`: Next.js/TypeScript web client.
- `docs/adr`: material technical and product decisions.
- `docs`: architecture, safety, privacy, and continuation documentation.

## Current baseline

The repository currently provides a working FastAPI backend with authentication, consent, session management, safety control plane, TTS/STT gateways, and a Next.js frontend with text chat, Tavus therapist embed, guided exercises, session history, mood check-in, crisis bar, and multi-language support (en/es/fr/ar).

## Requirements

- Python 3.13 (the backend requires Python 3.11+; 3.13 is the selected local target).
- Node.js 20.9+ and npm 10+.

## Planned verification commands

These commands become supported after dependencies and lock files are generated with Python 3.13; they are not yet verified in this repository.

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install --upgrade pip
.\.venv\Scripts\python -m pip install -e ".\apps\api[dev]"
.\.venv\Scripts\python -m uvicorn glow_api.main:app --app-dir .\apps\api\src --reload

npm install
npm run dev:web
```

The API health check will be exposed at `GET /healthz`. Do not use this baseline with real sensitive conversations or production credentials.

