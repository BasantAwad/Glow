"""Session extras router (Phase 8+).

Endpoints:
- POST /sessions/{session_id}/mood — record pre/post session mood
- GET  /sessions/history — list user's session history
- GET  /sessions/{session_id}/summary — decrypted transcript
- POST /sessions/{session_id}/doctor-prep — doctor-ready summary text
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import Annotated

from glow_api.database import db_manager, get_db_session
from glow_api.dependencies import get_current_user
from glow_api.consent import ConsentRecord, ConsentPurpose
from glow_api.kms import kms_service
from glow_api.crypto import EnvelopeEncryption
from glow_api.user import UserAccount

router = APIRouter(prefix="/sessions", tags=["sessions-extras"])


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class MoodRequest(BaseModel):
    mood: int = Field(ge=1, le=5)
    when: str = Field(default="before", pattern=r"^(before|after)$")


class MoodResponse(BaseModel):
    session_id: str
    mood: int
    when: str
    recorded_at: str


class SessionHistoryEntry(BaseModel):
    session_id: str
    date: str
    duration_minutes: int | None
    mood_before: int | None
    mood_after: int | None
    preview: str | None = None


class SessionHistoryResponse(BaseModel):
    sessions: list[SessionHistoryEntry]
    total: int


class SummaryResponse(BaseModel):
    session_id: str
    messages: list[dict[str, str]]  # [{role, content}, ...]
    recorded_at: str


class DoctorPrepResponse(BaseModel):
    session_id: str
    prep_text: str
    recorded_at: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_session_record(db: AsyncSession, session_id: str, user_account_id: int):
    """Fetch a session record belonging to the given user."""
    from glow_api.models import SessionRecordModel
    stmt = select(SessionRecordModel).where(
        SessionRecordModel.session_id == session_id,
        SessionRecordModel.user_account_id == user_account_id,
    )
    result = db.execute(stmt)
    return result.scalar_one_or_none()


def _decrypt_messages(db: AsyncSession, session_record_id: int, consent: ConsentRecord):
    """Decrypt all messages for a session. Returns list of {role, content}."""
    from glow_api.models import SessionMessageModel
    if not consent.transcript_retention:
        return []

    stmt = select(SessionMessageModel).where(
        SessionMessageModel.session_record_id == session_record_id
    ).order_by(SessionMessageModel.timestamp.asc())
    result = db.execute(stmt)
    messages = result.scalars().all()

    decrypted = []
    for m in messages:
        key = kms_service.get_master_key(m.key_id)
        nonce = m.encrypted_content[:12]
        ciphertext = m.encrypted_content[12:]
        try:
            content = EnvelopeEncryption.decrypt(key, nonce, ciphertext).decode("utf-8")
            decrypted.append({"role": m.role, "content": content})
        except Exception:
            # Skip messages that fail to decrypt (corrupted key, etc.)
            continue
    return decrypted


def _generate_mood_label(mood: int | None) -> str:
    """Convert numeric mood (1-5) to label."""
    labels = {1: "Very low", 2: "Low", 3: "Okay", 4: "Good", 5: "Great"}
    return labels.get(mood, "—") if mood else "—"


def _generate_doctor_prep(session_record, messages: list[dict[str, str]], mood_before: int | None, mood_after: int | None) -> str:
    """Generate a doctor-ready plain text summary from session data."""
    from glow_api.models import SessionRecordModel

    date_str = session_record.started_at.isoformat() if session_record.started_at else "Unknown"
    duration = None
    if session_record.started_at and session_record.closed_at:
        duration = int((session_record.closed_at - session_record.started_at).total_seconds() / 60)

    preview = ""
    if messages:
        # Take last 5 assistant messages as preview
        assistant_msgs = [m["content"] for m in messages if m["role"] == "assistant"]
        preview = assistant_msgs[-1] if assistant_msgs else ""

    lines = [
        "MENTAL HEALTH SESSION SUMMARY",
        f"Date: {date_str}",
        f"Duration: {duration} min" if duration else "Duration: Unknown",
        "",
        "MOOD",
        f"Before: {_generate_mood_label(mood_before)}",
        f"After: {_generate_mood_label(mood_after)}",
        "",
        "WHAT I SHARED",
        preview or "(No transcript available — transcript retention may not be consented.)",
        "",
        "NOTES FOR MY DOCTOR",
        "- Review the above and discuss what might help.",
        "- If physical symptoms were mentioned (sleep, appetite, energy, pain),",
        "  ask about possible medical causes (thyroid, anemia, vitamin D, etc.).",
        "- Consider whether any medication adjustments are appropriate.",
        "- Ask about referral options if needed.",
        "",
        "This summary was generated by Glow, an AI support tool.",
        "It is not a medical document — please use it as a conversation",
        "starter with your healthcare provider.",
        "",
    ]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/{session_id}/mood", response_model=MoodResponse)
async def record_mood(
    session_id: str,
    request: MoodRequest,
    user: Annotated[UserAccount, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> MoodResponse:
    """Record a pre- or post-session mood rating (1-5)."""
    session = _get_session_record(db, session_id, user.internal_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Store mood on the session record (no dedicated column yet — use JSON extra_metadata)
    # For now, store in extra_metadata
    session.extra_metadata = session.extra_metadata or {}
    key = f"mood_{request.when}"
    session.extra_metadata[key] = request.mood
    session.extra_metadata["mood_updated_at"] = datetime.now(UTC).isoformat()
    db.add(session)
    await db.flush()

    return MoodResponse(
        session_id=session_id,
        mood=request.mood,
        when=request.when,
        recorded_at=datetime.now(UTC).isoformat(),
    )


@router.get("/history", response_model=SessionHistoryResponse)
async def get_session_history(
    db: Annotated[AsyncSession, Depends(get_db_session)],
    user: Annotated[UserAccount, Depends(get_current_user)],
    search: str | None = Query(None, description="Optional search query"),
) -> SessionHistoryResponse:
    """Return the user's session history, most recent first."""
    from glow_api.models import SessionRecordModel

    stmt = select(SessionRecordModel).where(
        SessionRecordModel.user_account_id == user.internal_id
    ).order_by(SessionRecordModel.started_at.desc())
    result = db.execute(stmt)
    sessions = result.scalars().all()

    entries = []
    for s in sessions:
        # Apply search filter if provided
        if search:
            preview = s.extra_metadata.get("last_preview", "") if s.extra_metadata else ""
            if search.lower() not in (s.session_id.lower() + s.started_at.isoformat().lower() + preview.lower()):
                continue

        mood_before = s.extra_metadata.get("mood_before") if s.extra_metadata else None
        mood_after = s.extra_metadata.get("mood_after") if s.extra_metadata else None

        duration = None
        if s.started_at and s.closed_at:
            duration = int((s.closed_at - s.started_at).total_seconds() / 60)

        entries.append(SessionHistoryEntry(
            session_id=s.session_id,
            date=s.started_at.isoformat()[:10] if s.started_at else "Unknown",
            duration_minutes=duration,
            mood_before=mood_before,
            mood_after=mood_after,
            preview=s.extra_metadata.get("last_preview") if s.extra_metadata else None,
        ))

    return SessionHistoryResponse(sessions=entries, total=len(entries))


@router.get("/{session_id}/summary", response_model=SummaryResponse)
async def get_session_summary(
    session_id: str,
    user: Annotated[UserAccount, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> SummaryResponse:
    """Return decrypted transcript for a session (requires transcript_retention consent)."""
    from glow_api.models import UserAccountModel, ConsentRecordModel

    user_row = await db.execute(
        select(UserAccountModel).where(UserAccountModel.user_id == user.user_id)
    )
    user_model = user_row.scalar_one_or_none()
    if not user_model:
        raise HTTPException(status_code=404, detail="User not found")

    consent_row = await db.execute(
        select(ConsentRecordModel)
        .where(ConsentRecordModel.user_account_id == user_model.id)
        .order_by(ConsentRecordModel.record_version.desc())
        .limit(1)
    )
    consent_model = consent_row.scalar_one_or_none()
    if not consent_model:
        raise HTTPException(status_code=403, detail="No consent on file")

    consent = ConsentRecord(
        user_id=user.user_id,
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

    session = _get_session_record(db, session_id, user_model.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = _decrypt_messages(db, session.id, consent)
    return SummaryResponse(
        session_id=session_id,
        messages=messages,
        recorded_at=datetime.now(UTC).isoformat(),
    )


@router.post("/{session_id}/doctor-prep", response_model=DoctorPrepResponse)
async def generate_doctor_prep(
    session_id: str,
    user: Annotated[UserAccount, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> DoctorPrepResponse:
    """Generate a doctor-ready plain text summary for a session."""
    session = _get_session_record(db, session_id, user.internal_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get consent to decrypt messages
    from glow_api.models import UserAccountModel, ConsentRecordModel
    user_row = await db.execute(
        select(UserAccountModel).where(UserAccountModel.user_id == user.user_id)
    )
    user_model = user_row.scalar_one_or_none()
    if not user_model:
        raise HTTPException(status_code=404, detail="User not found")

    consent_row = await db.execute(
        select(ConsentRecordModel)
        .where(ConsentRecordModel.user_account_id == user_model.id)
        .order_by(ConsentRecordModel.record_version.desc())
        .limit(1)
    )
    consent_model = consent_row.scalar_one_or_none()
    consent = None
    messages = []
    if consent_model:
        consent = ConsentRecord(
            user_id=user.user_id,
            record_version=consent_model.record_version,
            recorded_at=consent_model.recorded_at,
            policy_version=consent_model.policy_version,
            locale_presented=consent_model.locale_presented,
            expected_verification_method=getattr(consent_model, "expected_verification_method", "jwt_bearer"),
            service_use=consent_model.service_use,
            transcript_retention=consent_model.transcript_retention,
            audio_storage=consent_model.audio_storage,
            video_storage=consent_model.video_storage,
            session_summary=consent_model.session_summary,
            personalisation=consent_model.personalisation,
            research_and_model_improvement=consent_model.research_and_model_improvement,
            memory_consent=getattr(consent_model, "memory_consent", False),
        )
        messages = _decrypt_messages(db, session.id, consent)

    mood_before = session.extra_metadata.get("mood_before") if session.extra_metadata else None
    mood_after = session.extra_metadata.get("mood_after") if session.extra_metadata else None

    prep_text = _generate_doctor_prep(session, messages, mood_before, mood_after)
    return DoctorPrepResponse(
        session_id=session_id,
        prep_text=prep_text,
        recorded_at=datetime.now(UTC).isoformat(),
    )
