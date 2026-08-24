"""
Session lifecycle model for Glow (Phase 2).

A Glow session is a bounded, server-managed interaction between a user and
the AI.  This module defines:

 - ``SessionState`` — the finite set of states a session can be in.
 - ``SessionMode`` — imported from user module (re-exported here for
   convenience of session-layer code).
 - ``SessionRecord`` — the canonical domain object for a session.
 - ``SessionPolicy`` — server-enforced rules (time, mode, crisis override).
 - ``make_session`` / ``advance_session`` — pure functions for state
   transitions (no DB, no side effects).

Design rules (CLAUDE.md §4, §5, §12):
 - 60-minute hard time limit per session (billing Phase 8).  Crisis mode
   overrides both time and billing limits.
 - Sessions are user-led by default; guided-question mode is a user
   preference.
 - No session data is stored without transcript-retention consent.
 - Every session must end with the closure protocol:
   (1) warn the user before ending,
   (2) ask what was most important,
   (3) reflect their own words back,
   (4) identify one or two realistic next steps,
   (5) offer an optional summary,
   (6) closing safety check when appropriate,
   (7) explain data retention,
   (8) close calmly.
 - Crisis mode overrides normal session rules.  A session in CRISIS state
   cannot be ended by normal closure until the crisis FSM clears it or
   hands off.
 - Glow must never claim to diagnose, prescribe, or replace a human therapist.

No model provider, no database dependency.  State transitions are pure
functions, fully testable.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Annotated
from uuid import uuid4

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SESSION_HARD_LIMIT_MINUTES: int = 60
"""Absolute maximum session length in minutes.  Server enforced; billing rules
apply.  Crisis mode may extend this — see SessionPolicy."""

SESSION_WARN_MINUTES_BEFORE_END: int = 5
"""Warn the user this many minutes before the session hard limit."""

FREE_SESSION_COUNT: int = 3
"""Number of fully completed 60-minute sessions available without payment."""


# ---------------------------------------------------------------------------
# State machine
# ---------------------------------------------------------------------------


class SessionState(StrEnum):
    """States in the session lifecycle finite state machine.

    Transitions (permitted only by advance_session):
        PENDING  → ACTIVE (user and server both confirm start)
        ACTIVE   → CLOSING (time warning triggered or user requests close)
        ACTIVE   → CRISIS (safety check flags crisis)
        ACTIVE   → PAUSED (user pauses)
        PAUSED   → ACTIVE (user resumes)
        PAUSED   → CLOSING
        CLOSING  → CLOSED (closure protocol complete)
        CRISIS   → ACTIVE (crisis FSM clears — human-in-loop or resource offered)
        CRISIS   → CLOSED (emergency closure)
        Any      → ABANDONED (connection lost; no closure protocol possible)
    """

    PENDING = "pending"
    ACTIVE = "active"
    PAUSED = "paused"
    CLOSING = "closing"
    CLOSED = "closed"
    CRISIS = "crisis"
    ABANDONED = "abandoned"


class ClosureReason(StrEnum):
    """Why a session was closed or is being closed."""

    USER_REQUESTED = "user_requested"
    TIME_LIMIT = "time_limit"
    BILLING_LIMIT = "billing_limit"
    SAFETY_REFERRAL = "safety_referral"
    CRISIS_EMERGENCY = "crisis_emergency"
    CONNECTION_LOST = "connection_lost"
    ADMIN_TERMINATED = "admin_terminated"


# ---------------------------------------------------------------------------
# Session record
# ---------------------------------------------------------------------------


@dataclass
class SessionRecord:
    """The canonical server-side record for one session.

    Mutable within a session lifecycle; frozen once in CLOSED or ABANDONED
    state.  The persistence layer stores a snapshot after each state
    transition.

    Fields:
        session_id:      Opaque server-assigned session identifier.
        user_id:         Opaque user identifier (matches AuthPrincipal.user_id).
        state:           Current state machine state.
        mode:            Open conversation or guided questions.
        started_at:      When the session moved to ACTIVE (UTC).  None while PENDING.
        closed_at:       When the session moved to CLOSED/ABANDONED (UTC).
        hard_limit_at:   The absolute UTC time the session must end.
        paused_duration: Total time spent in PAUSED state (does not count
                         against the session time limit).
        is_crisis:       True if the safety system has flagged a crisis.
                         Must be cleared by the crisis FSM before normal
                         session rules resume.
        closure_reason:  Set when transitioning to CLOSING or CLOSED.
        consent_version: The consent-policy-version in effect when this
                         session started.  A change to consent policy may
                         require re-solicitation.
        summary_generated: Whether a session summary was generated.
        summary_consent:   Whether the user consented to session summaries
                           at the time this session was created.
    """

    session_id: str
    user_id: str
    state: SessionState
    mode: str  # SessionMode value — string to avoid circular import
    started_at: datetime | None
    closed_at: datetime | None
    hard_limit_at: datetime | None
    paused_duration: timedelta
    is_crisis: bool
    closure_reason: ClosureReason | None
    consent_version: str
    summary_generated: bool
    summary_consent: bool
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    @property
    def is_terminal(self) -> bool:
        return self.state in (SessionState.CLOSED, SessionState.ABANDONED)

    @property
    def elapsed_active(self) -> timedelta:
        """Wall-clock time since session activation, excluding paused time."""
        if self.started_at is None:
            return timedelta(0)
        end = self.closed_at if self.closed_at is not None else datetime.now(UTC)
        return max(end - self.started_at - self.paused_duration, timedelta(0))

    @property
    def minutes_remaining(self) -> float:
        """Minutes remaining before the hard limit.  0.0 if expired."""
        if self.hard_limit_at is None or self.state == SessionState.PENDING:
            return float(SESSION_HARD_LIMIT_MINUTES)
        if self.is_crisis:
            # Crisis mode extends time limit — no countdown applies.
            return float("inf")
        remaining = self.hard_limit_at - datetime.now(UTC)
        return max(remaining.total_seconds() / 60.0, 0.0)

    @property
    def warn_before_end(self) -> bool:
        """True when the user should be warned that the session is ending soon."""
        if self.is_crisis or self.state != SessionState.ACTIVE:
            return False
        return 0.0 < self.minutes_remaining <= SESSION_WARN_MINUTES_BEFORE_END

    @property
    def is_time_expired(self) -> bool:
        """True when the hard limit has passed and the session must close."""
        if self.is_crisis:
            return False
        return self.minutes_remaining == 0.0 and self.state in (
            SessionState.ACTIVE,
            SessionState.PAUSED,
        )


# ---------------------------------------------------------------------------
# Session policy — server-enforced rules
# ---------------------------------------------------------------------------


class SessionPolicy(BaseModel):
    """Server-enforced session policy snapshot.

    These values are server-authoritative.  Clients must not compute or
    override them.  A fresh policy snapshot is evaluated at session start
    and re-evaluated on any billing or safety state change.

    Fields:
        hard_limit_minutes:     Absolute max session length (≤ 60).
        allow_pause:            Whether the user can pause the session.
        crisis_overrides_limit: When True, session time limit is suspended
                                during crisis mode.
        allow_summary:          Whether session summaries may be generated
                                (requires transcript-retention consent).
        is_free_session:        Whether this session counts against the free
                                quota.  False means the session is paid.
        billing_required:       True if the user has exhausted free sessions
                                and a payment method is not on file.
    """

    hard_limit_minutes: Annotated[int, Field(ge=5, le=60)] = SESSION_HARD_LIMIT_MINUTES
    allow_pause: bool = True
    crisis_overrides_limit: bool = True
    allow_summary: bool = True
    is_free_session: bool = True
    billing_required: bool = False


# ---------------------------------------------------------------------------
# Pure state transition functions
# ---------------------------------------------------------------------------


def make_session(
    user_id: str,
    mode: str,
    consent_version: str,
    *,
    summary_consent: bool,
    policy: SessionPolicy | None = None,
    now: datetime | None = None,
) -> SessionRecord:
    """Create a new session in PENDING state.

    Args:
        user_id: The authenticated user's opaque identifier.
        mode: Session interaction mode (SessionMode value string).
        consent_version: The current consent policy version.
        summary_consent: Whether the user has consented to session summaries.
        policy: Server-evaluated session policy.  Defaults to SessionPolicy().
        now: UTC timestamp for creation.  Defaults to datetime.now(UTC).

    Returns:
        A SessionRecord in PENDING state.  Call advance_session to ACTIVE.
    """
    _now = now if now is not None else datetime.now(UTC)
    _policy = policy if policy is not None else SessionPolicy()
    return SessionRecord(
        session_id=str(uuid4()),
        user_id=user_id,
        state=SessionState.PENDING,
        mode=mode,
        started_at=None,
        closed_at=None,
        hard_limit_at=None,
        paused_duration=timedelta(0),
        is_crisis=False,
        closure_reason=None,
        consent_version=consent_version,
        summary_generated=False,
        summary_consent=summary_consent,
        created_at=_now,
    )


class SessionTransitionError(Exception):
    """Raised when an invalid state transition is attempted."""


_VALID_TRANSITIONS: dict[SessionState, set[SessionState]] = {
    SessionState.PENDING: {SessionState.ACTIVE, SessionState.ABANDONED},
    SessionState.ACTIVE: {
        SessionState.PAUSED,
        SessionState.CLOSING,
        SessionState.CRISIS,
        SessionState.ABANDONED,
    },
    SessionState.PAUSED: {
        SessionState.ACTIVE,
        SessionState.CLOSING,
        SessionState.ABANDONED,
    },
    SessionState.CLOSING: {SessionState.CLOSED, SessionState.CRISIS},
    SessionState.CRISIS: {
        SessionState.ACTIVE,
        SessionState.CLOSING,
        SessionState.CLOSED,
    },
    SessionState.CLOSED: set(),
    SessionState.ABANDONED: set(),
}


def advance_session(
    session: SessionRecord,
    new_state: SessionState,
    *,
    closure_reason: ClosureReason | None = None,
    policy: SessionPolicy | None = None,
    now: datetime | None = None,
) -> SessionRecord:
    """Apply a validated state transition and return the updated session.

    This is a pure function — it does not write to any store.  The caller
    is responsible for persisting the returned record.

    Args:
        session: The current session record.
        new_state: The target state.
        closure_reason: Required when transitioning to CLOSING or CLOSED.
        policy: Server policy snapshot (used for hard_limit calculation).
        now: UTC timestamp.  Defaults to datetime.now(UTC).

    Returns:
        A new SessionRecord reflecting the transition.

    Raises:
        SessionTransitionError: If the transition is not permitted.
    """
    if session.is_terminal:
        raise SessionTransitionError(
            f"Session {session.session_id} is terminal ({session.state}); "
            "no further transitions are permitted."
        )
    allowed = _VALID_TRANSITIONS.get(session.state, set())
    if new_state not in allowed:
        raise SessionTransitionError(
            f"Transition {session.state} → {new_state} is not permitted."
        )

    _now = now if now is not None else datetime.now(UTC)
    _policy = policy if policy is not None else SessionPolicy()

    # Build the updated record fields as a dict, then reconstruct.
    started_at = session.started_at
    closed_at = session.closed_at
    hard_limit_at = session.hard_limit_at
    paused_duration = session.paused_duration
    is_crisis = session.is_crisis
    _closure_reason = session.closure_reason

    if new_state == SessionState.ACTIVE:
        if session.state == SessionState.PENDING:
            # First activation: record start time and compute hard limit.
            started_at = _now
            hard_limit_at = _now + timedelta(minutes=_policy.hard_limit_minutes)
        is_crisis = session.is_crisis and session.state == SessionState.CRISIS
        # If coming out of CRISIS, crisis flag is cleared by the FSM.
        if session.state == SessionState.CRISIS:
            is_crisis = False

    elif new_state == SessionState.PAUSED:
        pass  # Pause start is tracked outside the record (event log).

    elif new_state == SessionState.CRISIS:
        is_crisis = True

    elif new_state in (SessionState.CLOSING, SessionState.CLOSED, SessionState.ABANDONED):
        closed_at = _now
        _closure_reason = closure_reason

    return SessionRecord(
        session_id=session.session_id,
        user_id=session.user_id,
        state=new_state,
        mode=session.mode,
        started_at=started_at,
        closed_at=closed_at,
        hard_limit_at=hard_limit_at,
        paused_duration=paused_duration,
        is_crisis=is_crisis,
        closure_reason=_closure_reason,
        consent_version=session.consent_version,
        summary_generated=session.summary_generated,
        summary_consent=session.summary_consent,
        created_at=session.created_at,
    )
