"""Paymob payment gateway (Egypt — EGP first).

Implements Glow's provider-neutral BillingGateway against Paymob's
Intention API:

  1. POST /v1/intention/            → create a payment intention
     (Auth: `Token <SECRET_KEY>`; amount in the currency's smallest unit —
      for EGP, piasters = EGP × 100)
  2. Redirect user to Unified Checkout:
     https://accept.paymob.com/unifiedcheckout/?publicKey=<PK>&clientSecret=<CS>
  3. Paymob POSTs the transaction result to our notification_url.
     Authenticity is verified with HMAC-SHA512 over the documented
     concatenated-field list using the HMAC secret.

Security invariants:
- Only the SECRET key lives server-side; the PUBLIC key reaches the browser.
- Webhooks are rejected unless HMAC verification passes (constant-time).
- Entitlement is granted ONLY from a verified webhook transaction — never
  from client-supplied "success" redirects.
- No card data ever touches Glow servers.

Config (env, GLOW_ prefix):
  GLOW_PAYMOB_SECRET_KEY   API secret token        (server only)
  GLOW_PAYMOB_PUBLIC_KEY   public key              (safe for browser)
  GLOW_PAYMOB_HMAC_SECRET  webhook HMAC secret     (server only)
  GLOW_PAYMOB_INTEGRATION_ID  card integration id  (e.g. 158)
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import time
from dataclasses import dataclass

import httpx

from glow_api.billing import PaymentIntent  # noqa: F401 (re-exported type)

logger = logging.getLogger(__name__)

_BASE_URL = "https://accept.paymob.com"
_INTENTION_URL = f"{_BASE_URL}/v1/intention/"
_CHECKOUT_URL = f"{_BASE_URL}/unifiedcheckout/"

# Amounts are integers in piasters (1 EGP = 100 piasters).
_PRICE_SESSION_EGP_PIASTERS = 70_000  # 700 EGP per session


def verify_webhook_hmac(payload: dict, received_hmac: str, hmac_secret: str) -> bool:
    """Verify Paymob's transaction callback HMAC (SHA-512).

    Concatenates the documented ordered fields from `obj`, skipping None/empty
    values, then compares digests with hmac.compare_digest.
    """
    obj = payload.get("obj", {})
    keys = [
        "amount_cents", "created_at", "currency", "error_occured",
        "has_parent_transaction", "id", "integration_id", "is_3d_secure",
        "is_auth", "is_capture", "is_refunded", "is_standalone_payment",
        "is_voided", "order.id", "owner", "pending", "source_data.pan",
        "source_data.sub_type", "source_data.type", "success",
    ]

    def _get(path: str):
        value = obj
        for part in path.split("."):
            if not isinstance(value, dict):
                return None
            value = value.get(part)
        return value

    concatenated = ""
    for key in keys:
        value = _get(key)
        if value is None:
            continue
        if isinstance(value, bool):
            value = "true" if value else "false"
        concatenated += str(value)

    computed = hmac.new(
        hmac_secret.encode("utf-8"),
        concatenated.encode("utf-8"),
        hashlib.sha512,
    ).hexdigest()

    return hmac.compare_digest(computed, (received_hmac or "").lower())


@dataclass(frozen=True)
class CheckoutSession:
    """Everything the browser needs to complete payment."""

    checkout_url: str
    intention_id: str
    amount_egp: float
    expires_at_epoch: int


class PaymobGateway:
    """Paymob Intention-API gateway. Configured iff all credentials present."""

    def __init__(
        self,
        secret_key: str,
        public_key: str,
        hmac_secret: str,
        integration_id: int,
    ) -> None:
        self._secret_key = secret_key
        self._public_key = public_key
        self._hmac_secret = hmac_secret
        self._integration_id = integration_id

    @classmethod
    def from_settings(cls) -> "PaymobGateway | None":
        import os

        secret = os.environ.get("GLOW_PAYMOB_SECRET_KEY")
        public = os.environ.get("GLOW_PAYMOB_PUBLIC_KEY")
        hmac_secret = os.environ.get("GLOW_PAYMOB_HMAC_SECRET")
        integration = os.environ.get("GLOW_PAYMOB_INTEGRATION_ID")
        if not (secret and public and hmac_secret and integration):
            return None
        return cls(secret, public, hmac_secret, int(integration))

    @property
    def is_configured(self) -> bool:
        return True

    async def create_checkout_session(self, user_id: str, email: str) -> CheckoutSession:
        """Create an intention for one support session (700 EGP)."""
        now = int(time.time())
        payload = {
            "amount": _PRICE_SESSION_EGP_PIASTERS,
            "currency": "EGP",
            "payment_methods": [self._integration_id],
            "items": [
                {
                    "name": "Glow support session",
                    "amount": _PRICE_SESSION_EGP_PIASTERS,
                    "description": "One 60-minute AI-supported conversation",
                    "quantity": 1,
                }
            ],
            "billing_data": {
                # Paymob requires these fields even when unused.
                "apartment": "NA",
                "first_name": (user_id or "glow")[:16],
                "last_name": "user",
                "street": "NA",
                "building": "NA",
                "phone_number": "+201000000000",
                "city": "NA",
                "country": "EG",
                "email": email or "user@glow.local",
                "floor": "NA",
                "state": "NA",
                "postal_code": "NA",
            },
            "special_reference": user_id,
            "expiration": 3600,
        }

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                _INTENTION_URL,
                headers={
                    "Authorization": f"Token {self._secret_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            if resp.status_code >= 400:
                logger.error("Paymob intention failed: %s %s", resp.status_code, resp.text[:300])
                raise RuntimeError("Payment provider rejected the request.")

            data = resp.json()

        client_secret = data["payment_keys"][0]["key"]
        intention_order_id = str(data.get("id", ""))
        checkout_url = (
            f"{_CHECKOUT_URL}?publicKey={self._public_key}"
            f"&clientSecret={client_secret}"
        )
        return CheckoutSession(
            checkout_url=checkout_url,
            intention_id=intention_order_id,
            amount_egp=_PRICE_SESSION_EGP_PIASTERS / 100,
            expires_at_epoch=now + 3600,
        )

    async def handle_webhook(self, payload: dict, received_hmac: str) -> bool:
        """Verify + process a transaction callback. Returns success flag."""
        if not verify_webhook_hmac(payload, received_hmac, self._hmac_secret):
            logger.warning("Paymob webhook HMAC mismatch — rejecting.")
            return False

        obj = payload.get("obj", {})
        success = obj.get("success") is True
        special_reference = (payload.get("order") or {}).get("merchant_order_id") or \
            obj.get("special_reference")
        logger.info(
            "Paymob webhook processed: success=%s ref=%s txn=%s",
            success, special_reference, obj.get("id"),
        )
        return bool(success)
