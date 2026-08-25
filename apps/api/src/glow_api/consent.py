"""
Typed, server-authoritative consent model for Glow.

Consent is granular, versioned, and revocable — it must never be inferred
from client-supplied fields.  Every purpose that allows sensitive data
processing has its own flag.  The consent record is the server's source of
truth; the client may present it but never compute it.

These types are pure Python with no database dependency so that they can
be unit-tested, evaluated, and reasoned about in complete isolation from
any persistence or authentication layer.  The persistence layer (Phase 1,
after provider selection) will map these types to database columns via
SQLAlchemy models.

CLAUDE.md §7 privacy and data governance rules apply throughout:
 - Data minimisation and purpose limitation.
 - Separate, revocable per-purpose consent.
 - No raw therapy content in logs.
 - No training/research use without explicit separate opt-in.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from enum import Enum
from typing import Annotated

from pydantic import BaseModel, Field, field_validator, model_validator

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Increment this whenever the consent schema (field names, semantics, or
# defaults) changes.  A stored record with a lower version than the current
# policy version requires re-solicitation before the affected purpose is used.
CONSENT_POLICY_VERSION: str = "consent-policy-v0"

# Maximum allowed length for a free-form locale tag to prevent injection.
_MAX_LOCALE_LEN: int = 20

# Simple BCP 47 locale pattern: language[-region[-variant]] e.g. "en", "ar-EG".
_LOCALE_RE: re.Pattern[str] = re.compile(
    r"^[a-z]{2,3}(?:-[A-Za-z]{2,4}(?:-[A-Za-z0-9]{5,8})*)?$"
)


# ---------------------------------------------------------------------------
# Purpose enumeration
# ---------------------------------------------------------------------------


class ConsentPurpose(str, Enum):
    """Enumeration of every purpose for which Glow may process user data.

    Each value corresponds to a separately revocable opt-in.  These must not
    be bundled — users must be able to refuse any individual purpose without
    losing access to the core service (where legally required) or having their
    crisis resources blocked (always).
    """

    # Required for core service operation (AI support interaction).
    SERVICE_USE = "service_use"

    # Retaining encrypted session transcripts for session-continuity and
    # clinician-shareable summary.  Default: on, 30-day retention (ADR 0001).
    TRANSCRIPT_RETENTION = "transcript_retention"

    # Retaining microphone audio beyond transcription.  Default: off.
    AUDIO_STORAGE = "audio_storage"

    # Retaining camera / avatar session video.  Default: off.
    VIDEO_STORAGE = "video_storage"

    # Generating and storing session summaries.
    SESSION_SUMMARY = "session_summary"

    # Using conversation context for within-user personalisation (not training).
    PERSONALISATION = "personalisation"

    # Using de-identified data for research or model improvement.
    # Default: off; must never be bundled with service_use.
    RESEARCH_AND_MODEL_IMPROVEMENT = "research_and_model_improvement"

    # Storing inferred personal facts (long-term memory) across sessions.
    # Default: off.  Separate opt-in required (ADR 0004).
    # When revoked, all memory items and their embeddings must be deleted.
    MEMORY_CONSENT = "memory_consent"


# ---------------------------------------------------------------------------
# Consent record
# ---------------------------------------------------------------------------


class ConsentRecord(BaseModel):
    """A complete, point-in-time snapshot of a user's consent state.

    This record is immutable once created — consent changes produce a new
    record with an incremented version and an updated timestamp.  The
    persistence layer must store the full history, not overwrite it, so that
    the source-of-truth audit trail is complete.

    The server is always authoritative.  No client field may determine whether
    a purpose is consented; client data may only carry a user's expressed
    preference which the server then validates and records.
    """

    model_config = {"frozen": True}

    # The user this record belongs to.  Stored as an opaque server-assigned
    # identifier; never the raw email or phone number.
    user_id: Annotated[str, Field(min_length=1, max_length=128)]

    # Monotonically increasing integer within this user's consent history.
    # Version 1 is the initial consent.  This must never be set by a client.
    record_version: Annotated[int, Field(ge=1)]

    # ISO 8601 UTC timestamp of when this record was created.
    recorded_at: datetime

    # The policy version in effect when this record was created.
    policy_version: Annotated[str, Field(min_length=1, max_length=64)] = (
        CONSENT_POLICY_VERSION
    )

    # BCP 47 locale in which consent was presented.  The server must use this
    # to determine whether the localised disclosure was current.
    locale_presented: Annotated[str, Field(min_length=2, max_length=_MAX_LOCALE_LEN)]

    # Per-purpose opt-in flags.  All default to the most privacy-protective
    # setting consistent with service operation.
    service_use: bool = True
    transcript_retention: bool = True
    audio_storage: bool = False
    video_storage: bool = False
    session_summary: bool = True
    personalisation: bool = False
    research_and_model_improvement: bool = False
    # Memory consent (ADR 0004) — separate opt-in, never bundled with service_use.
    # When False, no memory items may be stored or retrieved for this user.
    # When revoked (changed from True to False), deletion of all memory items
    # and their embeddings must be triggered by the server before responding.
    memory_consent: bool = False

    @field_validator("locale_presented")
    @classmethod
    def validate_locale(cls, value: str) -> str:
        """Reject locale tags that do not match BCP 47 pattern."""
        if not _LOCALE_RE.match(value):
            raise ValueError(
                f"locale_presented must be a BCP 47 locale tag (e.g. 'en', 'ar-EG'); "
                f"got {value!r}"
            )
        return value

    @field_validator("recorded_at")
    @classmethod
    def validate_utc(cls, value: datetime) -> datetime:
        """Require a timezone-aware UTC datetime."""
        if value.tzinfo is None:
            raise ValueError("recorded_at must be timezone-aware (UTC).")
        return value

    @model_validator(mode="after")
    def validate_service_use_required(self) -> "ConsentRecord":
        """Service-use consent is required for any data to flow through the system.

        This validation exists so that any code path that creates a ConsentRecord
        without service_use=True fails loudly.  The server must never construct a
        valid ConsentRecord from a user who has not accepted service-use terms.
        """
        if not self.service_use:
            raise ValueError(
                "service_use must be True; a ConsentRecord without service-use "
                "consent must not be created — deny the session instead."
            )
        return self

    @model_validator(mode="after")
    def validate_audio_requires_transcript(self) -> "ConsentRecord":
        """Audio-storage consent requires transcript-retention consent.

        Audio data is more sensitive than text; retaining audio without the
        accompanying transcript would be inconsistent with the stated data
        minimisation purpose.
        """
        if self.audio_storage and not self.transcript_retention:
            raise ValueError(
                "audio_storage=True requires transcript_retention=True."
            )
        return self

    @model_validator(mode="after")
    def validate_video_requires_transcript(self) -> "ConsentRecord":
        """Video-storage consent requires transcript-retention consent."""
        if self.video_storage and not self.transcript_retention:
            raise ValueError(
                "video_storage=True requires transcript_retention=True."
            )
        return self

    def is_purpose_consented(self, purpose: ConsentPurpose) -> bool:
        """Return True iff the given purpose is currently consented.

        This is the canonical check that all session, policy, and data-flow
        logic must call.  It must never be bypassed or replicated inline.
        """
        mapping: dict[ConsentPurpose, bool] = {
            ConsentPurpose.SERVICE_USE: self.service_use,
            ConsentPurpose.TRANSCRIPT_RETENTION: self.transcript_retention,
            ConsentPurpose.AUDIO_STORAGE: self.audio_storage,
            ConsentPurpose.VIDEO_STORAGE: self.video_storage,
            ConsentPurpose.SESSION_SUMMARY: self.session_summary,
            ConsentPurpose.PERSONALISATION: self.personalisation,
            ConsentPurpose.RESEARCH_AND_MODEL_IMPROVEMENT: (
                self.research_and_model_improvement
            ),
            ConsentPurpose.MEMORY_CONSENT: self.memory_consent,
        }
        return mapping[purpose]


# ---------------------------------------------------------------------------
# Consent update request
# ---------------------------------------------------------------------------


class ConsentUpdateRequest(BaseModel):
    """A user-supplied request to change one or more consent flags.

    The server receives this object, validates it, and then constructs a new
    ConsentRecord (incrementing record_version and updating recorded_at).  The
    client may only send the fields it wishes to change; unchanged fields are
    carried forward from the latest stored record.

    The client must never supply record_version, recorded_at, policy_version,
    or user_id in a consent update request — those are server-assigned.
    """

    # Optional per-purpose changes.  A None value means "no change".
    transcript_retention: bool | None = None
    audio_storage: bool | None = None
    video_storage: bool | None = None
    session_summary: bool | None = None
    personalisation: bool | None = None
    research_and_model_improvement: bool | None = None
    memory_consent: bool | None = None

    # Locale in which the updated consent was presented.
    locale_presented: Annotated[str, Field(min_length=2, max_length=_MAX_LOCALE_LEN)]

    @field_validator("locale_presented")
    @classmethod
    def validate_locale(cls, value: str) -> str:
        if not _LOCALE_RE.match(value):
            raise ValueError(
                f"locale_presented must be a BCP 47 locale tag; got {value!r}"
            )
        return value


# ---------------------------------------------------------------------------
# Consent application logic
# ---------------------------------------------------------------------------


def apply_consent_update(
    current: ConsentRecord,
    update: ConsentUpdateRequest,
    now: datetime | None = None,
) -> ConsentRecord:
    """Return a new ConsentRecord that applies *update* to *current*.

    Args:
        current: The user's latest stored consent record.
        update: The server-validated update request.
        now: UTC timestamp for the new record; defaults to datetime.now(UTC).
              Passing an explicit value makes the function deterministically
              testable.

    Returns:
        A new frozen ConsentRecord with record_version incremented by 1 and
        all changed purposes applied.

    Raises:
        ValueError: If the resulting record would be invalid (e.g. audio
                    storage without transcript retention).
    """
    recorded_at = now if now is not None else datetime.now(timezone.utc)

    def _pick(new_val: bool | None, old_val: bool) -> bool:
        return new_val if new_val is not None else old_val

    return ConsentRecord(
        user_id=current.user_id,
        record_version=current.record_version + 1,
        recorded_at=recorded_at,
        policy_version=CONSENT_POLICY_VERSION,
        locale_presented=update.locale_presented,
        service_use=current.service_use,  # service_use is never reduced by update
        transcript_retention=_pick(
            update.transcript_retention, current.transcript_retention
        ),
        audio_storage=_pick(update.audio_storage, current.audio_storage),
        video_storage=_pick(update.video_storage, current.video_storage),
        session_summary=_pick(update.session_summary, current.session_summary),
        personalisation=_pick(update.personalisation, current.personalisation),
        research_and_model_improvement=_pick(
            update.research_and_model_improvement,
            current.research_and_model_improvement,
        ),
        memory_consent=_pick(update.memory_consent, current.memory_consent),
    )


def make_initial_consent(
    user_id: str,
    locale_presented: str,
    now: datetime | None = None,
    *,
    transcript_retention: bool = True,
    audio_storage: bool = False,
    video_storage: bool = False,
    session_summary: bool = True,
    personalisation: bool = False,
    research_and_model_improvement: bool = False,
    memory_consent: bool = False,
) -> ConsentRecord:
    """Construct the first ConsentRecord for a new user.

    The defaults are the most privacy-protective settings consistent with
    core service operation (ADR 0001, CLAUDE.md §7).  A caller may override
    individual flags only if the user has explicitly opted in within the same
    onboarding flow.

    Args:
        user_id: Server-assigned opaque user identifier.
        locale_presented: BCP 47 locale in which the consent flow was shown.
        now: UTC timestamp; defaults to datetime.now(UTC).
        transcript_retention: Whether the user accepted transcript retention.
        audio_storage: Whether the user explicitly opted into audio retention.
        video_storage: Whether the user explicitly opted into video retention.
        session_summary: Whether the user accepted session-summary generation.
        personalisation: Whether the user opted into personalisation.
        research_and_model_improvement: Whether the user opted into research use.
        memory_consent: Whether the user opted into long-term memory (ADR 0004).

    Returns:
        A frozen ConsentRecord at record_version=1.
    """
    recorded_at = now if now is not None else datetime.now(timezone.utc)
    return ConsentRecord(
        user_id=user_id,
        record_version=1,
        recorded_at=recorded_at,
        policy_version=CONSENT_POLICY_VERSION,
        locale_presented=locale_presented,
        service_use=True,
        transcript_retention=transcript_retention,
        audio_storage=audio_storage,
        video_storage=video_storage,
        session_summary=session_summary,
        personalisation=personalisation,
        research_and_model_improvement=research_and_model_improvement,
        memory_consent=memory_consent,
    )
