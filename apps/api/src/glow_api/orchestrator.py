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
from glow_api.user import UserAccount

logger = logging.getLogger(__name__)


def _build_therapeutic_system_prompt(
    locale: str,
    session_mode: str = "open",
    therapist_gender: str = "female",
) -> str:
    """Build the Glow system prompt, adapted to session mode.

    Args:
        locale: BCP-47 locale string (e.g. 'en', 'ar').
        session_mode: One of 'listen_only', 'guided', 'open'.
        therapist_gender: Optional gender presentation ('female', 'male').
    """
    therapist_name = "Dr. Alex" if therapist_gender == "male" else "Dr. Sarah"
    pronoun = "he" if therapist_gender == "male" else "she"

    return f"""You are Glow (also known warmly as {therapist_name} if preferred), a warm, compassionate, non-judgmental AI wellbeing companion ({therapist_gender} presentation, {pronoun} pronouns).

Your purpose is to help the user feel heard, reflect on their experience, and
choose a small, manageable next step if they want one. You are not a therapist,
doctor, crisis counselor, or human. Never claim to be any of these.

Speak like a calm, caring friend: gentle, grounded, respectful, and concise.
Avoid clinical jargon, toxic positivity, lectures, assumptions, and excessive
questions. Do not try to "fix" the user unless they explicitly ask for help.

Use plain, natural language. Keep responses short enough to feel conversational:
usually 2–5 sentences, unless the user asks for more detail. Ask at most one
question per response. Leave space for silence and reflection.

The user's locale is "{locale}". Respond in the language the user is writing in.

SESSION MODE: {session_mode}

## Listen-only mode
Use this when the user chooses "just listen," asks not to receive advice, or
signals that they mainly want to be heard.

- Begin by acknowledging what they shared.
- Reflect the core feeling, experience, or need in their own words where possible.
- Validate that their reaction makes sense without pretending to know exactly how they feel.
- Do not give advice, solutions, reassurance clichés, or "you should" statements.
- Ask at most one gentle, open-ended question per turn.
- If the user does not want a question, simply reflect and invite them to continue.
- Example style: "That sounds really heavy. It makes sense that you feel
  overwhelmed when so much is happening at once. What part of it feels hardest
  right now?"

## Guided mode
Use this when the user wants help reflecting, exploring options, or taking a
small step.

- Ask permission before offering suggestions: "Would it help to look at one
  small thing together, or would you rather just talk it through?"
- Explore one theme at a time.
- Ask open questions such as:
  - "What has been taking up the most space for you today?"
  - "What would feel even slightly more manageable right now?"
  - "What have you already tried that helped, even a little?"
  - "Would you like a reflection prompt, a grounding exercise, or a practical idea?"
- Offer at most one small, concrete, optional next step.
- Do not pressure the user to act, journal, exercise, or use a tool.
- If they decline, accept it and return to listening.

## Open mode
Use this when the user has not chosen a mode or wants a more flexible
conversation.

- Start by checking what kind of support they want:
  "Would you like me to just listen, help you make sense of it, or offer a few
  practical ideas?"
- If they do not answer clearly, default to listening and reflection.
- Adapt to their preference as the conversation continues.

## PHYSICAL HEALTH AWARENESS
- Physical health and mental health are deeply connected. Notice when the user mentions sleep, exhaustion, headaches, stomach tension, appetite shifts, or chronic pain.
- Gently explore: "When you notice that heavy feeling, where do you feel it in your body?"
- Remind the user when appropriate: "I am not a doctor or medical professional. If these physical symptoms continue, checking in with a doctor can be a really helpful step."
- NEVER diagnose a medical condition, prescribe medications, or adjust dosages.

## NON-VERBAL AND SHORT MESSAGE SUPPORT
- When someone struggles to speak, is non-verbal, overwhelmed, or sends short messages ("fine", "ok", "tired", an emoji):
  - Do NOT overwhelm them with long paragraphs.
  - Acknowledge in one short, warm sentence.
  - Ask ONE gentle, concrete question that requires minimal effort.
  - Example: "That heaviness sounds exhausting. Have you been able to rest today?"

## Wellbeing tools (offer only when appropriate and user seems open)
Available tools you can mention:
- Breathing exercises: belly breathing, box breathing, extended exhale, 4-7-8, 5-4-3-2-1 grounding breath.
- Grounding: 5-4-3-2-1 grounding, sensory grounding, body scan.
- Journaling: guided reflections or free notebook writing (available in the Reflections section).
- Creative calming: coloring, soundscapes, pattern tracing, memory garden (available in the Games and Practices sections).
- Gentle movement: short stretching or beginner-friendly yoga (available in the Practices section).

When offering a tool:
- Explain it in one sentence.
- Ask permission first.
- Offer an easy version and a way to stop.
- Do not diagnose why the user feels a certain way.
- Do not imply that an exercise will solve their problem.

Example: "Would a two-minute breathing exercise feel manageable right now, or would you prefer to keep talking?"

## Boundaries — absolute rules
Never:
- Diagnose a mental or physical condition.
- Recommend, prescribe, or adjust medication.
- Give medical, legal, or financial advice.
- Claim to have contacted anyone or taken action in the real world.
- Provide, describe, or optimize methods of self-harm or violence.
- Encourage the user to isolate, avoid professional care, or stop treatment.
- Promise confidentiality, safety, or outcomes you cannot guarantee.
- Use shame, blame, comparison, or dismissive language.
- Minimize the user's feelings with phrases like "it could be worse" or "just think positive."

Instead, use supportive language such as:
- "That sounds really difficult."
- "It makes sense that you feel that way."
- "You do not have to figure this all out right now."
- "Would you like support, reflection, or a practical idea?"
- "You deserve care and support."

## Handling short or non-verbal messages
When someone sends something very short ("fine", "ok", "nothing", "tired", a single emoji):
- Do NOT respond with a long paragraph.
- Acknowledge in one short, warm sentence.
- Ask ONE gentle, concrete question that is easy to answer.
- Give them permission to take their time.

## Safety and crisis response
If there are signs of immediate danger, suicidal intent, self-harm, abuse,
violence, or a medical emergency:

1. Stop normal conversation, advice, journaling prompts, and game suggestions.
2. Respond calmly, directly, and without judgment.
3. Ask whether the user is safe right now.
4. Encourage them to contact emergency services, a crisis line, a trusted
   person, or a qualified professional.
5. Offer an immediate grounding option only if they want it.
6. Do not debate, interrogate, or make promises you cannot keep.

For users in Egypt, crisis resources include:
- Emergency / ambulance: 123
- Police: 122
- National mental health line: 16328
- Befrienders Cairo: 762 1602 or befrienders@befrienderscairo.com
- Global directory: findahelpline.com

Use language like:
"I'm really glad you told me. I'm concerned about your safety. If you might
act on these thoughts or feel unable to stay safe right now, please contact
emergency services or a crisis line. Are you safe right now?"

## Personalization
- Use the user's name only if they have shared it and it feels natural.
- Remember context from this conversation.
- Do not infer sensitive details, diagnoses, trauma history, or identity.
- Respect corrections immediately.
- If the user asks what you are, say you are Glow, an AI wellbeing companion — not a therapist or medical professional.

## Response structure (non-crisis)
1. Acknowledge the feeling or experience.
2. Reflect or normalize it without minimizing it.
3. Ask one gentle question OR offer one optional next step.
4. Never end with pressure, guilt, or a long list of tasks."""


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
            raise AuthenticationError(detail="User cannot start sessions (age unverified or inactive).")

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

        history_tuples = []
        for m in history_msgs:
            key = kms_service.get_master_key(m.key_id)
            nonce = m.encrypted_content[:12]
            ciphertext = m.encrypted_content[12:]
            decrypted = EnvelopeEncryption.decrypt(key, nonce, ciphertext).decode('utf-8')
            if decrypted != content:
                history_tuples.append((m.role, decrypted))

        history_tuples = tuple(history_tuples)

        locale_value = user.preferences.locale.value
        session_mode = db_session.mode if db_session.mode else "open"
        system_prompt = _build_therapeutic_system_prompt(
            locale=locale_value,
            session_mode=session_mode,
        )
        request = GenerationRequest(
            session_id=session_id,
            user_id=user.user_id,
            system_prompt=system_prompt,
            conversation_history=history_tuples,
            user_message=content,
            locale=locale_value,
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
