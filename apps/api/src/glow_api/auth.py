"""
Provider-neutral authentication boundary for Glow.

This module defines the *interface* for authentication — what a valid
authenticated principal looks like, how tokens are validated, how devices
are tracked — without committing to any specific auth provider (Auth0,
Supabase, AWS Cognito, in-house JWT, etc.).

Architecture decisions embedded here (CLAUDE.md §4, ADR 0001):
 - The server is always authoritative. Clients are never trusted for identity,
   entitlement, safety tier, or billing state.
 - All auth logic is behind this adapter; no route handler imports an
   auth-provider SDK directly.
 - Tokens are short-lived. Refresh, device management, and MFA are
   server-side concerns, not client-side.
 - Every privileged operation is re-validated server-side even if the token
   carries claims.

Provider selection is DEFERRED (ADR 0001 §Deferred decisions). Until a
provider is reviewed, tested, and approved:
 - The auth adapter returns an ``AuthProvider.unconfigured()`` state.
 - Routes requiring authentication will raise ``ProviderNotConfiguredError``.
 - No fake credentials, no mock tokens in production paths.
 - Tests use the ``FakeAuthProvider`` test double defined in
   ``tests/helpers/auth.py`` — never in production code.

To integrate a real provider:
 1. Record the decision in a new ADR under ``docs/adr/``.
 2. Implement a concrete ``AuthProvider`` subclass in a provider-specific
    module (e.g., ``glow_api/auth_providers/supabase.py``).
 3. Wire it through ``Settings.auth_provider`` and update ``.env.example``.
 4. Add integration tests with a real (sandboxed) provider account.
 5. Review the provider's privacy terms, data retention, regional processing,
    training-use policy, and any required DPA/BAA before go-live.
"""

from __future__ import annotations

import abc
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Protocol


# ---------------------------------------------------------------------------
# Identity types
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class AuthPrincipal:
    """A verified, server-confirmed user identity.

    This object is constructed *only* by the auth adapter after validating
    a request token.  It must never be constructed from client-supplied data
    in a route handler.

    Fields:
        user_id: Opaque, server-assigned user identifier.  Never an email or
                 phone number.
        issued_at: When the underlying token was issued (UTC).
        expires_at: When the underlying token expires (UTC).
        device_id: Opaque identifier for the authenticated device/session.
                   Used for session tracking and revocation.
        is_adult_confirmed: True iff the user's 18+ age has been confirmed by
                            the auth or onboarding flow.  Must be False for
                            new/unconfirmed accounts.
        scopes: Frozenset of granted scopes for this token.
    """

    user_id: str
    issued_at: datetime
    expires_at: datetime
    device_id: str
    is_adult_confirmed: bool = False
    scopes: frozenset[str] = field(default_factory=frozenset)

    @property
    def is_expired(self) -> bool:
        """Return True if the token has expired."""
        return datetime.now(UTC) >= self.expires_at

    def has_scope(self, scope: str) -> bool:
        """Return True if this principal holds the named scope."""
        return scope in self.scopes


# ---------------------------------------------------------------------------
# Token introspection result
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class TokenValidationResult:
    """Result of validating a bearer token.

    ``valid`` is True only if the token is cryptographically valid,
    unexpired, not revoked, and maps to a known user.
    ``principal`` is None when ``valid`` is False.
    ``error_reason`` is a safe-to-log (non-sensitive) reason string when
    ``valid`` is False.
    """

    valid: bool
    principal: AuthPrincipal | None = None
    error_reason: str | None = None


# ---------------------------------------------------------------------------
# Abstract auth provider
# ---------------------------------------------------------------------------


class AuthProvider(abc.ABC):
    """Abstract base class for all authentication provider adapters.

    Implement one concrete subclass per provider.  Register the active
    provider through ``Settings`` — never via a hard-coded import in a
    route or middleware.
    """

    @abc.abstractmethod
    async def validate_token(self, raw_token: str) -> TokenValidationResult:
        """Validate a bearer token from an incoming request.

        Must be called on every protected request.  Must not cache results
        beyond the token's own lifetime.  Must handle:
         - Expired tokens (return valid=False, error_reason="token_expired")
         - Unknown / tampered tokens
         - Revoked tokens (if the provider supports revocation checks)

        Args:
            raw_token: The raw bearer token string from the Authorization
                       header (without the "Bearer " prefix).

        Returns:
            A ``TokenValidationResult``.  Never raises on a bad token —
            always returns valid=False.
        """

    @abc.abstractmethod
    async def revoke_token(self, raw_token: str) -> None:
        """Revoke a token (sign-out).  Best-effort; log failures."""

    @property
    @abc.abstractmethod
    def is_configured(self) -> bool:
        """Return True iff this provider has been configured and can validate tokens."""


# ---------------------------------------------------------------------------
# Unconfigured sentinel
# ---------------------------------------------------------------------------


class UnconfiguredAuthProvider(AuthProvider):
    """Sentinel provider used when no auth provider has been selected yet.

    Returns explicit "not configured" errors so that accidental calls to
    protected routes fail loudly rather than silently.  This must never be
    used in production — it exists only so that the application can start
    and the health endpoint can respond before a provider is integrated.
    """

    @property
    def is_configured(self) -> bool:
        return False

    async def validate_token(self, raw_token: str) -> TokenValidationResult:
        return TokenValidationResult(
            valid=False,
            error_reason="Auth provider not configured. See docs/adr/0001-initial-stack.md.",
        )

    async def revoke_token(self, raw_token: str) -> None:
        pass  # No-op; nothing to revoke.


# ---------------------------------------------------------------------------
# FastAPI dependency helper protocol
# ---------------------------------------------------------------------------


class BearerTokenExtractor(Protocol):
    """Protocol for the callable that extracts a bearer token from a request.

    Implemented by the FastAPI HTTPBearer dependency or a test double.
    Returning None means no token was supplied.
    """

    async def __call__(self, *, authorization: str | None) -> str | None:
        ...
