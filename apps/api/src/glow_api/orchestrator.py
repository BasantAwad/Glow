"""Session Orchestrator (Phase 2/3).

Coordinates the session state machine, the safety control plane,
the model gateway, and database persistence.
"""

from __future__ import annotations

import datetime
import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from glow_api.consent import ConsentRecord
from glow_api.crypto import EnvelopeEncryption
from glow_api.errors import AuthenticationError, NotFoundError
from glow_api.evidence import (
    build_evidence_context,
    format_evidence_citations,
    retrieve_approved_evidence,
)
from glow_api.kms import kms_service
from glow_api.model_gateway import GenerationRequest, ModelGateway
from glow_api.models import (
    SafetyAuditEventModel,
    SessionMessageModel,
    SessionRecordModel,
)
from glow_api.policy import ConversationPolicyEngine
from glow_api.safety import (
    SAFETY_POLICY_VERSION,
    CrisisFSM,
    SafetyCheckResult,
    run_post_generation_check,
    run_pre_generation_check,
)
from glow_api.session import (
    SessionState,
    advance_session,
    make_session,
)
from glow_api.settings import settings
from glow_api.user import UserAccount

logger = logging.getLogger(__name__)


def _build_therapeutic_system_prompt(
    locale: str,
    session_mode: str = "open",
    therapist_gender: str = "female",
) -> str:
    """Build the Glow system prompt.

    The detailed prompt lives in ``glow_api.prompts`` so it can be reviewed and
    tested independently of the orchestrator.
    """
    from glow_api.prompts import build_therapeutic_system_prompt

    return build_therapeutic_system_prompt(
        locale=locale,
        session_mode=session_mode,
        therapist_gender=therapist_gender,
    )


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
        mode: str = "open",
    ) -> dict[str, str]:
        """Start a new active session."""
        if not user.can_start_session:
            raise AuthenticationError(
                detail="User cannot start sessions (age unverified or inactive)."
            )

        if not self.policy_engine.can_start_session(user):
            raise ValueError("Billing required. Please purchase sessions.")

        policy = self.policy_engine.evaluate_policy(user)

        # 1. Create pure domain record
        record = make_session(
            user_id=user.user_id,
            mode=mode,
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

        # Secondary classifier — log distress signals for high-risk monitoring
        # Does NOT block generation; informational only unless escalated by future policy.
        try:
            from glow_api.safety_classifier import classify_distress
            classifier_result = classify_distress(content)
            if classifier_result.is_high_risk:
                logger.info(
                    "Classifier flagged high distress: score=%.2f emotion=%s session=%s",
                    classifier_result.distress_score,
                    classifier_result.dominant_emotion,
                    session_id,
                )
        except Exception as _clf_exc:
            logger.debug("Safety classifier error (non-blocking): %s", _clf_exc)

        # GATHER HISTORY
        history_stmt = select(SessionMessageModel).where(
            SessionMessageModel.session_record_id == db_session.id
        ).order_by(SessionMessageModel.timestamp.asc())
        history_res = await self.db.execute(history_stmt)
        history_msgs = history_res.scalars().all()

        history_items: list[tuple[str, str]] = []
        for m in history_msgs:
            key = kms_service.get_master_key(m.key_id)
            nonce = m.encrypted_content[:12]
            ciphertext = m.encrypted_content[12:]
            decrypted = EnvelopeEncryption.decrypt(key, nonce, ciphertext).decode('utf-8')
            if decrypted != content:
                history_items.append((m.role, decrypted))

        history_tuples = tuple(history_items)

        locale_value = user.preferences.locale.value
        session_mode = db_session.mode if db_session.mode else "open"
        try:
            evidence_matches = await retrieve_approved_evidence(
                self.db,
                query=content,
                locale=locale_value,
                jurisdiction="EG",
            )
        except Exception as exc:
            logger.warning("Approved evidence retrieval unavailable (%s)", type(exc).__name__)
            evidence_matches = []
        system_prompt = _build_therapeutic_system_prompt(
            locale=locale_value,
            session_mode=session_mode,
        )
        evidence_context = build_evidence_context(evidence_matches)
        if evidence_context:
            system_prompt = f"{system_prompt}\n\n{evidence_context}"
        else:
            system_prompt += (
                "\n\nEVIDENCE LIMIT: No approved source was retrieved for this turn. "
                "Do not claim mental-health facts are evidence-based, invent sources, "
                "or give clinical instructions. Stay supportive and non-diagnostic."
            )
        request = GenerationRequest(
            session_id=session_id,
            user_id=user.user_id,
            system_prompt=system_prompt,
            conversation_history=history_tuples,
            user_message=content,
            locale=locale_value,
            max_tokens=settings.llm_max_tokens,
            timeout_sec=settings.llm_timeout_sec,
        )
        response = await self.model.generate(request)

        # POST-GENERATION CHECK
        post_check = run_post_generation_check(
            model_output=response.text,
            session_language=user.preferences.locale.value
        )

        await self._audit_safety_decision(session_id, user.user_id, post_check)

        if post_check.block_generation:
            reply = post_check.response_override or (
                "The generated response was blocked for safety reasons."
            )
        else:
            from glow_api.prompts import clean_model_reply

            reply = clean_model_reply(response.text) + format_evidence_citations(evidence_matches)

        # Save assistant message
        await self._save_message(session_id, db_session.id, consent, "assistant", reply)
        await self.db.commit()

        return reply
