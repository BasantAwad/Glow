"""
Typed error hierarchy for Glow API.

All API errors use structured types so that:
 - Handler code can route error types to HTTP status codes deterministically.
 - Log emission can strip sensitive fields before writing to ordinary logs.
 - Safety, auth, and billing errors are never silently swallowed.
 - No raw therapy content, user identifiers, or auth credentials appear in
   error messages surfaced to clients or written to standard logs.

Do not use Python's built-in RuntimeError, ValueError, or KeyError directly
in route handlers — raise a GlowError subclass and let the registered
exception handler convert it.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any


class ErrorCode(StrEnum):
    """Machine-readable error codes returned in API error responses."""

    # --- Authentication and identity ---
    UNAUTHENTICATED = "unauthenticated"
    INVALID_TOKEN = "invalid_token"
    TOKEN_EXPIRED = "token_expired"
    FORBIDDEN = "forbidden"
    ADULT_AGE_REQUIRED = "adult_age_required"

    # --- Consent ---
    CONSENT_REQUIRED = "consent_required"
    CONSENT_VERSION_STALE = "consent_version_stale"
    CONSENT_PURPOSE_NOT_GRANTED = "consent_purpose_not_granted"

    # --- User / preferences ---
    USER_NOT_FOUND = "user_not_found"
    USER_ALREADY_EXISTS = "user_already_exists"
    PREFERENCE_INVALID = "preference_invalid"

    # --- Session ---
    SESSION_NOT_FOUND = "session_not_found"
    SESSION_ALREADY_CLOSED = "session_already_closed"
    SESSION_LIMIT_REACHED = "session_limit_reached"
    SESSION_INTERRUPTED = "session_interrupted"

    # --- Safety ---
    SAFETY_CHECK_FAILED = "safety_check_failed"
    CRISIS_OVERRIDE_ACTIVE = "crisis_override_active"

    # --- Model / provider ---
    PROVIDER_UNAVAILABLE = "provider_unavailable"
    PROVIDER_NOT_CONFIGURED = "provider_not_configured"

    # --- Billing ---
    ENTITLEMENT_REQUIRED = "entitlement_required"
    BILLING_PROVIDER_NOT_CONFIGURED = "billing_provider_not_configured"

    # --- Data / storage ---
    DELETION_FAILED = "deletion_failed"

    # --- General ---
    VALIDATION_ERROR = "validation_error"
    INTERNAL_ERROR = "internal_error"
    NOT_IMPLEMENTED = "not_implemented"


class GlowError(Exception):
    """Base class for all Glow application errors.

    Subclasses must not include raw therapy content, raw user IDs, auth
    tokens, or credentials in the ``detail`` field — that field is safe to
    log and may reach API response bodies.
    """

    def __init__(
        self,
        code: ErrorCode,
        detail: str,
        *,
        http_status: int = 500,
        safe_for_client: bool = True,
        extra: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(detail)
        self.code = code
        self.detail = detail
        self.http_status = http_status
        # If False, the handler must substitute a generic message for the client.
        self.safe_for_client = safe_for_client
        # Structured metadata safe to include in structured logs (no PII).
        self.extra: dict[str, Any] = extra or {}

    def __repr__(self) -> str:
        return f"{type(self).__name__}(code={self.code!r}, http={self.http_status})"


class AuthenticationError(GlowError):
    """The request lacks valid authentication credentials."""

    def __init__(self, code: ErrorCode = ErrorCode.UNAUTHENTICATED, detail: str = "Authentication required.") -> None:
        super().__init__(code, detail, http_status=401)


class AuthorizationError(GlowError):
    """The authenticated principal is not permitted to perform the action."""

    def __init__(self, code: ErrorCode = ErrorCode.FORBIDDEN, detail: str = "Access denied.") -> None:
        super().__init__(code, detail, http_status=403)


class ConsentError(GlowError):
    """A required consent has not been given or has been revoked."""

    def __init__(self, code: ErrorCode = ErrorCode.CONSENT_REQUIRED, detail: str = "Required consent not recorded.", *, purpose: str | None = None) -> None:
        super().__init__(code, detail, http_status=403, extra={"purpose": purpose} if purpose else {})


class AgeGatingError(GlowError):
    """The user does not meet the adult (18+) age requirement."""

    def __init__(self) -> None:
        super().__init__(
            ErrorCode.ADULT_AGE_REQUIRED,
            "Glow is available for adults aged 18 and over only.",
            http_status=403,
        )


class NotFoundError(GlowError):
    """A requested resource was not found."""

    def __init__(self, code: ErrorCode = ErrorCode.USER_NOT_FOUND, detail: str = "Resource not found.") -> None:
        super().__init__(code, detail, http_status=404)


class SessionError(GlowError):
    """A session lifecycle error."""

    def __init__(self, code: ErrorCode, detail: str) -> None:
        super().__init__(code, detail, http_status=409)


class ProviderNotConfiguredError(GlowError):
    """An external provider (model, auth, billing, etc.) is not yet configured."""

    def __init__(self, provider: str) -> None:
        super().__init__(
            ErrorCode.PROVIDER_NOT_CONFIGURED,
            f"Provider '{provider}' is not configured. Contact an administrator.",
            http_status=503,
            extra={"provider": provider},
        )


class SafetyError(GlowError):
    """A safety check prevented the requested action."""

    def __init__(self, code: ErrorCode = ErrorCode.SAFETY_CHECK_FAILED, detail: str = "Safety check failed.") -> None:
        # Safety errors are deliberately not detailed to the client.
        super().__init__(code, detail, http_status=422, safe_for_client=False)


class ValidationError(GlowError):
    """Input validation failed."""

    def __init__(self, detail: str) -> None:
        super().__init__(ErrorCode.VALIDATION_ERROR, detail, http_status=422)


class DeletionError(GlowError):
    """A data deletion operation failed or partially failed."""

    def __init__(self, detail: str) -> None:
        super().__init__(ErrorCode.DELETION_FAILED, detail, http_status=500, safe_for_client=False)
