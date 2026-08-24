# Glow threat model baseline

## Status and scope

Phase 0 baseline, 2026-08-24. This is an initial design threat model for the non-sensitive health-check scaffold and the planned text-only safety architecture. It is not a security certification, privacy impact assessment, or legal assessment.

## Assets and trust boundaries

| Asset | Sensitivity | Required boundary |
| --- | --- | --- |
| User account and consent records | Sensitive personal data | Server-side authorization, versioned/revocable consent, audited changes |
| Conversation content and summaries | Highly sensitive mental-health data | Encryption, minimization, retention/deletion enforcement, no ordinary logs |
| Safety decisions and audit events | Restricted safety data | Structured, access-controlled, immutable audit store; no raw transcript copies |
| Crisis-resource registry | Safety-critical operational data | Accountable owner, provenance, verification date, versioned publication |
| Model/provider credentials | Secret | Server-side secret manager only; never browser, source, or fixture |
| Billing/entitlement records | Financial/personal data | Server-side computation and authenticated, idempotent webhooks |

## Priority threats and baseline mitigations

| Threat | Impact | Baseline mitigation | Validation gate |
| --- | --- | --- | --- |
| Client controls safety or billing fields | Unsafe response or unauthorized access | Server authoritative decisions; validate every external input | API and authorization tests |
| Prompt injection bypasses safety | Harmful output reaches user | Deterministic pre/post-generation control plane and crisis FSM outside prompts | Adversarial regression suite |
| Model/provider outage | Silent or misleading failure | Deterministic human-help fallback and crisis-resource access | Dependency-down tests |
| Raw transcript in logs/errors | Severe privacy exposure | Redacted structured observability; prohibit raw content in standard logs | Logging tests and code review |
| Consent is missing or stale | Improper sensitive-data processing | Versioned, purpose-specific, revocable server-side consent | Integration tests before persistence |
| Compromised session/token | Account and conversation exposure | Short-lived tokens, server-side authorization, device/session controls | Auth tests and security review |
| Unverified crisis-resource data | Unsafe emergency guidance | Maintained, locale-specific registry; no model-generated resources | Registry provenance and review |
| Free-tier development data misuse | Sensitive data exposure | Synthetic-data-only restriction enforced operationally and documented | Deployment review |
| Dependency compromise | Supply-chain exposure | Pin/lock dependencies, license/security review, CI scanning | Lock-file review and CI |

## Current implementation exposure

The current API exposes only `GET /healthz` and has no database, authentication, content, or provider integration. It deliberately disables generated API documentation routes to reduce unnecessary public surface during the baseline. This limited scope is not a substitute for the controls above.

## Required revisions

Revisit this document before each phase, at provider selection, before any real-data environment, and after any material incident or architecture change. Phase 1 must add authentication/consent threat scenarios; Phase 2/3 must add content handling, safety-control, model gateway, and crisis override scenarios.

