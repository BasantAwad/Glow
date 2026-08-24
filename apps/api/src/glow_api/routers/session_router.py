"""
Session Router (Phase 2).
Exposes the session control plane and messaging endpoints.
"""

from typing import Any
from typing_extensions import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from glow_api.dependencies import get_current_consent, get_current_user, get_db_session
from glow_api.consent import ConsentRecord
from glow_api.user import UserAccount
from glow_api.orchestrator import SessionOrchestrator
from glow_api.policy import ConversationPolicyEngine
from glow_api.model_gateway import UnconfiguredModelGateway

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
    # Phase 2 uses the unconfigured gateway per CLAUDE.md until provider chosen
    gateway = UnconfiguredModelGateway()
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
