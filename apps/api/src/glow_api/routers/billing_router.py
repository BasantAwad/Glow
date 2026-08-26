"""Billing endpoints — Paymob checkout, webhooks, entitlement status.

Flow:
 1. POST /billing/checkout        (auth) → creates a Paymob intention and
    returns a Unified Checkout URL the browser redirects to.
 2. User pays on Paymob's hosted page.
 3. POST /billing/webhook/paymob  (public, HMAC-verified) → Paymob notifies
    us; on success we record a paid-session credit for the user.
 4. GET  /billing/status          (auth) → current credits/quota.

Invariants (CLAUDE.md):
- Crisis mode is never gated by billing state.
- Credits are granted only from verified webhook transactions, never from
  client redirects or client-supplied fields.
- No card data is ever received or stored by Glow.
"""

from __future__ import annotations

import datetime
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import Annotated

from glow_api.database import get_db_session
from glow_api.dependencies import get_current_user
from glow_api.models import PaymentWebhookEventModel, UserAccountModel
from glow_api.paymob_gateway import PaymobGateway, verify_webhook_hmac
from glow_api.user import UserAccount

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["billing"])


class CheckoutResponse(BaseModel):
    checkout_url: str
    amount_egp: float
    expires_at_epoch: int


class BillingStatusResponse(BaseModel):
    free_sessions_remaining: int
    paid_credits: int
    may_start_session: bool
    price_egp: float


def _gateway() -> PaymobGateway:
    gw = PaymobGateway.from_settings()
    if gw is None:
        raise HTTPException(
            status_code=503,
            detail="Payments are not configured yet. Check back soon.",
        )
    return gw


async def _pk(db: AsyncSession, user_id: str) -> int:
    return (
        await db.execute(
            select(UserAccountModel.id).where(UserAccountModel.user_id == user_id)
        )
    ).scalar_one()


@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout(
    principal_user: Annotated[UserAccount, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> CheckoutResponse:
    gw = _gateway()
    row = (
        await db.execute(
            select(UserAccountModel).where(UserAccountModel.user_id == principal_user.user_id)
        )
    ).scalar_one()
    try:
        session = await gw.create_checkout_session(principal_user.user_id, row.email or "")
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return CheckoutResponse(
        checkout_url=session.checkout_url,
        amount_egp=session.amount_egp,
        expires_at_epoch=session.expires_at_epoch,
    )


@router.post("/webhook/paymob")
async def paymob_webhook(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, str]:
    """Paymob transaction callback. HMAC-verified before anything is trusted."""
    gw = _gateway()
    payload = await request.json()
    received_hmac = request.query_params.get("hmac", "")

    if not verify_webhook_hmac(payload, received_hmac, gw._hmac_secret):  # noqa: SLF001
        raise HTTPException(status_code=400, detail="Invalid signature")

    obj = payload.get("obj", {})
    txn_id = str(obj.get("id", ""))
    success = obj.get("success") is True
    user_ref = obj.get("special_reference") or ""

    # Idempotency: skip already-processed transactions.
    existing = (
        await db.execute(
            select(PaymentWebhookEventModel).where(
                PaymentWebhookEventModel.provider_event_id == txn_id
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        return {"status": "already_processed"}

    db.add(
        PaymentWebhookEventModel(
            provider_event_id=txn_id,
            provider_name="paymob",
            event_type="transaction",
            payload_json=payload,
            processed=True,
            processed_at=datetime.datetime.now(datetime.timezone.utc),
        )
    )

    if success and user_ref:
        # Grant one paid-session credit to the referenced user.
        user_row = (
            await db.execute(
                select(UserAccountModel).where(UserAccountModel.user_id == user_ref)
            )
        ).scalar_one_or_none()
        if user_row is not None:
            user_row.free_sessions_remaining = min(
                99, (user_row.free_sessions_remaining or 0) + 1
            )
            logger.info("Granted paid session credit to %s", user_ref)

    await db.commit()
    return {"status": "processed" if success else "failed_payment"}


@router.get("/status", response_model=BillingStatusResponse)
async def billing_status(
    principal_user: Annotated[UserAccount, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> BillingStatusResponse:
    row = (
        await db.execute(
            select(UserAccountModel).where(UserAccountModel.user_id == principal_user.user_id)
        )
    ).scalar_one()
    remaining = row.free_sessions_remaining or 0
    return BillingStatusResponse(
        free_sessions_remaining=max(0, remaining),
        paid_credits=max(0, remaining - 3),  # above base quota = purchased
        may_start_session=remaining > 0,
        price_egp=700.0,
    )
