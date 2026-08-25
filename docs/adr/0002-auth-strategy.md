# ADR 0002 — Authentication Strategy: Glow-Owned Signed JWT

**Date:** 2026-08-25  
**Status:** Accepted  
**Deciders:** Glow engineering team

---

## Context

Every protected Glow endpoint requires a verified, server-authoritative identity. No development-only bypass, mock principal, stub JWT, or hardcoded user may appear in production code paths. The auth provider must fail clearly when unconfigured rather than silently returning an identity.

A third-party identity provider (Auth0, Supabase, AWS Cognito) has not yet been reviewed for:
- Egyptian data residency requirements
- Glow's data retention and deletion obligations
- Provider terms regarding sensitive health-support application data
- Commercial licensing and contractual DPA/BAA

Until that review is complete, using a third-party provider would either (a) block all development or (b) require a development-only bypass — which violates the no-mock policy.

---

## Decision

Implement a **Glow-owned HMAC-SHA256 signed JWT service** as the initial authentication provider.

### Properties

- **Algorithm:** HMAC-SHA256 (HS256)
- **Token lifetime:** 1 hour
- **Key material:** `GLOW_AUTH_SECRET_KEY` — hex-encoded 32-byte minimum key, loaded from environment only
- **Key rotation:** `GLOW_AUTH_SECRET_KEY_V2` — server accepts tokens signed by either key; issues new tokens with V2 key only
- **Claims:** `sub` (user_id), `iat`, `exp`, `jti` (unique token ID for revocation), `aud` ("glow-api"), `iss` ("glow")
- **No third-party dependency:** PyJWT (MIT) for token operations; no cloud SDK required
- **Fail behavior:** If `GLOW_AUTH_SECRET_KEY` is not set, all protected endpoints fail with `ProviderNotConfiguredError` (HTTP 503)
- **No development bypass:** There is no environment variable or code path that skips auth in "development" mode for production routes

### What this does NOT cover

- MFA / passkeys (deferred — blocking items listed below)
- Device management and per-device revocation (deferred)
- Refresh tokens (deferred)
- Third-party OAuth / social login (deferred until provider review)

---

## Token issuance

Token issuance is handled by `POST /auth/token` — a server-side endpoint that accepts verified credentials (initially, user_id + optional device_id for development/testing) and returns a signed JWT. This endpoint is rate-limited by IP.

**In production:** This endpoint must be replaced by or integrated with an approved identity provider flow (e.g. phone OTP, email magic link, or OAuth). The server-side auth library is abstracted so the token format remains consistent regardless of the upstream identity flow.

---

## Consequences

- All protected endpoints work immediately with a configured key
- No third-party provider review required before development proceeds
- Key rotation works without service restart (V2 accepts both keys)
- Migration to a third-party provider replaces only `glow_api/auth_providers/glow_jwt.py` and the token issuance endpoint; all downstream auth logic (`get_auth_principal`, `get_current_user`, etc.) is unchanged
- Risk: HMAC-based tokens cannot be individually revoked without a server-side revocation list. This is acceptable for Phase 1 development and pilot; a revocation store (Redis-backed JTI blocklist) must be added before production.

---

## Deferred decisions

| Decision | Gate |
|---|---|
| Third-party identity provider selection | After provider privacy/residency/DPA review |
| Per-device token revocation (JTI blocklist) | Before production launch |
| MFA / passkeys | Before production launch |
| Refresh tokens | Before production launch |

---

## Compliance notes

- Token payload must never contain therapy content, diagnosis, or unredacted PII
- Key material must never appear in any log line
- Token claims (`sub`) use opaque user IDs, never emails or phone numbers
- `jti` enables future revocation list integration without breaking existing tokens
