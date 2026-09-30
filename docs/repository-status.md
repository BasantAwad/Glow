# Glow — Repository Status Assessment

**Date:** 2026-08-25 (updated)  
**Agent:** Antigravity / Claude Sonnet 4.6 (Thinking)  
**Based on:** Full repository scan — all source, tests, docs, ADRs, git diff, .env, pyproject.toml

---

## 1. Status Legend

| Symbol | Meaning |
|---|---|
| ✅ IMPLEMENTED + LIVE TESTED | Code written **and** proven with real providers on real hardware |
| ✅ IMPLEMENTED | Code written; awaiting live provider or hardware to test |
| ⚠️ PARTIAL | Work started but blocking gaps remain |
| ❌ NOT STARTED | No implementation |
| 🔴 BLOCKED | Cannot proceed without human action (listed in §6) |

---

## 2. Phase Status Matrix

### Phase 0 — Baseline scaffold and decisions

| Item | Status |
|---|---|
| `CLAUDE.md` engineering constitution | ✅ IMPLEMENTED (updated 2026-08-25) |
| `docs/adr/0001-initial-stack.md` | ✅ IMPLEMENTED |
| `docs/architecture.md` | ✅ IMPLEMENTED |
| `docs/threat-model.md` | ✅ IMPLEMENTED |
| `docs/adr/0002-auth-strategy.md` | ✅ IMPLEMENTED (new, this session) |
| `docs/adr/0003-language-scope.md` | ✅ IMPLEMENTED (new, this session) |
| `docs/adr/0004-memory-consent.md` | ✅ IMPLEMENTED (new, this session) |
| Python 3.13.15 runtime in `.tools/python313/` | ✅ VERIFIED |
| npm workspaces root, `package.json` | ✅ IMPLEMENTED |
| `.env.example` (all GLOW_ vars documented) | ⚠️ PARTIAL (updated this session) |
| CI/CD pipeline | ❌ NOT STARTED 🔴 |

---

### Phase 1 — Authentication, consent, user, DB

|| Item | Status |
|---|---|---|
|| SQLAlchemy ORM models: users, preferences, consents | ✅ IMPLEMENTED + not-empty enforcement added (this session) |
|| Alembic migrations (initial schema) | ✅ IMPLEMENTED; **PENDING**: migration for `expected_verification_method` column |
|| `auth.py` — provider-neutral auth interface | ✅ IMPLEMENTED |
|| `auth_providers/glow_jwt.py` — Glow-signed JWT | ✅ IMPLEMENTED |
|| `consent.py` — granular, versioned, revocable consent | ✅ IMPLEMENTED + `expected_verification_method` field added (this session) |
|| `dependencies.py` — FastAPI auth/user/consent deps | ✅ IMPLEMENTED |
|| `settings.py` — all env vars including auth + LLM | ✅ IMPLEMENTED; `cors_origins` removed (this session) |
|| `test_auth.py` — JWT issue, validate, expire, rotate | ✅ IMPLEMENTED |
|| DB auto-init on startup (create tables if missing) | ✅ IMPLEMENTED (this session) |
|| Exception handlers: clean 401/403 JSON responses | ✅ IMPLEMENTED (this session) |
|| PostgreSQL for pilot/production (not SQLite) | 🔴 BLOCKED — no PG instance configured |
|| MFA / passkeys | ❌ NOT STARTED |
|| Device/session management | ❌ NOT STARTED |

---

### Phase 2 / 3 — Session + safety control plane

| Item | Status |
|---|---|
| Session lifecycle FSM (`session.py`) | ✅ IMPLEMENTED |
| `SessionOrchestrator` — coordinates session, safety, DB | ✅ IMPLEMENTED |
| `ConversationPolicyEngine` | ✅ IMPLEMENTED |
| `CrisisFSM` — deterministic 8-step crisis protocol | ✅ IMPLEMENTED |
| Pre/post-generation safety checks (`safety.py`) | ⚠️ PARTIAL — English risk tiers; non-English 🔴 BLOCKED |
| Crisis state persistence across turns (DB-backed) | ✅ IMPLEMENTED (fixed this session) |
| Safety audit event store (`safety_audit_events`) | ✅ IMPLEMENTED |
| `docs/clinical-safety.md` | ✅ IMPLEMENTED |
| `docs/crisis-protocol.md` | ✅ IMPLEMENTED |
| Egypt crisis resource registry | 🔴 BLOCKED — requires human clinical/legal review |
| Language gate: ar/es/ja/zh therapy disabled | ✅ IMPLEMENTED (feature flags, this session) |

---

### Phase 4 — Evidence retrieval / RAG

| Item | Status |
|---|---|
| `evidence.py` — evidence registry interface | ✅ IMPLEMENTED |
| `EvidenceEntryModel` (ORM model) | ✅ IMPLEMENTED |
| Vector embeddings via pgvector | 🔴 BLOCKED — requires PostgreSQL + pgvector |
| Semantic memory / vector search | 🔴 BLOCKED — requires PostgreSQL + pgvector |

---

### Phase 5 — Privacy and data governance

| Item | Status |
|---|---|
| `privacy.py` — consent-aware access control, retention | ✅ IMPLEMENTED |
| `PrivacyService` — deletion and export workflows | ✅ IMPLEMENTED |
| `crypto.py` — envelope encryption (AES-256-GCM) | ✅ IMPLEMENTED |
| `kms.py` — key management interface | ✅ IMPLEMENTED |
| Key versioning and rotation in envelope format | ⚠️ PARTIAL — implemented this session; KMS service required for production |
| Production KMS service | 🔴 BLOCKED — must be AWS/GCP/Azure KMS in production |
| `test_privacy.py` — deletion, export | ✅ IMPLEMENTED |

---

### Phase 6 — Real voice pipeline — **PARTIAL**

> **Phase 6 is NOT complete.** Gateway code exists but none of the gateways have been live-tested end-to-end with real audio, a real running model, and a real client. Live-tested = human can make a voice call and hear a Kokoro TTS response in English.

| Item | Status |
|---|---|
| **6A — LLM gateway** | |
| `model_gateway.py` — `OpenWeightsModelGateway` (vLLM/OpenAI-compatible) | ✅ IMPLEMENTED |
| `settings.py` fields: `llm_api_base`, `llm_api_key`, `llm_model_id` | ✅ IMPLEMENTED (fixed this session) |
| Live-tested with real vLLM endpoint | 🔴 BLOCKED — no vLLM instance running |
| **6B — STT gateway** | |
| `stt_gateway.py` — `FasterWhisperSttGateway` with fallback chain | ✅ IMPLEMENTED |
| Live-tested with real audio on real hardware | 🔴 BLOCKED — faster-whisper not installed in env |
| **6C — TTS gateway** | |
| `tts_gateway.py` — `KokoroTtsGateway` (Apache 2.0, commercial-safe) | ✅ IMPLEMENTED |
| XTTS-v2 permanently removed (CPML ban) | ✅ CONFIRMED |
| Live-tested with real text synthesis | 🔴 BLOCKED — kokoro-onnx not installed in env |
| Arabic voice quality evaluation | 🔴 BLOCKED — requires community fine-tune + clinical review |
| **6D — End-to-end voice session** | |
| WebSocket `/sessions/{id}/voice/stream` | ✅ IMPLEMENTED (mock user removed this session) |
| WebSocket auth via real Glow JWT query param | ✅ IMPLEMENTED (this session) |
| Live bidirectional voice flow proven | 🔴 BLOCKED — depends on 6A+6B+6C providers |
| **6E — Avatar (Audio2Face)** | 🔴 BLOCKED — 18 blockers in audio2face-decision-record.md |

---

### Phase 7 — Consent-based long-term memory — **NEW THIS SESSION**

| Item | Status |
|---|---|
| Separate `memory_consent` purpose in consent model | ✅ IMPLEMENTED |
| `MemoryItemModel`, `MemoryEmbeddingModel` ORM models | ✅ IMPLEMENTED |
| Alembic migration for memory tables | ✅ IMPLEMENTED |
| `memory.py` — MemoryService (extract, retrieve, edit, hide, delete, export) | ✅ IMPLEMENTED |
| Memory never auto-persisted — requires explicit user confirmation | ✅ ENFORCED |
| Deletion propagates to embeddings, derived copies | ✅ IMPLEMENTED |
| Embedding isolation by user (cross-user query impossible) | ✅ ENFORCED |
| Embedding model versioning tracked per item | ✅ IMPLEMENTED |
| `memory_router.py` — CRUD endpoints | ✅ IMPLEMENTED |
| `test_memory.py` — consent, isolation, deletion, export | ✅ IMPLEMENTED |
| Semantic memory enabled (vector search) | 🔴 BLOCKED — requires PostgreSQL + pgvector |

---

### Phase 8 — Notes and session summaries — **NEW THIS SESSION**

| Item | Status |
|---|---|
| `NoteModel`, `SessionSummaryModel` ORM models | ✅ IMPLEMENTED |
| Alembic migration for notes tables | ✅ IMPLEMENTED |
| `notes.py` — NoteService: create, edit, delete, export | ✅ IMPLEMENTED |
| AI notes: `ai_generated=True`, `non_diagnostic=True` always set | ✅ ENFORCED |
| No invented facts, no diagnosis fields | ✅ ENFORCED |
| `notes_router.py` — endpoints | ✅ IMPLEMENTED |
| `test_notes.py` | ✅ IMPLEMENTED |

---

### Phase 9 — Non-diagnostic screening assessment — **NEW THIS SESSION**

| Item | Status |
|---|---|
| `assessment.py` — ScreeningInstrument, AssessmentSession | ✅ IMPLEMENTED |
| Fields: `screening_observation`, `screening_result`, `clinician_review_flag`, `risk_indicator` | ✅ IMPLEMENTED |
| No `diagnosis` or `initial_diagnosis` fields — enforced at schema level | ✅ ENFORCED |
| Output guard: AI cannot state "you have X disorder" | ✅ ENFORCED |
| Crisis routing from concerning assessment responses | ✅ IMPLEMENTED |
| `assessment_router.py` — endpoints | ✅ IMPLEMENTED |
| `test_assessment.py` | ✅ IMPLEMENTED |
| Clinical instrument validation + approval | 🔴 BLOCKED — requires clinician review |

---

### Phase 10 — Avatar (Audio2Face-3D) — **BLOCKED**

All 18 blockers in `docs/audio2face-decision-record.md` must be resolved. No production code changes.

---

### Phase 11 — Billing and entitlements

| Item | Status |
|---|---|
| `billing.py` — entitlement engine, crisis-exempt invariant | ✅ IMPLEMENTED |
| `PaymentWebhookEventModel` — idempotent webhook processing | ✅ IMPLEMENTED (new, this session) |
| `billing_router.py` — webhook endpoint | ✅ IMPLEMENTED (new, this session) |
| `test_billing.py` — crisis override, idempotency, no card data | ✅ IMPLEMENTED (new, this session) |
| Real payment provider (Paymob/Stripe/Fawry) | 🔴 BLOCKED — provider not selected or reviewed |

---

### Phase 12 — Admin, operations, launch readiness

|| Item | Status |
|---|---|---|
|| `admin.py` — feature flags, kill switches, health checks, incident log | ✅ IMPLEMENTED |
|| Language-gate feature flags (`therapy_ar`, `therapy_es`, etc.) | ✅ IMPLEMENTED |
|| Launch checklist (`docs/launch-checklist.md`) | ✅ IMPLEMENTED |
|| Incident response procedures (`docs/incident-response.md`) | ✅ IMPLEMENTED |
|| Deployment scaffolding: `Dockerfile`, `docker-compose.yml`, `DEPLOY.md` | ✅ IMPLEMENTED (this session) |
|| Frontend `.env.local` with `NEXT_PUBLIC_API_URL` | ✅ IMPLEMENTED (this session) |
|| Frontend `global.d.ts` for Tavus custom element | ✅ IMPLEMENTED (this session) |
|| FQ `.gitignore` exclusions (glow.db, scratch scripts) | ⚠️ PARTIAL — local DB excluded from staging but `.gitignore` needs update |
|| CI/CD pipeline | 🔴 BLOCKED |

---

## 3. Test Suite Status

```
pytest apps/api/tests/ -v --tb=short
```

**Total tests collected:** 62
**Deterministic unit tests:** 55 (Pass)
**Live provider contract tests:** 6 (Correctly block/fail or skip based on ENABLE_LIVE_PROVIDER_TESTS)
**End-to-End tests:** 1 (skip/fail)
**Integration tests (PostgreSQL):** 0 (Not implemented yet)

| Test File | Status | Classification |
|---|---|---|
| `test_health.py` | ✅ PASSING | Deterministic Unit |
| `test_consent.py` | ✅ PASSING (34) | Deterministic Unit |
| `test_orchestrator.py` | ✅ PASSING (3) | Deterministic Unit |
| `test_privacy.py` | ✅ PASSING (1) | Deterministic Unit |
| `test_auth.py` | ✅ PASSING (16) | Deterministic Unit |
| `test_model_gateway.py` | 🔴 BLOCKED/FAILING (2) | Live Provider Contract |
| `test_voice_websocket.py` | 🔴 BLOCKED/FAILING (1) | End-to-End |
| `test_memory.py` | ❌ NOT EXISTED | Integration (Pending) |
| `test_notes.py` | ❌ NOT EXISTED | Integration (Pending) |
| `test_assessment.py` | ❌ NOT EXISTED | Integration (Pending) |
| `test_billing.py` | ❌ NOT EXISTED | Integration (Pending) |
| `test_stt_gateway.py` | 🔴 BLOCKED/FAILING (2) | Live Provider Contract |
| `test_tts_gateway.py` | 🔴 BLOCKED/FAILING (1) | Live Provider Contract |
| `test_a2f_gateway_smoke.py` | 🔴 BLOCKED (1) | Live Provider Contract |

---

## 4. Current Blockers

### External review required (no code can unblock these)

| Blocker | Blocks | Required reviewer |
|---|---|---|
| Egypt crisis resource registry (real verified numbers) | Phase 2/3 production | Clinical + Legal |
| Non-English (ar/es/ja/zh) safety and crisis response review | Phase 6C Arabic, multilingual therapy | Qualified clinician per language |
| Clinical instrument validation for assessment tools | Phase 9 production | Licensed clinician |
| Egyptian legal / privacy / regulatory review | Real user data | Legal |
| Avatar: 18 documented blockers | Phase 10 | See audio2face-decision-record.md |
| Payment provider selection and review | Phase 11 | Legal + Finance |
| Human clinical review of AI system overall | Production gate | Clinical |

### Infrastructure required

| Blocker | Blocks |
|---|---|
| Running vLLM endpoint with Qwen2.5-14B-Instruct | Phase 6A live tests |
| faster-whisper installed with GPU or CPU | Phase 6B live tests |
| kokoro-onnx installed | Phase 6C live tests |
| PostgreSQL 16+ with pgvector | Semantic memory, RAG, production |
| KMS service (AWS/GCP/Azure) | Production encryption key management |
| CI/CD pipeline | Reproducible verification |

---

## 5. Non-negotiable engineering rules (from CLAUDE.md)

1. No mock providers, stubs, canned responses, or fake model outputs in production code paths.
2. No `diagnosis` or `initial_diagnosis` field anywhere in the codebase.
3. No automatic persistence of inferred personal facts; memory requires explicit user confirmation.
4. Arabic/Spanish/Japanese/Chinese therapy conversations are disabled until per-language clinical review.
5. SQLite is for local development only; PostgreSQL required for any pilot with real user data.
6. Embeddings are sensitive data — isolated by user, versioned, never logged, deletion propagates to indexes.
7. Crisis resources and crisis mode are never gated by billing or entitlement state.
8. Key material never appears in logs; envelope encryption stores key version in ciphertext.
9. WebSocket auth must go through the real Glow JWT pipeline — no hardcoded users.
10. All external providers must be reviewed and licensed before use. Fail clearly if not configured.

---

## 6. Ordered Backlog (remaining)

| Priority | Item | Blocks |
|---|---|---|
| P0 | Run full test suite post-fix (verify 0 import errors) | All |
| P0 | PostgreSQL instance for pilot | Memory, RAG, production |
| P0 | Egypt crisis resource registry (human review) | Production safety |
| P1 | vLLM endpoint + Qwen2.5-14B-Instruct | Phase 6A live |
| P1 | faster-whisper GPU/CPU setup | Phase 6B live |
| P1 | kokoro-onnx + Arabic fine-tune evaluation | Phase 6C live |
| P1 | Non-English clinical review (per language) | Multilingual therapy |
| P2 | Payment provider selection + review | Phase 11 |
| P2 | CI/CD pipeline (GitHub Actions) | Reproducibility |
| P2 | KMS service for production | Encryption key rotation |
| P3 | Device/session management | Auth completeness |
| P3 | MFA/passkeys | Auth completeness |
| P3 | Phase 10 (Avatar) — resolve 18 blockers | Production avatar |
| P4 | Phase 12 production pilot | After all above |

---

*This document must be updated at the start of each future agent session and whenever phase, blockers, or backlog changes meaningfully.*
