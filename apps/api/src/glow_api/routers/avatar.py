"""Authenticated Tavus conversation-session provisioning."""

from __future__ import annotations

import logging
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from glow_api.consent import ConsentPurpose, ConsentRecord
from glow_api.dependencies import get_current_consent, get_current_user
from glow_api.errors import AgeGatingError, ConsentError, ErrorCode, GlowError, ProviderNotConfiguredError
from glow_api.settings import settings
from glow_api.user import UserAccount

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/avatar", tags=["avatar"])


class AvatarSessionResponse(BaseModel):
    """Tavus conversation details needed by an authorized client."""

    conversation_url: str
    conversation_id: str


@router.post("/session", response_model=AvatarSessionResponse)
async def create_avatar_session(
    user: Annotated[UserAccount, Depends(get_current_user)],
    consent: Annotated[ConsentRecord, Depends(get_current_consent)],
) -> AvatarSessionResponse:
    """Create a Tavus session without exposing provider credentials to clients."""
    if not user.is_adult_confirmed:
        raise AgeGatingError()
    if not consent.is_purpose_consented(ConsentPurpose.SERVICE_USE):
        raise ConsentError(purpose=ConsentPurpose.SERVICE_USE.value)

    if not settings.tavus_api_key:
        raise ProviderNotConfiguredError("tavus")
    if not settings.tavus_replica_id or not settings.tavus_persona_id:
        raise ProviderNotConfiguredError("tavus_replica_or_persona")

    headers = {
        "x-api-key": settings.tavus_api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "replica_id": settings.tavus_replica_id,
        "persona_id": settings.tavus_persona_id,
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                "https://tavusapi.com/v2/conversations",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Tavus session provisioning failed (%s)", type(exc).__name__)
        raise GlowError(
            ErrorCode.PROVIDER_UNAVAILABLE,
            "The avatar session is temporarily unavailable. Please try again later.",
            http_status=503,
        ) from exc

    conversation_url = data.get("conversation_url")
    conversation_id = data.get("conversation_id")
    if not isinstance(conversation_url, str) or not isinstance(conversation_id, str):
        logger.warning("Tavus returned an incomplete session response")
        raise GlowError(
            ErrorCode.PROVIDER_UNAVAILABLE,
            "The avatar provider returned an incomplete session response.",
            http_status=503,
        )

    return AvatarSessionResponse(
        conversation_url=conversation_url,
        conversation_id=conversation_id,
    )