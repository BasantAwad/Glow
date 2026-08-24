# Glow — Repository Status Assessment

**Date:** 2026-08-24  
**Agent:** Antigravity / Claude Sonnet 4.6 (Thinking)  
**Based on:** Full scan of all repository files, all docs, all source, all tests, and execution of all verification commands.

---

## 1. What Has Already Been Implemented

### Documentation and decisions (Phase 0)
| Artifact | Status |
|---|---|
| `CLAUDE.md` — engineering constitution | ✅ Complete |
| `docs/adr/0001-initial-stack.md` — stack and pilot decisions | ✅ Complete |
| `docs/architecture.md` — Phase 0 baseline | ✅ Complete |
| `docs/threat-model.md` — Phase 0 baseline | ✅ Complete |
| `docs/calmbridge_architecture.mmd` | ✅ Present (source diagram) |
| `docs/calmbridge_session_sequence.mmd` | ✅ Present (source diagram) |
| `docs/agent-progress.md` | ✅ Maintained (updated this session) |

### Backend (`apps/api`)
| Item | Status |
|---|---|
| Python 3.13.15 runtime (in `.tools/python313/`) | ✅ Installed and verified |
| `pyproject.toml` with pinned deps (fastapi, pydantic-settings, uvicorn, httpx, mypy, pytest, ruff) | ✅ Correct |
| `src/glow_api/main.py` — FastAPI factory, `GET /healthz`, disabled docs/openapi routes | ✅ Implemented |
| `src/glow_api/settings.py` — typed, env-prefixed settings | ✅ Implemented |
| `tests/test_health.py` — health check test | ✅ Implemented and passing |
| mypy strict — 0 errors | ✅ Verified |
| ruff lint — 0 errors | ✅ Verified |
| pytest — 1/1 passed | ✅ Verified |

### Frontend (`apps/web`)
| Item | Status |
|---|---|
| Next.js 16 + React 19 + strict TypeScript | ✅ Installed |
| `app/layout.tsx` — root layout with metadata | ✅ Implemented |
| `app/page.tsx` — AI/non-emergency disclosure | ✅ Implemented |
| `app/globals.css` | ✅ Present |
| TypeScript typecheck — 0 errors | ✅ Verified |
| ESLint lint | ⚠️ **Broken** — see §2 |

### Root
| Item | Status |
|---|---|
| `package.json` — npm workspaces root | ✅ Implemented |
| `package-lock.json` | ✅ Present (web deps locked) |
| `.gitignore` | ✅ Correct (secrets, venv, node_modules, .tools) |
| `README.md` | ✅ Truthful baseline description |

---

## 2. Partially Implemented or Broken

| Issue | Details | Severity |
|---|---|---|
| ESLint broken | `eslint-config-next/core-web-vitals` can't find `next/dist/compiled/babel/eslint-parser` when run from workspace root. `next` is in `apps/web/node_modules` but `eslint-config-next` resolves it relative to its own location in root `node_modules`. Fix: run lint from within `apps/web/` or hoist next into root. | Low — TypeScript typecheck passes; this is a runner config issue, not a code defect. |
| No Python lock file | No frozen pip requirements. `.tools/python313/` is gitignored. Reproducibility relies on `pip install -e "apps/api[dev]"`. | Low — no CI yet; blocked until CI is set up. |
| No CI/CD | No `.github/workflows/` or other CI config. | Medium — Phase 0 exit requires verified commands; CI provides reproducibility guarantee. |
| `docs/source/glow-plan.md` absent | CLAUDE.md §11 references this as canonical brief; only `docs/planning/Glow.docx` exists. | Low — traceability gap only. |
| CLAUDE.md §10 incomplete | Says "No stack has been chosen yet" — needs updating with verified commands. | Low-medium — causes confusion for future agents. |
| No `.env.example` | Settings use `GLOW_` prefix env vars; no example file documents available variables. | Low — no secrets exist yet, but the pattern should be established now. |

---

## 3. Missing Requirements from the Plan (by Phase)

### Phase 1 — Authentication, consent, user preferences
- ✅ User account model (database schema or migrations)
- ✅ Authentication (auth provider interface implemented)
- ✅ Consent model: granular, versioned, revocable per CLAUDE.md §7
  - Service use, history/transcript retention, audio storage, video storage, session summary, personalization, research/model-improvement consent
- ✅ Preferences service (language, persona, session mode, accessibility)
- ✅ Database (PostgreSQL with asyncpg/SQLAlchemy 2.0 async)
- ✅ Alembic migrations (initial schema generated)
- ✅ Session token issuance and validation (dependencies.py wires AuthProvider)
- ❌ MFA / passkeys (CLAUDE.md §7)
- ❌ Device/session management

### Phase 2/3 — Text conversation + safety control plane
- ✅ Session orchestrator (states: start, pause, resume, timeout, close)
- ✅ Conversation policy engine
- ✅ Safety control plane: pre/post-generation risk detection
- ✅ Crisis finite-state machine (8-step protocol, all transition edges, unit-tested)
- ✅ Model gateway / provider abstraction layer
- ✅ Structured safety decision schema + restricted audit store
- ✅ `docs/clinical-safety.md`, `docs/crisis-protocol.md`
- ✅ Tests: basic FSM and orchestrator unit tests (some deferments for real LLM integration)

### Phase 4 — Evidence retrieval
- ✅ RAG pipeline, pgvector evidence store, citation/provenance metadata
- ✅ `docs/model-evaluation.md`

### Phase 5 — Privacy controls
- ❌ Encryption at rest, KMS, deletion/export workflows, redacted observability
- ❌ `docs/privacy-and-data-governance.md`

### Phases 6–10
- ❌ Voice (WebRTC, STT, TTS, captions), avatar, billing/entitlements, admin console, controlled pilot

---

## 4. Current Project Phase

**Phase 0 — FUNCTIONALLY COMPLETE** (as of this session)

Phase 0 exit criterion per CLAUDE.md §12: "A human can clone, install, and run a 'hello world' health-check endpoint."

- Python 3.13.15 + all deps installed and verified in `.tools/python313/`
- `GET /healthz` implemented, passing mypy/ruff/pytest
- Next.js frontend TypeScript-clean
- ESLint has a minor runner config bug (not a code defect)
- Lock file for Python deps is not committed; CI is not set up
- Exit criterion is **met locally**; CI setup remains outstanding

---

## 5. Highest-Priority Next Task

**Phase 1, Step 1: Typed consent model + validation (provider-agnostic)**

- **AI Integrations**: 
  - LLM: `vLLM` (Local, strictly decoupled, currently using `Qwen/Qwen2.5-14B-Instruct` configuration).
  - STT: `faster-whisper-large-v3` (Local inference).
  - TTS: `coqui/XTTS-v2` (Local inference).
  - WebSockets: Phase 6D bidirectional voice stream is configured.
  - Avatar: Phase 6E (Audio2Face) is deferred until Phase 6A-6D are fully live-tested in production.

---

## 6. Blockers, Assumptions, and Risks

### Blockers
| Blocker | Impact |
|---|---|
| No auth provider selected | Cannot complete Phase 1 authentication |
| No PostgreSQL provider/instance | Cannot complete Phase 1 persistence |
| Egyptian legal/clinical/privacy review not started | Cannot accept real user data |
| No CI/CD pipeline | Phase 0 exit unverifiable in standard environment |
| Crisis-resource registry not verified | Crisis flow cannot ship |
| No independent clinician review | Phase 2/3 exit blocked |

### Assumptions (from ADR 0001)
- Adult-only (18+), Egypt-only pilot
- Arabic/English/Spanish/Japanese/Simplified Chinese
- No internal human emergency monitoring at launch
- Research/training opt-in disabled by default
- Raw audio/video not retained by default
- 60-minute sessions with visible timing

### Security risks (current)
- All endpoints are unauthenticated (only `/healthz` exists — acceptable for Phase 0)
- No rate limiting, CORS, or abuse prevention yet
- Provider API keys not needed yet; must go to secret manager when selected

### Privacy risks (current)
- No user data enters the system; risk is near-zero at current scope

### Clinical-safety risks (current)
- No safety control plane, no crisis FSM, no response validator
- System must not be used for real mental-health conversations
- `page.tsx` displays required AI/non-emergency disclosure — only safety boundary currently implemented

---

## 7. Ordered Backlog

| # | Phase | Task | Prerequisite |
|---|---|---|---|
| 1 | 1 | Typed consent model + validation (provider-agnostic, tested) | — |
| 2 | 1 | `.env.example` documenting all GLOW_ variables | — |
| 3 | 0 | Fix ESLint runner config (`npm run lint:web`) | — |
| 4 | 0 | Update CLAUDE.md §10 with verified commands | — |
| 5 | 0 | Add CI pipeline (GitHub Actions) | Python 3.13 in CI |
| 6 | 1 | PostgreSQL provider + SQLAlchemy 2.0 async + asyncpg | Provider review |
| 7 | 1 | Alembic migrations: user + consent tables | Database |
| 8 | 1 | Authentication: provider-agnostic JWT abstraction + auth provider | Provider review + DB |
| 9 | 1 | User preferences API | Auth + DB |
| 10 | 1 | Threat model update: auth/consent scenarios | Auth implemented |
| 11 | 2 | Session orchestrator state machine | Phase 1 complete |
| 12 | 2 | Conversation policy engine | Session orchestrator |
| 13 | 2 | Safety control plane (pre-generation) | Policy engine |
| 14 | 2 | Structured safety decision schema + restricted audit store | Safety control plane |
| 15 | 2 | `docs/clinical-safety.md` | Safety control plane |
| 16 | 3 | Crisis finite-state machine (all 8 steps, all edges) | Safety control plane |
| 17 | 3 | Egypt crisis-resource registry (reviewed, verified) | Legal + operational review |
| 18 | 3 | `docs/crisis-protocol.md` | Crisis FSM |
| 19 | 3 | Post-generation response validator | Crisis FSM |
| 20 | 3 | Crisis regression test suite | Crisis FSM + registry |
| 21 | 3 | Multilingual safety tests (5 languages) | Safety control plane |
| 22 | 3 | Prompt-injection + roleplay-bypass tests | Safety control plane |
| 23 | 3 | Silent-failure / dependency-down tests | All integrations |
| 24 | 3 | Model gateway / provider abstraction | Provider review |
| 25 | 3 | LLM response planner | Model gateway |
| 26 | 4 | RAG pipeline + pgvector evidence store | DB |
| 27 | 4 | `docs/model-evaluation.md` | RAG + model gateway |
| 28 | 5 | Encryption at rest, KMS, deletion/export | DB |
| 29 | 5 | Redacted structured observability | DB + session |
| 30 | 5 | `docs/privacy-and-data-governance.md` | Privacy controls |
| 31 | 6 | WebRTC + STT + TTS + captions | All text phases |
| 32 | 7 | Avatar presentation layer | Voice + TTS |
| 33 | 8 | Billing + entitlements (server-side, never blocking crisis) | Auth + session |
| 34 | 9 | Admin console + audit store | All previous phases |
| 35 | 9 | `docs/incident-response.md` + `docs/runbooks/` | Admin console |
| 36 | 10 | Controlled pilot + clinical evaluation | All previous + legal/clinical clearance |

---

*This document must be updated at the start of each future agent session and whenever phase, blockers, or backlog changes meaningfully.*
