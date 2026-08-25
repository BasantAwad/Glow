"""
FastAPI dependencies for Glow API.

Wires together the database, auth adapter, and user context.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from glow_api.auth import AuthPrincipal, AuthProvider
from glow_api.auth_providers.glow_jwt import GlowSignedJwtAuthProvider
from glow_api.consent import ConsentRecord
from glow_api.database import get_db_session
from glow_api.errors import AuthenticationError, NotFoundError
from glow_api.models import ConsentRecordModel, UserAccountModel
from glow_api.user import AccessibilityFlag, UserAccount, UserPreferences

# ---------------------------------------------------------------------------
# Auth Provider
# ---------------------------------------------------------------------------


def get_auth_provider() -> AuthProvider:
    """Return the active authentication provider.

    Creates a new GlowSignedJwtAuthProvider on each call (reads GLOW_AUTH_SECRET_KEY
    from the environment at call time).  This is intentionally not cached at
    module level so that tests can monkeypatch env vars between calls.

    In production the provider is stateless enough that per-request construction
    is acceptable overhead. If profiling shows otherwise, cache with an env-var
    fingerprint as the cache key.
    """
    return GlowSignedJwtAuthProvider()


# ---------------------------------------------------------------------------
# Request Context Dependencies
# ---------------------------------------------------------------------------

http_bearer = HTTPBearer(auto_error=False)


async def get_auth_principal(
    auth: Annotated[HTTPAuthorizationCredentials | None, Depends(http_bearer)],
    auth_provider: Annotated[AuthProvider, Depends(get_auth_provider)],
) -> AuthPrincipal:
    """Extract and validate the caller's identity token.

    Raises:
        AuthenticationError: If the token is missing or invalid.
        ProviderNotConfiguredError: If no auth provider is selected yet.
    """
    if not auth or not auth.credentials:
        raise AuthenticationError(detail="Missing bearer token.")

    result = await auth_provider.validate_token(auth.credentials)
    if not result.valid or result.principal is None:
        raise AuthenticationError(detail=result.error_reason or "Invalid token.")

    return result.principal


async def get_current_user(
    principal: Annotated[AuthPrincipal, Depends(get_auth_principal)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> UserAccount:
    """Retrieve the full user account for the authenticated principal.

    Raises:
        NotFoundError: If the authenticated user does not exist in the DB.
    """
    stmt = (
        select(UserAccountModel)
        .options(selectinload(UserAccountModel.preferences))
        .where(UserAccountModel.user_id == principal.user_id)
    )
    result = await session.execute(stmt)
    model = result.scalar_one_or_none()

    if model is None:
        raise NotFoundError(detail="User account not found.")

    from glow_api.user import UserLocale, SessionMode, AvatarDisclosurePreference, InputModality
    
    prefs = UserPreferences(
        locale=UserLocale(model.preferences.locale.value if hasattr(model.preferences.locale, "value") else str(model.preferences.locale)),
        session_mode=SessionMode(model.preferences.session_mode.value if hasattr(model.preferences.session_mode, "value") else str(model.preferences.session_mode)),
        avatar_disclosure=AvatarDisclosurePreference(model.preferences.avatar_disclosure.value if hasattr(model.preferences.avatar_disclosure, "value") else str(model.preferences.avatar_disclosure)),
        input_modality=InputModality(model.preferences.input_modality.value if hasattr(model.preferences.input_modality, "value") else str(model.preferences.input_modality)),
        persona_name=model.preferences.persona_name,
        accessibility=frozenset(AccessibilityFlag(x) for x in model.preferences.accessibility),
        preferred_session_minutes=model.preferences.preferred_session_minutes,
    )

    return UserAccount(
        user_id=model.user_id,
        created_at=model.created_at,
        is_adult_confirmed=model.is_adult_confirmed,
        is_active=model.is_active,
        preferences=prefs,
        completed_sessions=model.completed_sessions,
        free_sessions_remaining=model.free_sessions_remaining,
    )


async def get_current_consent(
    principal: Annotated[AuthPrincipal, Depends(get_auth_principal)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ConsentRecord:
    """Retrieve the active consent record for the authenticated principal.

    Raises:
        NotFoundError: If the user has no consent record.
    """
    # Fetch the user ID pk first
    stmt_user = select(UserAccountModel.id).where(UserAccountModel.user_id == principal.user_id)
    user_pk = await session.scalar(stmt_user)
    if not user_pk:
        raise NotFoundError(detail="User account not found.")

    stmt_consent = (
        select(ConsentRecordModel)
        .where(ConsentRecordModel.user_account_id == user_pk)
        .order_by(ConsentRecordModel.record_version.desc())
        .limit(1)
    )
    result = await session.execute(stmt_consent)
    model = result.scalar_one_or_none()

    if model is None:
        raise NotFoundError(detail="Consent record not found.")

    return ConsentRecord(
        user_id=principal.user_id,
        record_version=model.record_version,
        recorded_at=model.recorded_at,
        policy_version=model.policy_version,
        locale_presented=model.locale_presented,
        service_use=model.service_use,
        transcript_retention=model.transcript_retention,
        audio_storage=model.audio_storage,
        video_storage=model.video_storage,
        session_summary=model.session_summary,
        personalisation=model.personalisation,
        research_and_model_improvement=model.research_and_model_improvement,
        memory_consent=getattr(model, "memory_consent", False),
    )
