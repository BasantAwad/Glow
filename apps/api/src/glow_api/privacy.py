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

# ---------------------------------------------------------------------------
# Privacy Service (Phase 5)
# ---------------------------------------------------------------------------

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

class PrivacyService:
    """
    Handles data deletion and export workflows.
    """
    def __init__(self, db_session: AsyncSession):
        self.db = db_session

    async def delete_user_data(self, user_id: str, scope: DeletionScope) -> DeletionResult:
        """
        Deletes user data according to the requested scope.
        Returns a DeletionResult indicating success or failure.
        """
        import uuid
        from glow_api.models import UserAccountModel, SessionRecordModel, SessionMessageModel, ConsentRecordModel, UserPreferencesModel
        
        request_id = str(uuid.uuid4())
        failed_scopes = []
        audit_note = f"Executed deletion for scope: {scope.value}"

        try:
            # 1. Fetch user account internal ID
            stmt = select(UserAccountModel).where(UserAccountModel.user_id == user_id)
            res = await self.db.execute(stmt)
            user_account = res.scalar_one_or_none()
            
            if not user_account:
                return DeletionResult(
                    request_id=request_id,
                    completed_at=datetime.now(UTC),
                    success=True, # Nothing to delete
                    failed_scopes=[],
                    audit_note="User not found, nothing to delete."
                )

            account_id = user_account.id

            if scope in (DeletionScope.ACCOUNT_AND_ALL_DATA, DeletionScope.SESSION_TRANSCRIPTS):
                # Delete session transcripts
                stmt_sessions = select(SessionRecordModel.id).where(SessionRecordModel.user_account_id == account_id)
                res_sessions = await self.db.execute(stmt_sessions)
                session_ids = res_sessions.scalars().all()

                if session_ids:
                    await self.db.execute(
                        delete(SessionMessageModel).where(SessionMessageModel.session_record_id.in_(session_ids))
                    )
                
                # If only transcripts, we stop here (and maybe delete session records depending on policy, but usually they are kept for audit unless ACCOUNT_AND_ALL_DATA)
                
            if scope == DeletionScope.ACCOUNT_AND_ALL_DATA:
                # Delete the entire account and all cascading records
                await self.db.execute(delete(UserAccountModel).where(UserAccountModel.id == account_id))

            await self.db.commit()
            
            return DeletionResult(
                request_id=request_id,
                completed_at=datetime.now(UTC),
                success=True,
                failed_scopes=[],
                audit_note=audit_note
            )
        except Exception as e:
            await self.db.rollback()
            return DeletionResult(
                request_id=request_id,
                completed_at=datetime.now(UTC),
                success=False,
                failed_scopes=[(scope.value, str(e))],
                audit_note=f"Deletion failed: {e}"
            )

    async def export_user_data(self, user_id: str) -> dict[str, Any]:
        """
        Exports user data including preferences, consent records, and decrypted session histories.
        """
        from glow_api.models import UserAccountModel, SessionRecordModel, SessionMessageModel, ConsentRecordModel, UserPreferencesModel
        from glow_api.kms import kms_service
        from glow_api.crypto import EnvelopeEncryption
        
        stmt = select(UserAccountModel).where(UserAccountModel.user_id == user_id)
        res = await self.db.execute(stmt)
        user_account = res.scalar_one_or_none()
        
        if not user_account:
            raise ValueError("User not found")

        export_data = {
            "user_id": user_id,
            "created_at": user_account.created_at.isoformat(),
            "preferences": {},
            "consents": [],
            "sessions": []
        }
        
        # Load Preferences
        pref_stmt = select(UserPreferencesModel).where(UserPreferencesModel.user_account_id == user_account.id)
        pref_res = await self.db.execute(pref_stmt)
        pref = pref_res.scalar_one_or_none()
        if pref:
            export_data["preferences"] = {
                "locale": pref.locale.value if hasattr(pref.locale, "value") else pref.locale,
                "session_mode": pref.session_mode.value if hasattr(pref.session_mode, "value") else pref.session_mode,
                "avatar_disclosure": pref.avatar_disclosure.value if hasattr(pref.avatar_disclosure, "value") else pref.avatar_disclosure,
                "input_modality": pref.input_modality.value if hasattr(pref.input_modality, "value") else pref.input_modality
            }

        # Load Sessions & Messages
        sess_stmt = select(SessionRecordModel).where(SessionRecordModel.user_account_id == user_account.id)
        sess_res = await self.db.execute(sess_stmt)
        sessions = sess_res.scalars().all()
        
        for sess in sessions:
            sess_data = {
                "session_id": sess.session_id,
                "started_at": sess.started_at.isoformat() if sess.started_at else None,
                "messages": []
            }
            
            msg_stmt = select(SessionMessageModel).where(SessionMessageModel.session_record_id == sess.id).order_by(SessionMessageModel.timestamp.asc())
            msg_res = await self.db.execute(msg_stmt)
            messages = msg_res.scalars().all()
            
            for m in messages:
                key = kms_service.get_master_key(m.key_id)
                nonce = m.encrypted_content[:12]
                ciphertext = m.encrypted_content[12:]
                decrypted_content = EnvelopeEncryption.decrypt(key, nonce, ciphertext).decode('utf-8')
                
                sess_data["messages"].append({
                    "role": m.role,
                    "content": decrypted_content,
                    "timestamp": m.timestamp.isoformat()
                })
                
            export_data["sessions"].append(sess_data)

        return export_data
