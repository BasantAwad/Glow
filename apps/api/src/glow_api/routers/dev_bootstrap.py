"""Dev-only auth bootstrap router.

DEVELOPMENT ONLY — gated by GLOW_ENVIRONMENT != "production".
Registers (or reuses) a local user account with default consents and issues
a real Glow-signed JWT through the production auth pipeline.  No mock
providers, no bypassed verification: the issued token is identical to any
other Glow token and every downstream endpoint still enforces consent and
safety server-side.

Before any pilot or production launch this router MUST be removed and
replaced by the real login flow (ADR 0002).
"""

from __future__ import annotations

import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from glow_api.database import get_db_session
from glow_api.dependencies import get_auth_provider
from glow_api.errors import ProviderNotConfiguredError
from glow_api.models import ConsentRecordModel, UserAccountModel, UserPreferencesModel

router = APIRouter(prefix="/auth", tags=["auth"])


class DevBootstrapRequest(BaseModel):
    display_name: str | None = None


class DevBootstrapResponse(BaseModel):
    token: str
    user_id: str


@router.post("/dev-bootstrap", response_model=DevBootstrapResponse)
async def dev_bootstrap(_: DevBootstrapRequest | None = None) -> DevBootstrapResponse:

    from glow_api.settings import get_settings

    if get_settings().environment == "production":
        raise HTTPException(status_code=404, detail="Not found")

    # Real auth provider — no mock.
    provider = get_auth_provider()
    try:
        user_id = f"web-{__import__('secrets').token_hex(4)}"
        token = provider.issue_token(user_id, device_id="web-dev", is_adult_confirmed=True)
    except ProviderNotConfiguredError as e:
        raise HTTPException(status_code=503, detail="auth_not_configured") from e

    # Create the account + default consents so protected endpoints resolve.
    async for db in get_db_session():
        existing = (
            await db.execute(select(UserAccountModel).where(UserAccountModel.user_id == user_id))
        ).scalar_one_or_none()
        if existing is None:
            # Pass real datetime objects; SQLite stores them correctly.
            now = datetime.datetime.now(datetime.UTC)
            user = UserAccountModel(
                user_id=user_id,
                created_at=now,
                is_adult_confirmed=True,
                is_active=True,
                completed_sessions=0,
                free_sessions_remaining=3,
            )
            db.add(user)
            await db.flush()
            db.add(
                UserPreferencesModel(
                    user_account_id=user.id,
                    locale="EN",
                    session_mode="OPEN_CONVERSATION",
                    avatar_disclosure="ALWAYS_VISIBLE",
                    input_modality="TEXT",
                    accessibility=[],
                    preferred_session_minutes=60,
                )
            )
            db.add(
                ConsentRecordModel(
                    user_account_id=user.id,
                    record_version=1,
                    recorded_at=datetime.datetime.now(datetime.UTC),
                    policy_version="safety-policy-v0",
                    locale_presented="en-US",
                    service_use=True,
                    transcript_retention=True,
                    audio_storage=False,
                    video_storage=False,
                    session_summary=True,
                    personalisation=False,
                    research_and_model_improvement=False,
                    memory_consent=False,
                )
            )
        await db.commit()
        break

    return DevBootstrapResponse(token=token, user_id=user_id)
