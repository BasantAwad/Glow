"""
Privacy and data governance layer (Phase 4).

Implements:
 - Consent-aware access control: every data access is checked against the
   user's current consent record before proceeding.
 - Retention policy enforcement: records are tagged with their retention
   schedule; an enforcer can expire/delete them.
 - Deletion and export workflow types.
 - Redacted log helper (redacts PII from log lines before emission).
 - Secret-management interface (provider-neutral; no real secrets here).
 - Rate limiting policy (provider-neutral; implementation deferred).
 - Operational vs. research data separation.

Data governance rules (CLAUDE.md §7):
 - Raw audio/video is disabled and non-retained by default.
 - No research/training use without explicit, separate opt-in.
 - Deletion requests are honoured within policy limits; failures are surfaced.
 - Logs must not contain raw therapy content, credentials, or unredacted PII.
 - The audit store is access-controlled and separate from standard logs.
 - No claim of HIPAA, GDPR, or Egyptian-law compliance is made here.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Any

from glow_api.consent import ConsentPurpose, ConsentRecord


# ---------------------------------------------------------------------------
# Retention policy
# ---------------------------------------------------------------------------


class RetentionTier(StrEnum):
    """Data retention categories.

    SHORT_EPHEMERAL — Seconds to minutes; for in-flight session buffers.
    SESSION         — Retained for session_retention_days (default: 30 days).
    USER_ACCOUNT    — Retained while account is active + 30 days post-deletion.
    AUDIT_RESTRICTED — Retained for audit_retention_days (default: 7 years)
                       in restricted store.  Access is role-gated.
    RESEARCH        — Only for data where research consent was given and
                      proper data governance is in place.  Separate store.
    """

    SHORT_EPHEMERAL = "short_ephemeral"
    SESSION = "session"
    USER_ACCOUNT = "user_account"
    AUDIT_RESTRICTED = "audit_restricted"
    RESEARCH = "research"


@dataclass(frozen=True)
class RetentionPolicy:
    """Retention schedule for a piece of data.

    Fields:
        tier:               Retention category.
        expires_at:         Absolute UTC timestamp after which the data
                            must be deleted.  None for indefinite (audit tier).
        purpose:            The consent purpose that authorises this data.
        can_be_exported:    Whether this data can be included in a data export.
        requires_deletion:  True if this data must be deleted on account
                            deletion or consent revocation.
    """

    tier: RetentionTier
    expires_at: datetime | None
    purpose: ConsentPurpose
    can_be_exported: bool
    requires_deletion: bool

    @property
    def is_expired(self) -> bool:
        if self.expires_at is None:
            return False
        return datetime.now(UTC) >= self.expires_at


DEFAULT_SESSION_RETENTION_DAYS: int = 30


def session_retention_policy(consent: ConsentRecord) -> RetentionPolicy:
    """Compute the retention policy for session transcript data.

    If transcript_retention consent is False, data must not be retained
    beyond the session itself (ephemeral).
    """
    if not consent.transcript_retention:
        return RetentionPolicy(
            tier=RetentionTier.SHORT_EPHEMERAL,
            expires_at=datetime.now(UTC) + timedelta(minutes=5),
            purpose=ConsentPurpose.TRANSCRIPT_RETENTION,
            can_be_exported=False,
            requires_deletion=True,
        )
    return RetentionPolicy(
        tier=RetentionTier.SESSION,
        expires_at=datetime.now(UTC) + timedelta(days=DEFAULT_SESSION_RETENTION_DAYS),
        purpose=ConsentPurpose.TRANSCRIPT_RETENTION,
        can_be_exported=True,
        requires_deletion=True,
    )


# ---------------------------------------------------------------------------
# Consent-aware access control
# ---------------------------------------------------------------------------


class ConsentAccessError(Exception):
    """Raised when a data access is not authorised by the consent record."""

    def __init__(self, purpose: ConsentPurpose) -> None:
        self.purpose = purpose
        super().__init__(
            f"Access denied: consent for purpose '{purpose}' has not been given "
            "or has been revoked."
        )


def require_consent(consent: ConsentRecord, purpose: ConsentPurpose) -> None:
    """Assert that the given purpose is consented; raise ConsentAccessError if not.

    Call this at every data access point before reading or writing
    purpose-restricted data.

    Args:
        consent: The user's current consent record.
        purpose: The purpose for which data is being accessed.

    Raises:
        ConsentAccessError: If consent for ``purpose`` is not recorded.
    """
    if not consent.is_purpose_consented(purpose):
        raise ConsentAccessError(purpose)


# ---------------------------------------------------------------------------
# Deletion workflow
# ---------------------------------------------------------------------------


class DeletionScope(StrEnum):
    """What should be deleted in a deletion request."""

    ACCOUNT_AND_ALL_DATA = "account_and_all_data"
    SESSION_TRANSCRIPTS = "session_transcripts"
    AUDIO_DATA = "audio_data"
    VIDEO_DATA = "video_data"
    RESEARCH_DATA = "research_data"


@dataclass(frozen=True)
class DeletionRequest:
    """A user-initiated deletion request.

    Fields:
        request_id:   Opaque server-assigned identifier.
        user_id:      Opaque user identifier.
        scope:        What is being deleted.
        requested_at: UTC timestamp.
        deadline_at:  When deletion must be complete (policy limit).
    """

    request_id: str
    user_id: str
    scope: DeletionScope
    requested_at: datetime
    deadline_at: datetime


@dataclass
class DeletionResult:
    """Result of processing a deletion request.

    Fields:
        request_id:      The request this result applies to.
        completed_at:    When deletion completed (None if not yet complete).
        success:         True iff all targeted data was deleted.
        failed_scopes:   List of (scope_name, reason) for any partial failure.
        audit_note:      Safe-to-store note for the audit log.
    """

    request_id: str
    completed_at: datetime | None
    success: bool
    failed_scopes: list[tuple[str, str]]
    audit_note: str


# ---------------------------------------------------------------------------
# Data export
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ExportRequest:
    """A user-initiated data export request (GDPR Article 20 / right to portability)."""

    request_id: str
    user_id: str
    requested_at: datetime
    include_transcripts: bool
    include_summaries: bool
    include_preferences: bool
    include_consent_history: bool


# ---------------------------------------------------------------------------
# Redacted log helper
# ---------------------------------------------------------------------------

# Patterns that indicate PII or sensitive content in log strings.
# These are conservative — false positives (extra redaction) are acceptable.
_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
_PHONE_RE = re.compile(r"\+?[\d][\d\s\-()]{7,}")
_JWT_RE = re.compile(r"eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+")
_UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.IGNORECASE)


def redact_log_line(line: str, *, redact_user_ids: bool = True) -> str:
    """Redact PII and sensitive tokens from a log line.

    Applies conservative redaction patterns.  Should be used as a
    pre-emission filter on all structured log fields.

    Args:
        line: Raw log line or field value.
        redact_user_ids: If True, also redact UUID-shaped user/session IDs.

    Returns:
        The redacted string.
    """
    line = _EMAIL_RE.sub("[REDACTED_EMAIL]", line)
    line = _PHONE_RE.sub("[REDACTED_PHONE]", line)
    line = _JWT_RE.sub("[REDACTED_JWT]", line)
    if redact_user_ids:
        line = _UUID_RE.sub("[REDACTED_ID]", line)
    return line


# ---------------------------------------------------------------------------
# Secret management interface (provider-neutral)
# ---------------------------------------------------------------------------


class SecretProvider:
    """Abstract interface for secret retrieval.

    Real implementations will use AWS Secrets Manager, GCP Secret Manager,
    Azure Key Vault, or HashiCorp Vault.  The concrete implementation is
    selected by the deployment configuration, never hardcoded.

    Until a provider is approved, this raises ProviderNotConfiguredError.
    """

    async def get_secret(self, secret_name: str) -> str:
        """Retrieve a secret by name.

        Raises:
            ProviderNotConfiguredError: Always (this is the unconfigured sentinel).
        """
        from glow_api.errors import ProviderNotConfiguredError
        raise ProviderNotConfiguredError(f"secret_manager:{secret_name}")


# ---------------------------------------------------------------------------
# Rate limiting policy (provider-neutral)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class RateLimitPolicy:
    """Rate limit configuration for an endpoint or operation.

    Applied by middleware; not enforced in this module.

    Fields:
        max_requests:   Maximum requests allowed in the window.
        window_seconds: Length of the rate limit window in seconds.
        burst:          Allowed burst above the sustained rate.
        key_by:         What to key the rate limit on ("user_id", "ip", "global").
    """

    max_requests: int
    window_seconds: int
    burst: int = 0
    key_by: str = "user_id"


# Standard rate limits.
RATE_LIMIT_API_DEFAULT = RateLimitPolicy(max_requests=60, window_seconds=60)
RATE_LIMIT_AUTH = RateLimitPolicy(max_requests=10, window_seconds=60, key_by="ip")
RATE_LIMIT_CONSENT_UPDATE = RateLimitPolicy(max_requests=5, window_seconds=60)
RATE_LIMIT_DELETION = RateLimitPolicy(max_requests=2, window_seconds=3600)


# ---------------------------------------------------------------------------
# Operational vs. research data separation
# ---------------------------------------------------------------------------


class DataStore(StrEnum):
    """Logical data store identifiers.

    OPERATIONAL   — Standard application data (users, sessions, consents).
    AUDIT         — Restricted audit log (safety events, auth events).
    RESEARCH      — Separately controlled research/training data store.
                    Only populated with data where research consent applies.
    """

    OPERATIONAL = "operational"
    AUDIT = "audit"
    RESEARCH = "research"


def data_store_for_purpose(purpose: ConsentPurpose) -> DataStore:
    """Return the appropriate data store for a given consent purpose."""
    mapping = {
        ConsentPurpose.SERVICE_USE: DataStore.OPERATIONAL,
        ConsentPurpose.TRANSCRIPT_RETENTION: DataStore.OPERATIONAL,
        ConsentPurpose.SESSION_SUMMARY: DataStore.OPERATIONAL,
        ConsentPurpose.PERSONALISATION: DataStore.OPERATIONAL,
        ConsentPurpose.AUDIO_STORAGE: DataStore.OPERATIONAL,
        ConsentPurpose.VIDEO_STORAGE: DataStore.OPERATIONAL,
        ConsentPurpose.RESEARCH_AND_MODEL_IMPROVEMENT: DataStore.RESEARCH,
    }
    return mapping[purpose]
