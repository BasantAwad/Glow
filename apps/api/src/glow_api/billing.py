"""
Billing entitlement engine (Phase 8).

Implements:
 - Server-side entitlement checking (three free 60-minute sessions, then paid).
 - Session pricing: $14 USD / 700 EGP per completed 60-minute session.
 - A provider-neutral billing gateway interface.
 - The invariant: crisis resources and crisis mode are NEVER gated by
   billing or entitlement state.

Billing rules (CLAUDE.md §12, product plan):
 - Three free completed 60-minute sessions.  A session is "completed" when
   it closes normally (CLOSED state with ClosureReason other than
   CRISIS_EMERGENCY or CONNECTION_LOST).
 - After the free quota: each session requires pre-authorization.
 - Crisis support is always available regardless of billing state.
 - Billing errors must surface clearly; they must not silently block access.
 - Raw card details are NEVER stored by Glow (passed directly to provider).

Provider selection is DEFERRED.  Until approved:
 - BillingGateway raises ProviderNotConfiguredError.
 - All entitlement decisions default to is_free_session=True for testing.
"""

from __future__ import annotations

import abc
from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum

from glow_api.session import ClosureReason

# ---------------------------------------------------------------------------
# Pricing constants
# ---------------------------------------------------------------------------

FREE_SESSION_QUOTA: int = 3
SESSION_PRICE_USD: float = 14.00
SESSION_PRICE_EGP: float = 700.00
SESSION_PRICE_CURRENCY_OPTIONS: tuple[str, ...] = ("USD", "EGP")


# ---------------------------------------------------------------------------
# Entitlement result
# ---------------------------------------------------------------------------


class EntitlementStatus(StrEnum):
    """The billing/entitlement status for a session attempt."""

    FREE_AVAILABLE = "free_available"
    PAID_REQUIRED = "paid_required"
    CRISIS_EXEMPT = "crisis_exempt"  # Always allow in crisis, regardless of billing
    PROVIDER_NOT_CONFIGURED = "provider_not_configured"


@dataclass(frozen=True)
class EntitlementResult:
    """Result of a server-side entitlement check.

    Fields:
        status:              The entitlement status.
        free_sessions_used:  Number of free sessions already consumed.
        free_sessions_total: Total free sessions available (always 3).
        may_start_session:   True iff the user may start a new session now.
        requires_payment:    True iff payment must be confirmed before start.
        price_usd:           Session price in USD (None for free sessions).
        price_egp:           Session price in EGP (None for free sessions).
        is_crisis_exempt:    True iff billing is bypassed due to crisis.
    """

    status: EntitlementStatus
    free_sessions_used: int
    free_sessions_total: int = FREE_SESSION_QUOTA
    may_start_session: bool = True
    requires_payment: bool = False
    price_usd: float | None = None
    price_egp: float | None = None
    is_crisis_exempt: bool = False


def evaluate_entitlement(
    completed_sessions: int,
    free_sessions_remaining: int,
    *,
    is_crisis: bool = False,
    billing_provider_configured: bool = False,
) -> EntitlementResult:
    """Server-side entitlement evaluation.

    Crisis mode always returns CRISIS_EXEMPT — billing state is irrelevant.

    Args:
        completed_sessions:          Total completed sessions for this user.
        free_sessions_remaining:     Free sessions remaining (from UserAccount).
        is_crisis:                   Whether a crisis is active.
        billing_provider_configured: Whether a billing provider is ready.

    Returns:
        EntitlementResult.
    """
    if is_crisis:
        return EntitlementResult(
            status=EntitlementStatus.CRISIS_EXEMPT,
            free_sessions_used=completed_sessions,
            may_start_session=True,
            is_crisis_exempt=True,
        )

    if free_sessions_remaining > 0:
        return EntitlementResult(
            status=EntitlementStatus.FREE_AVAILABLE,
            free_sessions_used=completed_sessions,
            may_start_session=True,
            requires_payment=False,
        )

    if not billing_provider_configured:
        return EntitlementResult(
            status=EntitlementStatus.PROVIDER_NOT_CONFIGURED,
            free_sessions_used=completed_sessions,
            may_start_session=False,
            requires_payment=False,
        )

    return EntitlementResult(
        status=EntitlementStatus.PAID_REQUIRED,
        free_sessions_used=completed_sessions,
        may_start_session=False,
        requires_payment=True,
        price_usd=SESSION_PRICE_USD,
        price_egp=SESSION_PRICE_EGP,
    )


def is_completable_session(closure_reason: ClosureReason) -> bool:
    """Return True iff a session with this closure reason counts as completed.

    A session is "completed" (counts against/for the free quota) only when
    it ends normally.  Crisis emergency and connection-lost closures do NOT
    count as completions (the user did not get a full session).
    """
    return closure_reason not in (
        ClosureReason.CRISIS_EMERGENCY,
        ClosureReason.CONNECTION_LOST,
    )


# ---------------------------------------------------------------------------
# Billing gateway interface
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class PaymentMethod:
    """An opaque reference to a stored payment method.

    Raw card details are never stored by Glow.  This object holds only
    provider-assigned identifiers.

    Fields:
        method_id:    Provider-assigned payment method identifier.
        last_four:    Last four digits of the card (display only).
        brand:        Card brand string ("visa", "mastercard", etc.).
        expires_at:   Card expiry (year/month only).
    """

    method_id: str
    last_four: str
    brand: str
    expires_at: str  # "YYYY-MM" format


@dataclass(frozen=True)
class PaymentIntent:
    """A server-created payment intent for a session.

    Fields:
        intent_id:   Provider-assigned payment intent identifier.
        user_id:     Opaque user identifier.
        amount_usd:  Amount in USD.
        amount_egp:  Amount in EGP.
        currency:    Charge currency ("USD" or "EGP").
        created_at:  UTC timestamp.
        expires_at:  When this intent expires.
        confirmed:   Whether the payment has been confirmed.
    """

    intent_id: str
    user_id: str
    amount_usd: float
    amount_egp: float
    currency: str
    created_at: datetime
    expires_at: datetime
    confirmed: bool = False


class BillingGateway(abc.ABC):
    """Abstract billing provider gateway."""

    @property
    @abc.abstractmethod
    def is_configured(self) -> bool:
        """True iff this gateway has valid credentials and is ready."""

    @abc.abstractmethod
    async def create_payment_intent(
        self,
        user_id: str,
        currency: str,
    ) -> PaymentIntent:
        """Create a payment intent for a session."""

    @abc.abstractmethod
    async def confirm_payment(self, intent_id: str) -> bool:
        """Confirm a payment intent.  Returns True if successful."""

    @abc.abstractmethod
    async def get_payment_methods(self, user_id: str) -> list[PaymentMethod]:
        """List stored payment methods for a user."""


class UnconfiguredBillingGateway(BillingGateway):
    """Sentinel billing gateway used until a real provider is approved."""

    @property
    def is_configured(self) -> bool:
        return False

    async def create_payment_intent(self, user_id: str, currency: str) -> PaymentIntent:
        from glow_api.errors import ProviderNotConfiguredError
        raise ProviderNotConfiguredError("billing_gateway")

    async def confirm_payment(self, intent_id: str) -> bool:
        from glow_api.errors import ProviderNotConfiguredError
        raise ProviderNotConfiguredError("billing_gateway")

    async def get_payment_methods(self, user_id: str) -> list[PaymentMethod]:
        from glow_api.errors import ProviderNotConfiguredError
        raise ProviderNotConfiguredError("billing_gateway")
