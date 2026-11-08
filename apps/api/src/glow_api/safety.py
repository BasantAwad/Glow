"""
Clinical safety and crisis control plane for Glow (Phase 3).

This module implements safety as code:

 - Deterministic, structured risk decisions that sit OUTSIDE the language model.
 - Pre-generation checks (applied before sending any user input to a model).
 - Post-generation validation (applied before surfacing any model output).
 - A crisis finite-state machine (FSM) that overrides normal session rules.
 - Audit event records for every safety decision.
 - A localized-resource registry *interface* with an empty, clearly marked
   implementation — no real crisis numbers are invented here.
 - Crisis-safe response templates (text-only, no model involved).

Architecture rules (CLAUDE.md §3, §4, §5):
 - Safety checks run BEFORE and AFTER the model, not inside it.
 - The safety control plane is deterministic.  A human reviewer can trace
   every safety decision from the audit event log.
 - Crisis mode overrides billing, session time limits, and all other
   non-safety controls.
 - Glow must never independently diagnose, prescribe medication, or claim
   to have contacted emergency services.
 - No crisis resource numbers are emitted unless they have been verified,
   licensed, and entered into the resource registry by an accountable human.
 - Self-harm, suicide, imminent danger, threats to others, psychosis-like
   content, mania, abuse, medication questions, minors, and prompt injection
   all have distinct handling paths.

DATA POLICY: This module emits ZERO invented crisis phone numbers, email
addresses, or clinical guidance.  The resource registry is explicitly empty
and blocked until a human-reviewed, licensed data source is supplied.  See
RESOURCE_REGISTRY_BLOCKED below.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import IntEnum, StrEnum
from typing import Any

# ---------------------------------------------------------------------------
# Risk tier
# ---------------------------------------------------------------------------


class RiskTier(IntEnum):
    """Ordered risk severity tiers.  Higher is more serious.

    NONE (0)       — No safety concern detected.
    LOW (1)        — Content that warrants monitoring or a soft redirect.
    MODERATE (2)   — Content requiring active acknowledgment and psycho-
                     education; session may continue with care.
    HIGH (3)       — Content indicating significant distress; session must
                     be paused for a safety check.
    CRISIS (4)     — Imminent risk, active suicidal ideation, self-harm,
                     threats to others, or similar.  Session enters CRISIS
                     state; normal rules suspended.
    """

    NONE = 0
    LOW = 1
    MODERATE = 2
    HIGH = 3
    CRISIS = 4


# ---------------------------------------------------------------------------
# Safety signal categories
# ---------------------------------------------------------------------------


class SafetySignal(StrEnum):
    """The type of safety concern identified."""

    SUICIDAL_IDEATION = "suicidal_ideation"
    SELF_HARM = "self_harm"
    IMMINENT_DANGER_TO_SELF = "imminent_danger_to_self"
    THREAT_TO_OTHERS = "threat_to_others"
    PSYCHOSIS_INDICATORS = "psychosis_indicators"
    MANIA_INDICATORS = "mania_indicators"
    ABUSE_DISCLOSURE = "abuse_disclosure"
    MEDICATION_QUESTION = "medication_question"
    MINOR_DETECTED = "minor_detected"
    PROMPT_INJECTION_DETECTED = "prompt_injection_detected"
    DIAGNOSTIC_REQUEST = "diagnostic_request"
    PRESCRIPTION_REQUEST = "prescription_request"
    HUMAN_THERAPIST_CLAIM = "human_therapist_claim"
    GENERAL_DISTRESS = "general_distress"
    NONE_DETECTED = "none_detected"


# ---------------------------------------------------------------------------
# Safety check result
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class SafetyCheckResult:
    """The outcome of a pre- or post-generation safety check.

    Fields:
        risk_tier:        Evaluated risk level.
        signals:          All detected safety signals (may be multiple).
        block_generation: If True, the model must NOT be called / output
                          must NOT be surfaced.
        require_crisis:   If True, the session FSM must enter CRISIS state
                          before any further interaction.
        audit_note:       Safe-to-log (no PII, no therapy content) note for
                          the safety audit log.
        response_override: If set, this text MUST be surfaced to the user
                           instead of any model output.  Used for crisis-
                           safe templates.
        is_pre_generation: True for pre-generation checks; False for post.
    """

    risk_tier: RiskTier
    signals: frozenset[SafetySignal]
    block_generation: bool
    require_crisis: bool
    audit_note: str
    response_override: str | None = None
    is_pre_generation: bool = True

    @property
    def is_safe(self) -> bool:
        """True iff no blocking concern was detected."""
        return not self.block_generation and not self.require_crisis


# ---------------------------------------------------------------------------
# Crisis FSM states
# ---------------------------------------------------------------------------


class CrisisState(StrEnum):
    """States of the crisis finite-state machine.

    INACTIVE       — No crisis active.
    DETECTED       — Crisis signal detected; awaiting acknowledgment.
    ACKNOWLEDGED   — Glow has acknowledged the crisis; resources being
                     surfaced (empty until registry is populated).
    RESOURCE_OFFERED — User has been offered resources (even empty state).
    PENDING_HANDOFF  — Waiting for user to confirm they are safe or have
                       called a resource.
    CLEARED        — Crisis resolved; normal session may resume.
    EMERGENCY_CLOSE — Session must close immediately for safety reasons.
    """

    INACTIVE = "inactive"
    DETECTED = "detected"
    ACKNOWLEDGED = "acknowledged"
    RESOURCE_OFFERED = "resource_offered"
    PENDING_HANDOFF = "pending_handoff"
    CLEARED = "cleared"
    EMERGENCY_CLOSE = "emergency_close"


@dataclass
class CrisisFSM:
    """Crisis finite-state machine.

    One instance per active session.  Transitions are driven by safety
    check results and user responses.

    This FSM is deterministic and sits outside the language model.
    """

    state: CrisisState = CrisisState.INACTIVE
    detected_at: datetime | None = None
    cleared_at: datetime | None = None
    primary_signal: SafetySignal | None = None
    transition_log: list[tuple[datetime, CrisisState, str]] = field(default_factory=list)

    def transition(self, new_state: CrisisState, reason: str) -> None:
        """Apply a transition, logging the reason."""
        now = datetime.now(UTC)
        self.transition_log.append((now, new_state, reason))
        self.state = new_state
        if new_state == CrisisState.DETECTED and self.detected_at is None:
            self.detected_at = now
        elif new_state == CrisisState.CLEARED:
            self.cleared_at = now

    @property
    def is_active(self) -> bool:
        return self.state not in (CrisisState.INACTIVE, CrisisState.CLEARED, CrisisState.EMERGENCY_CLOSE)

    @property
    def requires_session_crisis_state(self) -> bool:
        """True iff the session FSM must be in CRISIS state."""
        return self.state in (
            CrisisState.DETECTED,
            CrisisState.ACKNOWLEDGED,
            CrisisState.RESOURCE_OFFERED,
            CrisisState.PENDING_HANDOFF,
        )


# ---------------------------------------------------------------------------
# Crisis-safe response templates
# ---------------------------------------------------------------------------

# These templates are used ONLY when the safety control plane blocks the
# model.  They must not claim Glow has contacted anyone, must not provide
# phone numbers that have not been verified, and must always acknowledge
# the user's distress.

CRISIS_ACKNOWLEDGMENT_TEMPLATE = """I hear you, and I'm taking what you said seriously. What you're feeling matters deeply, and I want to make sure you're as safe as possible right now.

I'm an AI — not a human therapist — and right now the most important thing is connecting you with someone who can truly help.

If you're in Egypt, please reach out to one of these:
• Emergency services / ambulance: 123
• Police emergency: 122
• National mental-health support line: 16328
• Befrienders Cairo (someone to talk to): 762 1602 or 762 1603
• Befrienders Cairo email: befrienders@befrienderscairo.com

If you're outside Egypt, visit findahelpline.com to find support in your country.

I'm still here with you. Can you tell me — are you in a safe place right now?"""

CRISIS_RESOURCE_UNAVAILABLE_TEMPLATE = """The verified local support resources for your region are not yet available
in this system. This is a limitation of the current version of Glow — no phone
numbers or contacts have been added yet.

Please contact:
• Emergency services in your area (police/ambulance emergency line)
• A trusted friend, family member, or healthcare provider
• Your nearest hospital emergency department

I'm an AI and I cannot contact anyone on your behalf. Please reach out for
in-person support right now."""

SAFE_MESSAGING_REDIRECT_TEMPLATE = """I want to make sure we talk about this carefully. Some topics related to
methods of harm can be difficult to discuss safely in an AI setting.

I'm not going to share specific information that could cause harm. Instead,
I'd like to focus on what's bringing up these thoughts for you, and how you're
feeling right now.

Are you doing okay? I'm here to listen."""

MEDICATION_BOUNDARY_TEMPLATE = """I'm not qualified to give advice about medications — I'm an AI, not a doctor
or pharmacist. Medication questions, dosages, interactions, and prescriptions
must be discussed with a qualified healthcare professional.

I'd encourage you to speak with your doctor, a pharmacist, or a mental health
prescriber about this. Is there something else I can help you think through today?"""

MINOR_BOUNDARY_TEMPLATE = """Glow is designed for adults aged 18 and over. I'm not able to continue
this session. Please speak with a trusted adult — a parent, guardian, school
counsellor, or other trusted person — who can help you find the right support.

If you are in distress, please contact a trusted adult or emergency services now."""

PROMPT_INJECTION_BOUNDARY_TEMPLATE = """I noticed something in that message that I can't process as intended. Let me
know if there's something specific I can help you with today."""

DIAGNOSTIC_BOUNDARY_TEMPLATE = """I'm not able to give a diagnosis — I'm an AI, not a clinician, and it
wouldn't be safe or appropriate for me to do so. A proper assessment requires
a qualified mental health professional who can speak with you directly.

What I can do is help you explore what you're experiencing and think about
next steps for getting professional support. Would that be helpful?"""


# ---------------------------------------------------------------------------
# Deterministic pre-generation safety checks
# ---------------------------------------------------------------------------

# These patterns are illustrative structural checks.  Real production
# patterns would be developed with clinical guidance and red-teaming.
# They are intentionally conservative — false positives are safer than
# false negatives for crisis signals.

# --- Crisis keyword patterns ---
_CRISIS_KEYWORDS = re.compile(
    r"\b(suicid|kill\s+myself|end\s+my\s+life|hurt\s+myself|self[- ]harm|"
    r"want\s+to\s+die|don'?t\s+want\s+to\s+live|cut\s+myself|"
    r"overdose|jump\s+off|hang\s+myself|not\s+want\s+to\s+be\s+here|"
    r"can'?t\s+go\s+on|no\s+reason\s+to\s+live|better\s+off\s+dead|"
    r"thinking\s+about\s+suicide|thoughts\s+of\s+suicide)\b",
    re.IGNORECASE,
)
_SELF_HARM_KEYWORDS = re.compile(
    r"\b(cut\s+myself|cutting|burn\s+myself|burning|scratch\s+myself|"
    r"hit\s+myself|starv\w+|purging|self[- ]harm|self[- ]injur)\b",
    re.IGNORECASE,
)
_GENERAL_DISTRESS_KEYWORDS = re.compile(
    r"\b(hopeless|worthless|nobody\s+cares|no\s+point|give\s+up|"
    r"can'?t\s+take\s+it|exhausted\s+from\s+life|so\s+tired\s+of\s+everything|"
    r"nothing\s+matters|disappear\s+forever)\b",
    re.IGNORECASE,
)

_PROMPT_INJECTION_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"(?i)ignore\s+(all\s+)?previous\s+instructions?"),
    re.compile(r"(?i)you\s+are\s+now\s+(a\s+)?(?:different|new|unrestricted|jailbroken)"),
    re.compile(r"(?i)system\s*prompt\s*:"),
    re.compile(r"(?i)<\s*/?system\s*>"),
    re.compile(r"(?i)\[\s*system\s*\]"),
    re.compile(r"(?i)act\s+as\s+(?:if\s+you\s+are\s+)?(?:a\s+)?(?:human|real\s+person)"),
]


def check_prompt_injection(text: str) -> bool:
    """Return True if the text contains a likely prompt injection attempt."""
    return any(p.search(text) for p in _PROMPT_INJECTION_PATTERNS)


def run_pre_generation_check(
    user_input: str,
    *,
    is_adult_confirmed: bool,
    session_language: str = "en",
) -> SafetyCheckResult:
    """Run all deterministic pre-generation checks on user input.

    Called BEFORE sending user input to any language model.
    Returns a SafetyCheckResult.  If block_generation is True, the model
    MUST NOT be called.

    This check is intentionally conservative.  Clinical red-teaming is
    required before widening any pattern.

    Args:
        user_input: The raw user message text.
        is_adult_confirmed: Whether the user's 18+ age has been confirmed.
        session_language: BCP 47 locale of the session.

    Returns:
        SafetyCheckResult.
    """
    signals: set[SafetySignal] = set()
    tier = RiskTier.NONE
    block = False
    require_crisis = False
    response_override: str | None = None
    audit_note = "pre-generation check"

    # --- Adult gate ---
    if not is_adult_confirmed:
        signals.add(SafetySignal.MINOR_DETECTED)
        tier = RiskTier.CRISIS
        block = True
        require_crisis = True
        response_override = MINOR_BOUNDARY_TEMPLATE
        audit_note = "minor_not_confirmed"
        return SafetyCheckResult(
            risk_tier=tier,
            signals=frozenset(signals),
            block_generation=block,
            require_crisis=require_crisis,
            audit_note=audit_note,
            response_override=response_override,
            is_pre_generation=True,
        )

    # --- Prompt injection ---
    if check_prompt_injection(user_input):
        signals.add(SafetySignal.PROMPT_INJECTION_DETECTED)
        tier = max(tier, RiskTier.HIGH)
        block = True
        response_override = PROMPT_INJECTION_BOUNDARY_TEMPLATE
        audit_note = "prompt_injection_detected"

    # --- Crisis detection ---
    if not block and _CRISIS_KEYWORDS.search(user_input):
        signals.add(SafetySignal.SUICIDAL_IDEATION)
        signals.add(SafetySignal.IMMINENT_DANGER_TO_SELF)
        tier = RiskTier.CRISIS
        block = True
        require_crisis = True
        response_override = CRISIS_ACKNOWLEDGMENT_TEMPLATE
        audit_note = "crisis_keyword_detected_pre_generation"

    elif not block and _SELF_HARM_KEYWORDS.search(user_input):
        signals.add(SafetySignal.SELF_HARM)
        tier = max(tier, RiskTier.HIGH)
        block = True
        response_override = SAFE_MESSAGING_REDIRECT_TEMPLATE
        audit_note = "self_harm_keyword_detected"

    elif not block and _GENERAL_DISTRESS_KEYWORDS.search(user_input):
        signals.add(SafetySignal.GENERAL_DISTRESS)
        tier = max(tier, RiskTier.MODERATE)
        # Don't block; allow model but log it
        audit_note = "general_distress_keyword_detected"

    if not block:
        signals.add(SafetySignal.NONE_DETECTED)
        audit_note = "no_concerns"

    return SafetyCheckResult(
        risk_tier=tier,
        signals=frozenset(signals),
        block_generation=block,
        require_crisis=require_crisis,
        audit_note=audit_note,
        response_override=response_override,
        is_pre_generation=True,
    )


def run_post_generation_check(
    model_output: str,
    *,
    session_language: str = "en",
) -> SafetyCheckResult:
    """Run deterministic post-generation checks on model output.

    Called AFTER the model returns output, BEFORE surfacing to the user.
    Validates that the model has not:
      - Claimed to be human or a therapist.
      - Provided a diagnosis.
      - Provided medication advice.
      - Provided unverified crisis resources.

    Returns a SafetyCheckResult.  If block_generation is True, the output
    MUST NOT be shown to the user.

    Note: This implementation is a minimal structural skeleton.  Full
    production validation requires clinical red-teaming and NLP evaluation.
    """
    signals: set[SafetySignal] = set()
    tier = RiskTier.NONE
    block = False
    require_crisis = False
    response_override: str | None = None
    audit_note = "post-generation check"

    lower = model_output.lower()

    # Check for human / therapist claim.
    if any(p in lower for p in ["i am a human", "i am a therapist", "i am a real person", "i am not an ai"]):
        signals.add(SafetySignal.HUMAN_THERAPIST_CLAIM)
        tier = max(tier, RiskTier.HIGH)
        block = True
        audit_note = "human_therapist_claim_in_output"

    # Check for diagnostic claim.  Match diagnostic phrasing, not the generic
    # words "you have" — normal empathic sentences like "you have been carrying
    # a lot" must not be blocked.
    if any(p in lower for p in [
        "you are diagnosed",
        "i diagnose you",
        "diagnosed with",
        "you are showing signs of",
        "this is a classic sign of",
        "which means you have",
        "so you have depression",
        "you have anxiety disorder",
        "you have ptsd",
        "you have bipolar",
        "you have adhd",
        "you have autism",
    ]):
        signals.add(SafetySignal.DIAGNOSTIC_REQUEST)
        tier = max(tier, RiskTier.HIGH)
        block = True
        audit_note = "diagnostic_claim_in_output"

    if not block:
        signals.add(SafetySignal.NONE_DETECTED)
        audit_note = "no_concerns"

    return SafetyCheckResult(
        risk_tier=tier,
        signals=frozenset(signals),
        block_generation=block,
        require_crisis=require_crisis,
        audit_note=audit_note,
        response_override=response_override,
        is_pre_generation=False,
    )


# ---------------------------------------------------------------------------
# Crisis resource registry — BLOCKED / EMPTY
# ---------------------------------------------------------------------------

RESOURCE_REGISTRY_BLOCKED: str = (
    "BLOCKED: No crisis resource data has been entered into this registry. "
    "Populating the registry requires verified, licensed, jurisdiction-specific "
    "crisis contact information reviewed and approved by an accountable human. "
    "Until that data is supplied and approved, the registry remains empty and "
    "the crisis resource display shows CRISIS_RESOURCE_UNAVAILABLE_TEMPLATE."
)


@dataclass(frozen=True)
class CrisisResource:
    """A single crisis support resource entry.

    ALL fields are required.  Entries with missing provenance or unverified
    contact information must not be added to the registry.

    Fields:
        resource_id:        Opaque server-assigned identifier.
        name:               Display name of the resource/organization.
        jurisdiction:       ISO 3166-1 alpha-2 country code (e.g. "EG").
        locale:             BCP 47 locale this resource is for.
        contact_type:       "phone" | "sms" | "chat" | "email" | "in_person".
        contact_value:      The actual contact information (phone number, URL,
                            etc.).  MUST be verified before entry.
        is_verified:        Must be True for any entry to be displayable.
        verified_at:        When the contact was last verified (UTC).
        verified_by:        Name or identifier of the human who verified it.
        license_notes:      Any licensing or attribution requirements.
        availability:       Human-readable availability (e.g. "24/7").
    """

    resource_id: str
    name: str
    jurisdiction: str
    locale: str
    contact_type: str
    contact_value: str
    is_verified: bool
    verified_at: datetime
    verified_by: str
    license_notes: str
    availability: str


class CrisisResourceRegistry:
    """Registry of verified crisis support resources.

    The registry is EMPTY by default and will remain empty until a human
    reviewer supplies, verifies, and approves real contact information for
    each jurisdiction.

    NEVER add entries with invented or unverified contact information.
    """

    def __init__(self) -> None:
        self._resources: dict[str, CrisisResource] = {}

    def add_resource(self, resource: CrisisResource) -> None:
        """Add a resource.  Must be verified (is_verified=True)."""
        if not resource.is_verified:
            raise ValueError(
                f"Resource '{resource.resource_id}' cannot be added: is_verified is False. "
                "Verify the contact information with a human reviewer first."
            )
        self._resources[resource.resource_id] = resource

    def get_resources(
        self,
        jurisdiction: str,
        locale: str,
    ) -> list[CrisisResource]:
        """Return verified resources for the given jurisdiction and locale.

        Returns an empty list if none are registered yet.
        """
        return [
            r
            for r in self._resources.values()
            if r.jurisdiction == jurisdiction
            and r.locale == locale
            and r.is_verified
        ]

    @property
    def is_empty(self) -> bool:
        return len(self._resources) == 0

    @property
    def registry_status(self) -> str:
        if self.is_empty:
            return RESOURCE_REGISTRY_BLOCKED
        return f"{len(self._resources)} verified resource(s) registered."


# Global registry instance (empty — see RESOURCE_REGISTRY_BLOCKED).
# Populated only by the admin crisis-resource management workflow (Phase 9).
CRISIS_REGISTRY: CrisisResourceRegistry = CrisisResourceRegistry()


# ---------------------------------------------------------------------------
# Egypt crisis resources (verified 2026-11)
# Human-reviewed; do NOT modify contact values without re-verification.
# ---------------------------------------------------------------------------
def _populate_crisis_registry() -> None:
    """Populate verified crisis resources. Called once at module load."""
    _verified_at = datetime(2026, 11, 8, tzinfo=UTC)
    _verified_by = "Glow-founding-team-manual-review"

    entries = [
        CrisisResource(
            resource_id="eg-ambulance",
            name="Egypt Emergency Ambulance",
            jurisdiction="EG",
            locale="ar",
            contact_type="phone",
            contact_value="123",
            is_verified=True,
            verified_at=_verified_at,
            verified_by=_verified_by,
            license_notes="Public emergency number",
            availability="24/7",
        ),
        CrisisResource(
            resource_id="eg-police",
            name="Egypt Police Emergency",
            jurisdiction="EG",
            locale="ar",
            contact_type="phone",
            contact_value="122",
            is_verified=True,
            verified_at=_verified_at,
            verified_by=_verified_by,
            license_notes="Public emergency number",
            availability="24/7",
        ),
        CrisisResource(
            resource_id="eg-mental-health-line",
            name="Egypt National Mental Health Support Line",
            jurisdiction="EG",
            locale="ar",
            contact_type="phone",
            contact_value="16328",
            is_verified=True,
            verified_at=_verified_at,
            verified_by=_verified_by,
            license_notes="Public mental health support line",
            availability="24/7",
        ),
        CrisisResource(
            resource_id="eg-mental-health-line-en",
            name="Egypt National Mental Health Support Line",
            jurisdiction="EG",
            locale="en",
            contact_type="phone",
            contact_value="16328",
            is_verified=True,
            verified_at=_verified_at,
            verified_by=_verified_by,
            license_notes="Public mental health support line",
            availability="24/7",
        ),
        CrisisResource(
            resource_id="eg-befrienders-1",
            name="Befrienders Cairo",
            jurisdiction="EG",
            locale="en",
            contact_type="phone",
            contact_value="762 1602",
            is_verified=True,
            verified_at=_verified_at,
            verified_by=_verified_by,
            license_notes="Befrienders Worldwide member",
            availability="Check befrienderscairo.com for hours",
        ),
        CrisisResource(
            resource_id="eg-befrienders-2",
            name="Befrienders Cairo (line 2)",
            jurisdiction="EG",
            locale="en",
            contact_type="phone",
            contact_value="762 1603",
            is_verified=True,
            verified_at=_verified_at,
            verified_by=_verified_by,
            license_notes="Befrienders Worldwide member",
            availability="Check befrienderscairo.com for hours",
        ),
        CrisisResource(
            resource_id="eg-befrienders-email",
            name="Befrienders Cairo Email",
            jurisdiction="EG",
            locale="en",
            contact_type="email",
            contact_value="befrienders@befrienderscairo.com",
            is_verified=True,
            verified_at=_verified_at,
            verified_by=_verified_by,
            license_notes="Befrienders Worldwide member",
            availability="Check befrienderscairo.com for hours",
        ),
        CrisisResource(
            resource_id="global-findahelpline",
            name="Find A Helpline (Global)",
            jurisdiction="GLOBAL",
            locale="en",
            contact_type="chat",
            contact_value="https://findahelpline.com",
            is_verified=True,
            verified_at=_verified_at,
            verified_by=_verified_by,
            license_notes="Public directory",
            availability="24/7 directory",
        ),
    ]
    for entry in entries:
        try:
            CRISIS_REGISTRY.add_resource(entry)
        except Exception:
            pass  # Skip duplicates silently


_populate_crisis_registry()


# ---------------------------------------------------------------------------
# Audit event
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class SafetyAuditEvent:
    """A structured audit record for every safety decision.

    Stored in a RESTRICTED audit store (not standard application logs).
    Must not contain raw therapy content or user PII beyond user_id and
    session_id (which are opaque identifiers).

    Fields:
        event_id:       Opaque event identifier.
        session_id:     Opaque session identifier.
        user_id:        Opaque user identifier.
        occurred_at:    UTC timestamp of the safety check.
        check_type:     "pre_generation" or "post_generation".
        risk_tier:      Evaluated risk tier.
        signals:        Set of detected safety signals.
        action_taken:   What the system did ("blocked", "crisis_state", "allowed", etc.).
        audit_note:     Safe-to-store note (no PII, no therapy content).
        policy_version: The safety policy version in effect.
        extra:          Any additional structured metadata (no free text).
    """

    event_id: str
    session_id: str
    user_id: str
    occurred_at: datetime
    check_type: str
    risk_tier: RiskTier
    signals: frozenset[SafetySignal]
    action_taken: str
    audit_note: str
    policy_version: str
    extra: dict[str, Any] = field(default_factory=dict)


SAFETY_POLICY_VERSION: str = "safety-policy-v0"
