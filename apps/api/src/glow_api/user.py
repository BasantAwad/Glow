"""
User model and preferences for Glow.

This module defines the typed domain model for a Glow user account and
their preferences.  These are *pure Python types* — no database, no
SQLAlchemy, no provider SDK.  The persistence layer will map them to
database rows via SQLAlchemy ORM models once a database provider is
approved (Phase 1, post-ADR).

Design constraints (CLAUDE.md §7, §4):
 - Adult-only product.  ``is_adult_confirmed`` must be True before any
   session can start.
 - No session data flows without service-use consent on the consent record.
 - Language and persona preferences are user-owned and revocable.
 - The user object never carries raw auth tokens, passwords, or device IDs —
   those live in the auth layer.
 - User IDs are opaque server-assigned strings; never an email or phone.

Supported locales (pilot, Egypt-only, adults 18+ — ADR 0001):
  en, ar, es, ja, zh-Hans
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from typing import Annotated

from pydantic import BaseModel, Field, field_validator

# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

_LOCALE_RE = re.compile(r"^[a-z]{2,3}(?:-[A-Za-z]{2,4}(?:-[A-Za-z0-9]{5,8})*)?$")

# Supported pilot locales.  Extend with ADR before adding new languages.
PILOT_LOCALES: frozenset[str] = frozenset({"en", "ar", "es", "ja", "zh-Hans"})


class UserLocale(StrEnum):
    """Supported display and interaction locales (pilot set)."""

    EN = "en"
    AR = "ar"
    ES = "es"
    JA = "ja"
    ZH_HANS = "zh-Hans"


class SessionMode(StrEnum):
    """The interaction mode the user prefers for sessions.

    open_conversation — User-led; no structured agenda.
    guided_questions  — Facilitator-style; Glow asks reflective questions.
    """

    OPEN_CONVERSATION = "open_conversation"
    GUIDED_QUESTIONS = "guided_questions"


class AvatarDisclosurePreference(StrEnum):
    """How prominently the AI disclosure banner is shown.

    ``always_visible`` — disclosure banner is always on screen.
    ``session_start`` — shown at start; may be collapsed during session.

    The disclosure itself is mandatory (CLAUDE.md §2).  Only the
    *presentation* preference is configurable here.
    """

    ALWAYS_VISIBLE = "always_visible"
    SESSION_START = "session_start"


class InputModality(StrEnum):
    """Preferred input modality.  Avatar / voice layers are Phase 6/7."""

    TEXT = "text"
    VOICE = "voice"


class AccessibilityFlag(StrEnum):
    """Accessibility preferences.

    ``reduce_motion`` — suppress animations and transitions.
    ``captions``      — enable captions in voice/avatar modes.
    ``high_contrast`` — request high-contrast UI theme.
    """

    REDUCE_MOTION = "reduce_motion"
    CAPTIONS = "captions"
    HIGH_CONTRAST = "high_contrast"


# ---------------------------------------------------------------------------
# Preferences model
# ---------------------------------------------------------------------------


class UserPreferences(BaseModel):
    """User-controlled preference record.

    All preferences here are purely presentational or interactional.  They
    do NOT include consent (that is ``ConsentRecord``) and they do NOT include
    entitlement or billing state (that is server-authoritative from the
    billing layer).

    Preferences are revocable and mutable.  Each change creates a new
    record version (tracked by the persistence layer).  The server never
    infers a preference from a client-side value not explicitly set by the
    user.
    """

    model_config = {"frozen": True}

    # BCP 47 locale.  Must be in PILOT_LOCALES.
    locale: UserLocale = UserLocale.EN

    # Preferred session interaction mode.
    session_mode: SessionMode = SessionMode.OPEN_CONVERSATION

    # How prominently the AI disclosure banner is shown.
    avatar_disclosure: AvatarDisclosurePreference = AvatarDisclosurePreference.ALWAYS_VISIBLE

    # Preferred input modality.  Voice requires Phase 6 to be complete.
    input_modality: InputModality = InputModality.TEXT

    # Persona/name for Glow within sessions.  None means default ("Glow").
    # Max 40 chars; printable Unicode only; no HTML.
    persona_name: Annotated[str | None, Field(min_length=1, max_length=40)] = None

    # Active accessibility preferences.
    accessibility: frozenset[AccessibilityFlag] = frozenset()

    # Preferred session duration cap in minutes.  Server enforces 60-minute
    # hard limit per billing rules (Phase 8).  User may choose shorter.
    preferred_session_minutes: Annotated[int, Field(ge=5, le=60)] = 60

    # Therapist gender presentation for the avatar/conversation.
    # Default: female.  Affects Tavus deployment ID selection and pronoun
    # references in the system prompt.
    therapist_gender: Annotated[str, Field(pattern=r"^(female|male)$")] = "female"

    @field_validator("persona_name")
    @classmethod
    def validate_persona_name(cls, value: str | None) -> str | None:
        """Reject HTML/script content in persona name."""
        if value is not None and ("<" in value or ">" in value or "&" in value):
            raise ValueError("persona_name must not contain HTML characters.")
        return value


# ---------------------------------------------------------------------------
# User account model
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class UserAccount:
    """A Glow user account.

    This is the canonical domain object.  The persistence layer stores and
    retrieves it; route handlers receive it via an authenticated dependency.

    Fields:
        user_id:             Opaque server-assigned identifier.
        created_at:          When the account was created (UTC).
        is_adult_confirmed:  Whether the 18+ age check has been passed.
                             No session may start until this is True.
        is_active:           False for soft-deleted or suspended accounts.
        preferences:         Current user preferences.
        completed_sessions:  Count of fully completed 60-minute sessions.
                             Used by the billing entitlement engine (Phase 8).
        free_sessions_remaining: Countdown from the 3 free sessions.
    """

    user_id: str
    created_at: datetime
    is_adult_confirmed: bool
    is_active: bool
    preferences: UserPreferences
    completed_sessions: int = 0
    free_sessions_remaining: int = 3  # Phase 8 — three free sessions

    def __post_init__(self) -> None:
        if not self.user_id:
            raise ValueError("user_id must not be empty.")
        if self.created_at.tzinfo is None:
            raise ValueError("created_at must be timezone-aware (UTC).")
        if self.completed_sessions < 0:
            raise ValueError("completed_sessions must be non-negative.")
        if not (0 <= self.free_sessions_remaining <= 3):
            raise ValueError("free_sessions_remaining must be between 0 and 3.")

    @property
    def can_start_session(self) -> bool:
        """Return True iff this account may attempt to start a new session.

        Checks only the account-level invariants.  The session layer also
        checks consent, billing entitlement, and safety state.
        """
        return self.is_active and self.is_adult_confirmed


def make_user_account(
    user_id: str,
    *,
    locale: UserLocale = UserLocale.EN,
    now: datetime | None = None,
) -> UserAccount:
    """Factory for a newly registered user account.

    The account is inactive (``is_adult_confirmed=False``) until the age
    gate and onboarding flow complete.  No session may start before that.

    Args:
        user_id: Server-assigned opaque identifier.
        locale: Display locale chosen during sign-up.
        now: UTC creation timestamp.  Defaults to datetime.now(UTC).

    Returns:
        A frozen ``UserAccount`` with default preferences.
    """
    recorded_at = now if now is not None else datetime.now(UTC)
    return UserAccount(
        user_id=user_id,
        created_at=recorded_at,
        is_adult_confirmed=False,
        is_active=True,
        preferences=UserPreferences(locale=locale),
    )
