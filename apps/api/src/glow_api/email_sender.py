"""Transactional email sender (Resend free tier, dev-log fallback).

When `GLOW_EMAIL_PROVIDER=resend` with an API key + verified sender, emails
are actually delivered. Otherwise the link is logged server-side only (dev
mode) — the HTTP API responses are identical either way (generic success)
so account existence can never be inferred.
"""

from __future__ import annotations

import logging

logger = logging.getLogger("glow_api.email_sender")


def send_auth_link(to_email: str, subject: str, link: str) -> None:
    """Send (or log, in dev) an auth link email."""
    from glow_api.settings import settings

    provider = getattr(settings, "email_provider", "none")
    api_key = getattr(settings, "resend_api_key", None)
    sender = getattr(settings, "email_from", None)

    if provider == "resend" and api_key and sender:
        try:
            import httpx

            resp = httpx.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "from": sender,
                    "to": [to_email],
                    "subject": subject,
                    "html": f"<p>Open this link to continue:</p><p><a href='{link}'>{link}</a></p>",
                },
                timeout=15,
            )
            resp.raise_for_status()
            return
        except Exception as exc:
            logger.warning("Resend delivery failed (%s); link NOT emailed", type(exc).__name__)
            return

    # Dev mode: the link never reaches the user, but the flow is testable.
    logger.info(
        "Email provider not configured — dev link (subject: %s) for %s",
        subject,
        to_email,
    )
