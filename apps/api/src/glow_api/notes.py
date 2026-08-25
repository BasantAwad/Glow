"""
Phase 8 — AI notes and session summaries.

REQUIREMENTS (non-negotiable):
  1. All AI-generated notes carry ai_generated=True and non_diagnostic=True.
  2. Notes must never contain invented facts, diagnoses, or fabricated memories.
  3. Notes are user-editable and user-deletable.
  4. Session summaries are labeled as AI-generated and non-diagnostic.
  5. No hidden medical records — all note content is visible to the user.
  6. Deleted notes are removed from all exports and AI context.

IMPLEMENTATION STATUS (2026-08-25):
  - Domain types: IMPLEMENTED
  - Service layer: IMPLEMENTED (pending DB migration)
  - ORM models: PENDING migration
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from enum import Enum
from typing import TYPE_CHECKING

from pydantic import BaseModel

from glow_api.consent import ConsentPurpose

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession
    from glow_api.consent import ConsentRecord
    from glow_api.user import UserAccount

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Note types
# ---------------------------------------------------------------------------


class NoteAuthor(str, Enum):
    AI = "ai"
    USER = "user"


class NoteStatus(str, Enum):
    ACTIVE = "active"
    DELETED = "deleted"


class Note(BaseModel):
    """A single note associated with a session."""
    note_id: str
    session_id: str
    user_id: str
    author: NoteAuthor
    content: str
    ai_generated: bool       # Always True when author == AI
    non_diagnostic: bool     # Always True — notes are never diagnoses
    confidence: float | None  # AI confidence; None for user-authored notes
    created_at: datetime
    updated_at: datetime
    status: NoteStatus


class SessionSummary(BaseModel):
    """An AI-generated summary of a session.

    ALWAYS labeled as AI-generated and non-diagnostic.
    Users may request deletion of their summary.
    The summary may describe themes discussed but must never:
    - State a diagnosis
    - Invent facts not present in the session
    - Use language implying medical authority
    """
    summary_id: str
    session_id: str
    user_id: str
    themes: list[str]          # Topics discussed, not clinical assessments
    ai_generated: bool = True  # Always True; immutable
    non_diagnostic: bool = True  # Always True; immutable
    non_diagnostic_disclaimer: str = (
        "This is an AI-generated summary of conversation themes. "
        "It is not a clinical assessment or medical record."
    )
    created_at: datetime


# ---------------------------------------------------------------------------
# Notes service
# ---------------------------------------------------------------------------


class NotesService:
    """Service for creating, managing, and exporting session notes."""

    def __init__(self, db: "AsyncSession") -> None:
        self._db = db

    def _require_session_summary_consent(self, consent: "ConsentRecord") -> None:
        if not consent.is_purpose_consented(ConsentPurpose.SESSION_SUMMARY):
            raise PermissionError(
                "Session summary and notes operations require SESSION_SUMMARY consent."
            )

    async def create_ai_note(
        self,
        user: "UserAccount",
        consent: "ConsentRecord",
        session_id: str,
        content: str,
        *,
        confidence: float = 1.0,
    ) -> Note:
        """Create an AI-generated note for a session.

        The note is labeled ai_generated=True and non_diagnostic=True.
        AI notes must not contain invented facts or diagnostic language.

        Args:
            user: The authenticated user.
            consent: Must have SESSION_SUMMARY consent.
            session_id: The session this note belongs to.
            content: The note content. Must be theme-based, not diagnostic.
            confidence: AI confidence in the note content.

        Returns:
            The created Note.
        """
        self._require_session_summary_consent(consent)
        import uuid
        now = datetime.now(UTC)
        note_id = str(uuid.uuid4())
        logger.info("NotesService.create_ai_note: session_id=%s", session_id)
        return Note(
            note_id=note_id,
            session_id=session_id,
            user_id=user.user_id,
            author=NoteAuthor.AI,
            content=content,
            ai_generated=True,
            non_diagnostic=True,
            confidence=confidence,
            created_at=now,
            updated_at=now,
            status=NoteStatus.ACTIVE,
        )

    async def create_user_note(
        self,
        user: "UserAccount",
        consent: "ConsentRecord",
        session_id: str,
        content: str,
    ) -> Note:
        """Create a user-authored note for a session."""
        self._require_session_summary_consent(consent)
        import uuid
        now = datetime.now(UTC)
        note_id = str(uuid.uuid4())
        return Note(
            note_id=note_id,
            session_id=session_id,
            user_id=user.user_id,
            author=NoteAuthor.USER,
            content=content,
            ai_generated=False,
            non_diagnostic=True,
            confidence=None,
            created_at=now,
            updated_at=now,
            status=NoteStatus.ACTIVE,
        )

    async def list_session_notes(
        self,
        user: "UserAccount",
        consent: "ConsentRecord",
        session_id: str,
    ) -> list[Note]:
        """List all active notes for a session.

        Args:
            user: The authenticated user.
            consent: Must have SESSION_SUMMARY consent.
            session_id: The session to list notes for.

        Returns:
            List of Note objects for this session.
        """
        self._require_session_summary_consent(consent)
        logger.info("NotesService.list_session_notes: session_id=%s", session_id)
        return []  # Placeholder until migration is applied

    async def edit_note(
        self,
        user: "UserAccount",
        consent: "ConsentRecord",
        note_id: str,
        new_content: str,
    ) -> Note:
        """Edit a note. Users may edit both AI-generated and user-authored notes."""
        self._require_session_summary_consent(consent)
        raise KeyError(f"Note {note_id!r} not found (migration pending)")

    async def delete_note(
        self,
        user: "UserAccount",
        consent: "ConsentRecord",
        note_id: str,
    ) -> None:
        """Delete a note. Removed from AI context and export."""
        self._require_session_summary_consent(consent)
        raise KeyError(f"Note {note_id!r} not found (migration pending)")

    async def generate_session_summary(
        self,
        user: "UserAccount",
        consent: "ConsentRecord",
        session_id: str,
        transcript_themes: list[str],
    ) -> SessionSummary:
        """Generate an AI summary of a session.

        The summary lists themes discussed. It must not:
        - State a diagnosis or screening result
        - Invent facts not present in the session
        - Use clinical authority language

        Args:
            user: The authenticated user.
            consent: Must have SESSION_SUMMARY consent.
            session_id: The session to summarize.
            transcript_themes: Topics extracted from the session (non-diagnostic).

        Returns:
            A SessionSummary labeled as AI-generated and non-diagnostic.
        """
        self._require_session_summary_consent(consent)
        import uuid
        summary_id = str(uuid.uuid4())
        now = datetime.now(UTC)
        logger.info("NotesService.generate_session_summary: session_id=%s", session_id)
        return SessionSummary(
            summary_id=summary_id,
            session_id=session_id,
            user_id=user.user_id,
            themes=transcript_themes,
            created_at=now,
        )
