"""
SQLAlchemy ORM models (Phase 1).

Maps the pure Python domain types (UserAccount, UserPreferences, ConsentRecord)
to database tables.

The persistence layer translates between these ORM models and the domain types.
"""

from __future__ import annotations

from typing import Any
import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, LargeBinary, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from glow_api.database import Base
from glow_api.user import (
    AvatarDisclosurePreference,
    InputModality,
    SessionMode,
    UserLocale,
)


class UserAccountModel(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_adult_confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    completed_sessions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    free_sessions_remaining: Mapped[int] = mapped_column(
        Integer, default=3, nullable=False,
        server_default="3",
    )
    __table_args__ = (
        # Check constraint: free_sessions_remaining >= 0
        # (not applicable to SQLite, enforced in domain model)
    )

    preferences: Mapped["UserPreferencesModel"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    consents: Mapped[list["ConsentRecordModel"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", order_by="desc(ConsentRecordModel.record_version)"
    )


class UserPreferencesModel(Base):
    __tablename__ = "user_preferences"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_account_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)

    locale: Mapped[UserLocale] = mapped_column(Enum(UserLocale, name="user_locale", native_enum=False), nullable=False)
    session_mode: Mapped[SessionMode] = mapped_column(Enum(SessionMode, name="session_mode", native_enum=False), nullable=False)
    avatar_disclosure: Mapped[AvatarDisclosurePreference] = mapped_column(Enum(AvatarDisclosurePreference, name="avatar_disclosure", native_enum=False), nullable=False)
    input_modality: Mapped[InputModality] = mapped_column(Enum(InputModality, name="input_modality", native_enum=False), nullable=False)
    persona_name: Mapped[str | None] = mapped_column(String(40), nullable=True)
    accessibility: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    preferred_session_minutes: Mapped[int] = mapped_column(Integer, default=60, nullable=False)

    user: Mapped["UserAccountModel"] = relationship(back_populates="preferences")


class ConsentRecordModel(Base):
    __tablename__ = "consent_records"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_account_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)

    record_version: Mapped[int] = mapped_column(
        Integer, nullable=False,
        server_default="1",
    )
    __table_args__ = (
        # Check constraint: record_version >= 1
    )
    recorded_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    policy_version: Mapped[str] = mapped_column(String(64), nullable=False)
    locale_presented: Mapped[str] = mapped_column(String(20), nullable=False)

    # Consent purposes
    service_use: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    transcript_retention: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    audio_storage: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    video_storage: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    session_summary: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    personalisation: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    research_and_model_improvement: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Long-term memory consent (ADR 0004) — separate opt-in, never bundled.
    # Default: False.  server_default ensures existing rows without this column
    # safely interpret as no memory consent.
    memory_consent: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    # How the user was verified when consent was given (e.g. "jwt_bearer").
    # Stored for audit trail completeness.  Must be non-empty in new records.
    expected_verification_method: Mapped[str] = mapped_column(
        String(128), nullable=False, default="jwt_bearer"
    )

    user: Mapped["UserAccountModel"] = relationship(back_populates="consents")


# ---------------------------------------------------------------------------
# Phase 2: Session and Safety Models
# ---------------------------------------------------------------------------


class SessionRecordModel(Base):
    __tablename__ = "session_records"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    user_account_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)

    state: Mapped[str] = mapped_column(String(32), nullable=False)
    mode: Mapped[str] = mapped_column(String(32), nullable=False)
    
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    started_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    hard_limit_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    paused_duration_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_crisis: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    closure_reason: Mapped[str | None] = mapped_column(String(32), nullable=True)
    
    consent_version: Mapped[str] = mapped_column(String(64), nullable=False)
    summary_generated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    summary_consent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped["UserAccountModel"] = relationship()


class SessionMessageModel(Base):
    """Stores conversation history. ONLY populated if transcript_retention consent is True."""
    __tablename__ = "session_messages"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_record_id: Mapped[int] = mapped_column(ForeignKey("session_records.id", ondelete="CASCADE"), index=True, nullable=False)
    
    role: Mapped[str] = mapped_column(String(32), nullable=False)  # 'user' or 'assistant'
    encrypted_content: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    key_id: Mapped[str] = mapped_column(String(64), nullable=False, default="default")
    timestamp: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.UTC), nullable=False)
    
    session: Mapped["SessionRecordModel"] = relationship()


class SafetyAuditEventModel(Base):
    """Structured audit store for safety decisions. Does not contain raw PII or therapy transcripts."""
    __tablename__ = "safety_audit_events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    event_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    session_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    user_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    
    occurred_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    check_type: Mapped[str] = mapped_column(String(32), nullable=False)
    risk_tier: Mapped[int] = mapped_column(Integer, nullable=False)
    
    # Store JSON array of signal names
    signals: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    action_taken: Mapped[str] = mapped_column(String(64), nullable=False)
    audit_note: Mapped[str] = mapped_column(String, nullable=False)
    policy_version: Mapped[str] = mapped_column(String(64), nullable=False)
    extra_metadata: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)


# ---------------------------------------------------------------------------
# Phase 4: Evidence and RAG Models
# ---------------------------------------------------------------------------

class EvidenceEntryModel(Base):
    """Stores approved clinical evidence entries with full provenance metadata."""
    __tablename__ = "evidence_entries"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    entry_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    
    title: Mapped[str] = mapped_column(String, nullable=False)
    content_text: Mapped[str] = mapped_column(String, nullable=False)
    
    # Store the vector embedding for semantic search
    embedding: Mapped[Any] = mapped_column(JSON, nullable=True)

    evidence_type: Mapped[str] = mapped_column(String(64), nullable=False)
    locale: Mapped[str] = mapped_column(String(20), nullable=False)
    
    # Store tuples as JSON arrays
    jurisdiction: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    
    license: Mapped[str] = mapped_column(String(64), nullable=False)
    license_url: Mapped[str] = mapped_column(String, nullable=False)
    source_url: Mapped[str] = mapped_column(String, nullable=False)
    source_name: Mapped[str] = mapped_column(String, nullable=False)
    
    retrieved_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    retrieved_by: Mapped[str] = mapped_column(String, nullable=False)
    
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    approved_by: Mapped[str | None] = mapped_column(String, nullable=True)
    approved_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Store set as JSON array
    permitted_uses: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    clinical_notes: Mapped[str] = mapped_column(String, default="", nullable=False)

