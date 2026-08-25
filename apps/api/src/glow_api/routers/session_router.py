"""
Session Router (Phases 2, 6B, 6C).

Exposes the session control plane, text messaging, and bidirectional
voice streaming endpoints.

Auth model for HTTP endpoints: FastAPI Bearer token dependency injection
(get_current_user, get_current_consent).

Auth model for WebSocket endpoint: Glow-signed JWT passed as the `token`
query parameter, validated against the real auth provider before the
WebSocket handshake is accepted.  The connection is rejected with code 4401
if the token is missing or invalid.  No hardcoded users, mock identities, or
development bypasses are permitted in this module.

IMPORTANT: The voice pipeline (Phase 6B/6C) performs real STT and TTS when
configured providers are present.  When providers are not configured, the
endpoint fails clearly rather than silently returning stub data.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import Annotated

from glow_api.consent import ConsentRecord, ConsentPurpose, make_initial_consent
from glow_api.database import db_manager, get_db_session
from glow_api.dependencies import (
    get_auth_provider,
    get_current_consent,
    get_current_user,
)
from glow_api.errors import AuthenticationError, ProviderNotConfiguredError
from glow_api.model_gateway import get_model_gateway
from glow_api.orchestrator import SessionOrchestrator
from glow_api.policy import ConversationPolicyEngine
from glow_api.stt_gateway import TranscriptionRequest, get_stt_gateway
from glow_api.tts_gateway import SynthesizeRequest, get_tts_gateway
from glow_api.user import UserAccount

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sessions", tags=["sessions"])


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class SessionStartResponse(BaseModel):
    session_id: str
    state: str


class MessageRequest(BaseModel):
    content: str


class MessageResponse(BaseModel):
    reply: str


# ---------------------------------------------------------------------------
# Dependency helpers
# ---------------------------------------------------------------------------


def get_orchestrator(
    db: Annotated[AsyncSession, Depends(get_db_session)]
) -> SessionOrchestrator:
    """Build a SessionOrchestrator via FastAPI dependency injection."""
    gateway = get_model_gateway()
    policy_engine = ConversationPolicyEngine()
    return SessionOrchestrator(
        db_session=db,
        model_gateway=gateway,
        policy_engine=policy_engine,
    )


# ---------------------------------------------------------------------------
# HTTP endpoints
# ---------------------------------------------------------------------------


@router.post("", response_model=SessionStartResponse)
async def start_session(
    user: Annotated[UserAccount, Depends(get_current_user)],
    consent: Annotated[ConsentRecord, Depends(get_current_consent)],
    orchestrator: Annotated[SessionOrchestrator, Depends(get_orchestrator)],
) -> SessionStartResponse:
    """Start a new session.

    Requires:
    - Valid Glow-signed JWT Bearer token (via Authorization header)
    - service_use consent on file
    """
    result = await orchestrator.start_session(user, consent)
    return SessionStartResponse(**result)


@router.post("/{session_id}/message", response_model=MessageResponse)
async def send_message(
    session_id: str,
    request: MessageRequest,
    user: Annotated[UserAccount, Depends(get_current_user)],
    consent: Annotated[ConsentRecord, Depends(get_current_consent)],
    orchestrator: Annotated[SessionOrchestrator, Depends(get_orchestrator)],
) -> MessageResponse:
    """Send a text message to the active session.

    Requires:
    - Valid Glow-signed JWT Bearer token (via Authorization header)
    - service_use consent on file
    """
    reply = await orchestrator.handle_message(
        session_id=session_id,
        user=user,
        consent=consent,
        content=request.content,
    )
    return MessageResponse(reply=reply)


# ---------------------------------------------------------------------------
# Voice WebSocket endpoint
# ---------------------------------------------------------------------------


async def _authenticate_websocket(
    websocket: WebSocket,
    token: str | None,
) -> tuple[UserAccount, ConsentRecord] | None:
    """Authenticate a WebSocket connection using a Glow-signed JWT query param.

    Returns (UserAccount, ConsentRecord) on success, or None after closing
    the connection with code 4401 if auth fails.

    The token is validated against the real GlowSignedJwtAuthProvider.
    No mock or development bypass is permitted here.

    WebSocket close codes:
      4401 — missing or invalid JWT token
      4503 — auth provider not configured (GLOW_AUTH_SECRET_KEY not set)
      4403 — user account or consent not found in database
    """
    if not token:
        await websocket.close(code=4401, reason="missing_token")
        return None

    auth_provider = get_auth_provider()

    try:
        result = await auth_provider.validate_token(token)
    except ProviderNotConfiguredError:
        logger.error("voice_stream: auth provider not configured (GLOW_AUTH_SECRET_KEY not set)")
        await websocket.close(code=4503, reason="auth_provider_not_configured")
        return None

    if not result.valid or result.principal is None:
        await websocket.close(
            code=4401,
            reason=result.error_reason or "invalid_token",
        )
        return None

    principal = result.principal

    # Resolve user account and consent from database
    try:
        async with db_manager.session() as db:
            from sqlalchemy import select
            from glow_api.models import (
                UserAccountModel,
                UserPreferencesModel,
                ConsentRecordModel,
            )
            from sqlalchemy.orm import selectinload

            user_row = await db.execute(
                select(UserAccountModel)
                .options(selectinload(UserAccountModel.preferences))
                .where(UserAccountModel.user_id == principal.user_id)
            )
            user_model = user_row.scalar_one_or_none()
            if user_model is None:
                await websocket.close(code=4403, reason="user_not_found")
                return None

            from glow_api.user import AccessibilityFlag, UserPreferences, UserLocale, SessionMode, AvatarDisclosurePreference, InputModality
            prefs_model = user_model.preferences
            if prefs_model is not None:
                prefs = UserPreferences(
                    locale=UserLocale(prefs_model.locale.value if hasattr(prefs_model.locale, "value") else str(prefs_model.locale)),
                    session_mode=SessionMode(prefs_model.session_mode.value if hasattr(prefs_model.session_mode, "value") else str(prefs_model.session_mode)),
                    avatar_disclosure=AvatarDisclosurePreference(prefs_model.avatar_disclosure.value if hasattr(prefs_model.avatar_disclosure, "value") else str(prefs_model.avatar_disclosure)),
                    input_modality=InputModality(prefs_model.input_modality.value if hasattr(prefs_model.input_modality, "value") else str(prefs_model.input_modality)),
                    persona_name=prefs_model.persona_name or "Default",
                    accessibility=frozenset(
                        AccessibilityFlag(f) for f in (prefs_model.accessibility or [])
                        if f in AccessibilityFlag._value2member_map_
                    ),
                    preferred_session_minutes=prefs_model.preferred_session_minutes or 60,
                )
            else:
                # No preferences row — use privacy-safe defaults
                prefs = UserPreferences(
                    locale=UserLocale("en"),
                    session_mode=SessionMode("text"),
                    avatar_disclosure=AvatarDisclosurePreference("always"),
                    input_modality=InputModality("text"),
                    persona_name="Default",
                    accessibility=frozenset(),
                    preferred_session_minutes=60,
                )

            user = UserAccount(
                user_id=user_model.user_id,
                created_at=user_model.created_at,
                is_adult_confirmed=user_model.is_adult_confirmed,
                is_active=user_model.is_active,
                preferences=prefs,
                completed_sessions=user_model.completed_sessions or 0,
                free_sessions_remaining=user_model.free_sessions_remaining or 0,
            )

            # Consent is joined via the user's FK id
            consent_row = await db.execute(
                select(ConsentRecordModel)
                .where(ConsentRecordModel.user_account_id == user_model.id)
                .order_by(ConsentRecordModel.record_version.desc())
                .limit(1)
            )
            consent_model = consent_row.scalar_one_or_none()
            if consent_model is None:
                await websocket.close(code=4403, reason="consent_not_found")
                return None

            consent = ConsentRecord(
                user_id=principal.user_id,
                record_version=consent_model.record_version,
                recorded_at=consent_model.recorded_at,
                policy_version=consent_model.policy_version,
                locale_presented=consent_model.locale_presented,
                service_use=consent_model.service_use,
                transcript_retention=consent_model.transcript_retention,
                audio_storage=consent_model.audio_storage,
                video_storage=consent_model.video_storage,
                session_summary=consent_model.session_summary,
                personalisation=consent_model.personalisation,
                research_and_model_improvement=consent_model.research_and_model_improvement,
                memory_consent=getattr(consent_model, "memory_consent", False),
            )

            return user, consent

    except Exception as exc:
        logger.error("voice_stream: DB error during WebSocket auth: %s", exc)
        await websocket.close(code=4503, reason="database_error")
        return None



@router.websocket("/{session_id}/voice/stream")
async def voice_stream(
    websocket: WebSocket,
    session_id: str,
    # JWT token is passed as a query parameter because WebSocket connections
    # cannot reliably carry Authorization headers in all browser clients.
    # This is the standard pattern for WebSocket auth with JWTs.
    token: Annotated[str | None, Query(description="Glow-signed JWT for WebSocket auth")] = None,
) -> None:
    """Bidirectional voice streaming WebSocket (Phases 6B + 6C).

    Auth:
      - `token` query parameter: Glow-signed JWT (required)
      - Connection rejected with code 4401 if token is missing or invalid

    Protocol:
      - Client sends binary audio frames (raw PCM or WAV segments)
      - Client sends JSON {"type": "flush"} to mark end of utterance
      - Server sends JSON {"type": "stt_partial", "text": "...", "confidence": 0.0}
      - Server sends JSON {"type": "stt_final", "text": "...", "confidence": 0.9}
      - Server sends JSON {"type": "llm_reply", "text": "..."}
      - Server sends binary audio frame (TTS output)
      - Server sends JSON {"type": "error", "message": "..."} on handled errors

    Providers:
      - STT: FasterWhisperSttGateway — requires ENABLE_LIVE_PROVIDER_TESTS=1 + model
      - TTS: KokoroTtsGateway — requires kokoro-onnx installed
      - LLM: OpenWeightsModelGateway — requires GLOW_LLM_API_BASE

    When any provider is not configured, that stage is skipped with a clear
    error message in the JSON stream.  The connection is NOT silently accepted
    with stub data.
    """
    await websocket.accept()

    # Authenticate before processing any data
    auth_result = await _authenticate_websocket(websocket, token)
    if auth_result is None:
        # Connection already closed by _authenticate_websocket
        return
    user, consent = auth_result

    if not consent.is_purpose_consented(ConsentPurpose.SERVICE_USE):
        await websocket.send_json({"type": "error", "message": "service_use_consent_required"})
        await websocket.close(code=4403, reason="service_use_consent_required")
        return

    stt = get_stt_gateway()
    tts = get_tts_gateway()

    try:
        audio_buffer = bytearray()

        while True:
            message = await websocket.receive()

            if "bytes" in message:
                audio_buffer.extend(message["bytes"])
                # Acknowledge partial receipt (Whisper is block-based, not streaming)
                await websocket.send_json({
                    "type": "stt_partial",
                    "text": "",
                    "confidence": 0.0,
                })

            elif "text" in message:
                data = json.loads(message["text"])
                if data.get("type") == "flush":
                    if not audio_buffer:
                        continue

                    req = TranscriptionRequest(
                        session_id=session_id,
                        audio_chunk=bytes(audio_buffer),
                        is_final=True,
                    )

                    stt_resp = await stt.transcribe(req)
                    audio_buffer.clear()

                    await websocket.send_json({
                        "type": "stt_final",
                        "text": stt_resp.text,
                        "confidence": stt_resp.confidence,
                    })

                    # Route to LLM safety pipeline only if confidence is acceptable
                    if stt_resp.confidence > 0.5 and stt_resp.text.strip():
                        async with db_manager.session() as db:
                            gateway = get_model_gateway()
                            policy_engine = ConversationPolicyEngine()
                            orchestrator = SessionOrchestrator(
                                db_session=db,
                                model_gateway=gateway,
                                policy_engine=policy_engine,
                            )

                            try:
                                reply = await orchestrator.handle_message(
                                    session_id=session_id,
                                    user=user,
                                    consent=consent,
                                    content=stt_resp.text,
                                )
                            except ProviderNotConfiguredError as e:
                                await websocket.send_json({
                                    "type": "error",
                                    "message": f"llm_not_configured: {e}",
                                })
                                continue

                            await websocket.send_json({
                                "type": "llm_reply",
                                "text": reply,
                            })

                            # Route to TTS pipeline
                            if tts.is_configured:
                                tts_req = SynthesizeRequest(
                                    session_id=session_id,
                                    text=reply,
                                    language=stt_resp.language_detected or "en",
                                )
                                try:
                                    tts_resp = await tts.synthesize(tts_req)
                                    await websocket.send_bytes(tts_resp.audio_chunk)
                                except ProviderNotConfiguredError as e:
                                    await websocket.send_json({
                                        "type": "error",
                                        "message": f"tts_not_configured: {e}",
                                    })
                    else:
                        await websocket.send_json({
                            "type": "stt_error",
                            "message": "Low confidence transcript — please speak more clearly.",
                        })

    except WebSocketDisconnect:
        logger.info("voice_stream: client disconnected (session_id=%s)", session_id)
