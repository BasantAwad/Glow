"""
Session Router (Phase 2).
Exposes the session control plane and messaging endpoints.
"""

from typing import Any
from typing_extensions import Annotated

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from glow_api.dependencies import get_current_consent, get_current_user, get_db_session
from glow_api.consent import ConsentRecord
from glow_api.user import UserAccount
from glow_api.orchestrator import SessionOrchestrator
from glow_api.policy import ConversationPolicyEngine
from glow_api.model_gateway import get_model_gateway
from glow_api.stt_gateway import get_stt_gateway, TranscriptionRequest
from glow_api.tts_gateway import get_tts_gateway, SynthesizeRequest

router = APIRouter(prefix="/sessions", tags=["sessions"])


class SessionStartResponse(BaseModel):
    session_id: str
    state: str


class MessageRequest(BaseModel):
    content: str


class MessageResponse(BaseModel):
    reply: str


# Using a factory function for the orchestrator for dependency injection
def get_orchestrator(
    db: Annotated[Any, Depends(get_db_session)]
) -> SessionOrchestrator:
    gateway = get_model_gateway()
    policy_engine = ConversationPolicyEngine()
    return SessionOrchestrator(
        db_session=db,
        model_gateway=gateway,
        policy_engine=policy_engine
    )


@router.post("", response_model=SessionStartResponse)
async def start_session(
    user: Annotated[UserAccount, Depends(get_current_user)],
    consent: Annotated[ConsentRecord, Depends(get_current_consent)],
    orchestrator: Annotated[SessionOrchestrator, Depends(get_orchestrator)],
):
    """Start a new session."""
    result = await orchestrator.start_session(user, consent)
    return SessionStartResponse(**result)


@router.post("/{session_id}/message", response_model=MessageResponse)
async def send_message(
    session_id: str,
    request: MessageRequest,
    user: Annotated[UserAccount, Depends(get_current_user)],
    consent: Annotated[ConsentRecord, Depends(get_current_consent)],
    orchestrator: Annotated[SessionOrchestrator, Depends(get_orchestrator)],
):
    """Send a message to the active session."""
    reply = await orchestrator.handle_message(
        session_id=session_id,
        user=user,
        consent=consent,
        content=request.content
    )
    return {"reply": reply}


@router.websocket("/{session_id}/voice/stream")
async def voice_stream(
    websocket: WebSocket,
    session_id: str,
    # In a real app, WebSocket auth tokens are required here since headers aren't easily sent.
    # We will assume auth is handled via query params or a setup frame for now.
):
    """
    WebSocket endpoint for bidirectional voice streaming.
    Phase 6B (STT): Handles incoming audio chunks, yields partial/final transcripts,
                    and routes final transcripts to the LLM.
    Phase 6C (TTS): Will route LLM response back as audio (Currently stubbed to text fallback).
    """
    await websocket.accept()
    stt = get_stt_gateway()
    tts = get_tts_gateway()
    
    # We will use the get_orchestrator dependencies manually for this WebSocket prototype
    # In a production layout, dependencies are injected or resolved via the app state.
    from glow_api.database import db_manager
    
    try:
        # Accumulate audio buffer if needed for block-based STT like Whisper
        audio_buffer = bytearray()
        
        while True:
            # Receive client message (binary audio or JSON control messages)
            message = await websocket.receive()
            
            if "bytes" in message:
                audio_buffer.extend(message["bytes"])
                
                # For block-based Whisper, we wait for a specific silence/flush frame.
                # Here we just acknowledge partial receipt. 
                # If we had true streaming VAD, we'd yield partial transcripts here.
                await websocket.send_json({
                    "type": "stt_partial",
                    "text": "...", # placeholder until VAD flushes
                    "confidence": 0.0
                })
                
            elif "text" in message:
                import json
                data = json.loads(message["text"])
                if data.get("type") == "flush":
                    # Client indicates utterance is complete
                    if not audio_buffer:
                        continue
                        
                    req = TranscriptionRequest(
                        session_id=session_id,
                        audio_chunk=bytes(audio_buffer),
                        is_final=True
                    )
                    
                    stt_resp = await stt.transcribe(req)
                    audio_buffer.clear()
                    
                    # Yield final transcript back to client
                    await websocket.send_json({
                        "type": "stt_final",
                        "text": stt_resp.text,
                        "confidence": stt_resp.confidence
                    })
                    
                    # Route to LLM safety pipeline if confidence is acceptable
                    if stt_resp.confidence > 0.5 and stt_resp.text.strip():
                        # We must resolve the orchestrator to call the LLM
                        async with db_manager.session() as db:
                            orchestrator = get_orchestrator(db)
                            
                            from glow_api.user import UserPreferences, AccessibilityFlag
                            from datetime import datetime, timezone
                            
                            mock_prefs = UserPreferences(
                                locale="en", session_mode="voice", avatar_disclosure=True,
                                input_modality="voice", persona_name="Default",
                                accessibility=frozenset(), preferred_session_minutes=60
                            )
                            mock_user = UserAccount(
                                user_id="ws_user",
                                created_at=datetime.now(timezone.utc),
                                is_adult_confirmed=True,
                                is_active=True,
                                preferences=mock_prefs,
                                completed_sessions=0,
                                free_sessions_remaining=3
                            )
                            mock_consent = ConsentRecord(
                                user_id="ws_user",
                                record_version=1,
                                recorded_at=datetime.now(timezone.utc),
                                policy_version="1.0",
                                locale_presented="en",
                                service_use=True,
                                transcript_retention=False,
                                audio_storage=False,
                                video_storage=False,
                                session_summary=True,
                                personalisation=True,
                                research_and_model_improvement=False
                            )
                            
                            try:
                                reply = await orchestrator.handle_message(
                                    session_id=session_id,
                                    user=mock_user,
                                    consent=mock_consent,
                                    content=stt_resp.text
                                )
                                
                                # Send LLM text back first for fast UI updates
                                await websocket.send_json({
                                    "type": "llm_reply",
                                    "text": reply
                                })
                                
                                # Route to TTS pipeline
                                if tts.is_configured:
                                    tts_req = SynthesizeRequest(
                                        session_id=session_id,
                                        text=reply,
                                        language=stt_resp.language_detected or "en"
                                    )
                                    tts_resp = await tts.synthesize(tts_req)
                                    
                                    # Send binary audio frame back to client
                                    await websocket.send_bytes(tts_resp.audio_chunk)
                                    
                            except Exception as e:
                                await websocket.send_json({"type": "error", "message": str(e)})
                    else:
                        await websocket.send_json({
                            "type": "stt_error",
                            "message": "Low confidence transcript. Please clarify."
                        })
                        
    except WebSocketDisconnect:
        pass

