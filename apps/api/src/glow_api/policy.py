"""
Conversation Policy Engine (Phase 2/8).

Responsible for evaluating a user's entitlements (billing, free tier) and
generating the authoritative SessionPolicy for a given session.
"""

from __future__ import annotations

from glow_api.session import FREE_SESSION_COUNT, SessionPolicy
from glow_api.user import UserAccount


class ConversationPolicyEngine:
    """Enforces billing and time limit policies for sessions."""

    def evaluate_policy(self, user: UserAccount) -> SessionPolicy:
        """Evaluate the user's entitlements and return a SessionPolicy.

        Rules:
            - Users get FREE_SESSION_COUNT free sessions.
            - If exhausted and no billing configured, billing_required = True.
            - Hard limit is 60 minutes for all sessions in pilot.
        """
        # Phase 8 billing placeholder logic
        has_free_sessions = user.free_sessions_remaining > 0
        billing_required = not has_free_sessions

        return SessionPolicy(
            hard_limit_minutes=60,
            allow_pause=True,
            crisis_overrides_limit=True,
            allow_summary=True,
            is_free_session=has_free_sessions,
            billing_required=billing_required,
        )

    def can_start_session(self, user: UserAccount) -> bool:
        """Return True if the user is allowed to start a new session."""
        policy = self.evaluate_policy(user)
        return not policy.billing_required
