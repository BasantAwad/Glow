"""
Session Orchestrator (Phase 2/3).

Coordinates the session state machine, the safety control plane,
the model gateway, and database persistence.
"""

from __future__ import annotations

import datetime
import uuid
from typing import Sequence

from glow_api.kms import kms_service
from glow_api.crypto import EnvelopeEncryption

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from glow_api.consent import ConsentRecord
from glow_api.errors import NotFoundError, AuthenticationError
from glow_api.model_gateway import GenerationRequest, ModelGateway
from glow_api.models import (
    SafetyAuditEventModel,
    SessionMessageModel,
    SessionRecordModel,
)
from glow_api.policy import ConversationPolicyEngine
from glow_api.safety import (
    CrisisFSM,
    SAFETY_POLICY_VERSION,
    SafetyCheckResult,
    run_post_generation_check,
    run_pre_generation_check,
)
from glow_api.session import (
    SessionRecord,
    SessionState,
    advance_session,
    make_session,
)
from glow_api.user import UserAccount


class SessionOrchestrator:
    """Coordinates session flow and safety plane."""

    def __init__(
        self,
        db_session: AsyncSession,
        model_gateway: ModelGateway,
        policy_engine: ConversationPolicyEngine,
    ):
        self.db = db_session
        self.model = model_gateway
        self.policy_engine = policy_engine
        
        # Currently, FSMs are reconstructed from DB state.
        # In a real distributed system, CrisisFSM state might be cached in Redis.
        self.crisis_fsms: dict[str, CrisisFSM] = {}

    def _get_crisis_fsm(self, session_id: str) -> CrisisFSM:
        if session_id not in self.crisis_fsms:
            self.crisis_fsms[session_id] = CrisisFSM()
        return self.crisis_fsms[session_id]

    async def _audit_safety_decision(
        self,
        session_id: str,
        user_id: str,
        result: SafetyCheckResult,
    ) -> None:
        """Persist a safety audit event."""
        action = "blocked" if result.block_generation else "allowed"
        if result.require_crisis:
            action = "crisis_escalation"

        event = SafetyAuditEventModel(
            event_id=str(uuid.uuid4()),
            session_id=session_id,
            user_id=user_id,
            occurred_at=datetime.datetime.now(datetime.UTC),
            check_type="pre_generation" if result.is_pre_generation else "post_generation",
            risk_tier=int(result.risk_tier),
            signals=[s.value for s in result.signals],
            action_taken=action,
            audit_note=result.audit_note,
            policy_version=SAFETY_POLICY_VERSION,
        )
        self.db.add(event)
        await self.db.flush()

    async def _save_message(
        self,
        session_id: str,
        record_id: int,
        consent: ConsentRecord,
        role: str,
        content: str,
    ) -> None:
        """Save a message if transcript retention is consented to."""
        if consent.transcript_retention:
            key_id = "default"
            key = kms_service.get_master_key(key_id)
            nonce, ciphertext = EnvelopeEncryption.encrypt(key, content.encode('utf-8'))
            
            msg = SessionMessageModel(
                session_record_id=record_id,
                role=role,
                encrypted_content=nonce + ciphertext,
                key_id=key_id,
                timestamp=datetime.datetime.now(datetime.UTC)
            )
            self.db.add(msg)
            await self.db.flush()

    async def start_session(
        self,
        user: UserAccount,
        consent: ConsentRecord,
    ) -> dict[str, str]:
        """Start a new active session."""
        if not user.can_start_session:
            raise AuthenticationError(detail="User cannot start sessions (age unverified or inactive).")
        
        if not self.policy_engine.can_start_session(user):
            raise ValueError("Billing required. Please purchase sessions.")

        policy = self.policy_engine.evaluate_policy(user)

        # 1. Create pure domain record
        record = make_session(
            user_id=user.user_id,
            mode=user.preferences.session_mode.value,
            consent_version=consent.policy_version,
            summary_consent=consent.session_summary,
            policy=policy,
        )
        record = advance_session(record, SessionState.ACTIVE, policy=policy)

        # 2. Persist to DB
        # User internal ID lookup
        from glow_api.models import UserAccountModel
        stmt = select(UserAccountModel).where(UserAccountModel.user_id == user.user_id)
        result = await self.db.execute(stmt)
        db_user = result.scalar_one_or_none()
        if not db_user:
            raise NotFoundError(detail="User account not found in database.")

        db_record = SessionRecordModel(
            session_id=record.session_id,
            user_account_id=db_user.id,
            state=record.state.value,
            mode=record.mode,
            created_at=record.created_at,
            started_at=record.started_at,
            closed_at=record.closed_at,
            hard_limit_at=record.hard_limit_at,
            paused_duration_seconds=int(record.paused_duration.total_seconds()),
            is_crisis=record.is_crisis,
            closure_reason=record.closure_reason,
            consent_version=record.consent_version,
            summary_generated=record.summary_generated,
            summary_consent=record.summary_consent,
        )
        self.db.add(db_record)
        await self.db.commit()

        return {"session_id": record.session_id, "state": record.state.value}

    async def handle_message(
        self,
        session_id: str,
        user: UserAccount,
        consent: ConsentRecord,
        content: str,
    ) -> str:
        """Process a user message through the safety control plane and model."""
        stmt = select(SessionRecordModel).where(SessionRecordModel.session_id == session_id)
        res = await self.db.execute(stmt)
        db_session = res.scalar_one_or_none()
        if not db_session:
            raise NotFoundError(detail="Session not found.")
        
        if db_session.state != SessionState.ACTIVE.value:
            raise ValueError(f"Cannot send message to session in state {db_session.state}.")

        # Advance CrisisFSM if needed
        fsm = self._get_crisis_fsm(session_id)
        # Handle crisis interactions if FSM is active (simplified for Phase 2)
        if fsm.requires_session_crisis_state:
            return "Crisis protocol active. Please call emergency services."

        # PRE-GENERATION CHECK
        pre_check = run_pre_generation_check(
            user_input=content,
            is_adult_confirmed=user.is_adult_confirmed,
            session_language=user.preferences.locale.value
        )
        
        await self._audit_safety_decision(session_id, user.user_id, pre_check)
        
        # Save user message
        await self._save_message(session_id, db_session.id, consent, "user", content)

        if pre_check.block_generation:
            # Blocked by deterministic safety rules
            reply = pre_check.response_override or "Message blocked by safety filters."
            await self._save_message(session_id, db_session.id, consent, "assistant", reply)
            await self.db.commit()
            return reply

        # GATHER HISTORY
        history_stmt = select(SessionMessageModel).where(
            SessionMessageModel.session_record_id == db_session.id
        ).order_by(SessionMessageModel.timestamp.asc())
        history_res = await self.db.execute(history_stmt)
        history_msgs = history_res.scalars().all()
        
        history_tuples = []
        for m in history_msgs:
            key = kms_service.get_master_key(m.key_id)
            nonce = m.encrypted_content[:12]
            ciphertext = m.encrypted_content[12:]
            decrypted = EnvelopeEncryption.decrypt(key, nonce, ciphertext).decode('utf-8')
            if decrypted != content:
                history_tuples.append((m.role, decrypted))
                
        history_tuples = tuple(history_tuples)

        # GENERATE
        request = GenerationRequest(
            session_id=session_id,
            user_id=user.user_id,
            system_prompt=(
                "You are Glow, an AI mental-health support companion. You are an AI, "
                "never a human, never a licensed therapist, and never a replacement for "
                "professional care or emergency services.\n"
                "Conversation style:\n"
                "- Respond in 2-4 short conversational sentences. No lists, no headers, "
                "no emojis, no markdown formatting.\n"
                "- Be warm and human-paced: reflect what the user said first, then be "
                "curious rather than advice-giving.\n"
                "- Ask at most one gentle question per reply.\n"
                "- Never diagnose, never mention medications, never give medical advice.\n"
                "- If the user mentions self-harm, suicide, or danger to others: respond "
                "calmly, check their immediate safety with one direct question, and "
                "encourage contacting local emergency services or a crisis line. Never "
                "provide methods or procedural detail of any kind.\n"
                f"- The session language is {user.preferences.locale.value}; reply in English."
            ),
            conversation_history=history_tuples,
            user_message=content,
            locale=user.preferences.locale.value,
        )
        response = await self.model.generate(request)

        # POST-GENERATION CHECK
        post_check = run_post_generation_check(
            model_output=response.text,
            session_language=user.preferences.locale.value
        )
        
        await self._audit_safety_decision(session_id, user.user_id, post_check)

        if post_check.block_generation:
            reply = post_check.response_override or "The generated response was blocked for safety reasons."
        else:
            reply = response.text

        # Save assistant message
        await self._save_message(session_id, db_session.id, consent, "assistant", reply)
        await self.db.commit()

        return reply
