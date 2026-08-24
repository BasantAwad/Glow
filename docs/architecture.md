# Glow architecture baseline

## Status

Phase 0 baseline, 2026-08-24. This document describes an approved target architecture and the currently implemented non-sensitive health-check skeleton. It does not claim that the safety, consent, persistence, voice, avatar, billing, or provider integrations are implemented.

## Repository topology

```text
apps/
  api/   Python 3.13+ FastAPI service
  web/   Next.js strict-TypeScript application
docs/    ADRs, architecture, safety, privacy, and operational documentation
```

The repository is a monorepo with independently installable backend and frontend packages. npm workspaces manage the web package; the Python package uses `pyproject.toml` and an isolated virtual environment.

## Baseline request boundary

```text
Browser -> Next.js web client -> FastAPI API -> future server-side services
```

The only implemented server endpoint is `GET /healthz`. It returns process status, service name, and environment only. It does not accept user content, authenticate users, connect to a database, use a model, or emit analytics.

## Target safety boundary

Future text turns must follow this server-authoritative sequence:

```text
authenticated request + recorded consent
  -> pre-generation risk detection
  -> session/policy selection and approved retrieval
  -> constrained generation through the model gateway
  -> post-generation validator
  -> crisis-FSM override or approved delivery
  -> structured, privacy-preserving audit event
```

The browser is a presentation layer. It may render server results but must never determine consent, risk tier, crisis state, entitlement, or whether a response is safe to deliver.

## Data boundaries

- PostgreSQL is the future system of record for transactional data and approved evidence metadata.
- `pgvector` is reserved for the approved evidence retrieval store, never an ungoverned transcript dump.
- Redis-compatible storage is limited to ephemeral state, queues, coordination, and rate limiting.
- No raw audio/video is retained by default. Pilot transcripts are planned to use encrypted 30-day retention and immediate deletion controls only after Phase 1/Phase 6 data controls exist.
- Free-tier development hosting may contain only synthetic data, clinician-authored examples, and non-sensitive development accounts.

## Deferred integrations

No model, speech, avatar, payment, authentication provider, real database, queue, or live crisis-resource provider is selected or connected. Every future external integration must pass the provider review defined in `CLAUDE.md` and ADR 0001 before handling sensitive content.

## References

- `CLAUDE.md` sections 3–5 and 10–12.
- `docs/adr/0001-initial-stack.md`.
- `docs/calmbridge_architecture.mmd` and `docs/calmbridge_session_sequence.mmd`.

