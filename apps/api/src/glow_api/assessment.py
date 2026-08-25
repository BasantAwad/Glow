"""
Phase 9 — Non-diagnostic screening assessment (ADR 0001, CLAUDE.md §3).

REQUIREMENTS (non-negotiable):
  1. No `diagnosis` or `initial_diagnosis` field anywhere in this module.
  2. Use ONLY: screening_observation, screening_result, risk_indicator,
     clinician_review_flag.
  3. AI output MUST NOT state that a user has a disorder.
  4. Output wording: "Your responses suggest it may be useful to discuss
     these with a qualified professional."
  5. Concerning responses trigger the CrisisFSM.
  6. Clinical instruments must be validated_by a licensed clinician before use.
  7. Assessments are user-deletable and included in exports.
  8. Phase 9 production requires clinical instrument validation review
     (currently BLOCKED).

BLOCKED:
  - Clinical instrument validation requires licensed clinician review.
  - Assessment instruments cannot be used with real users until reviewed.

IMPLEMENTATION STATUS (2026-08-25):
  - Domain types: IMPLEMENTED
  - Service layer: IMPLEMENTED (pending DB migration and clinical review)
  - ORM models: PENDING migration
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum
from typing import TYPE_CHECKING

from pydantic import BaseModel

if TYPE_CHECKING:
    from glow_api.consent import ConsentRecord
    from glow_api.user import UserAccount

logger = logging.getLogger(__name__)

# Wording required for all screening result output. Must not be changed to
# imply diagnosis or clinical authority.
SCREENING_RESULT_DISCLAIMER = (
    "This screening is not a clinical assessment or diagnosis. "
    "Your responses suggest it may be useful to discuss these with "
    "a qualified professional."
)


# ---------------------------------------------------------------------------
# Screening instrument definition
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ScreeningItem:
    """A single question in a screening instrument."""
    item_id: str
    prompt: str
    response_type: str  # "likert_5" | "yes_no" | "numeric"
    crisis_threshold: float | None = None  # If score exceeds this, flag for crisis check


@dataclass(frozen=True)
class ScreeningInstrument:
    """A validated screening instrument.

    MUST have a non-None validated_by field before use with real users.
    All instruments are BLOCKED until clinician review is complete.
    """
    instrument_id: str
    name: str
    version: str
    language: str
    items: tuple[ScreeningItem, ...]
    max_score: float
    crisis_score_threshold: float
    validated_by: str | None    # Clinician name/credentials — REQUIRED for production
    approved_at: datetime | None  # Must be set before use in pilot

    @property
    def is_approved(self) -> bool:
        """Return True iff this instrument has been clinician-approved for use."""
        return self.validated_by is not None and self.approved_at is not None


# ---------------------------------------------------------------------------
# Assessment response and result types
# ---------------------------------------------------------------------------


class RiskLevel(str, Enum):
    """Non-diagnostic risk indicator levels."""
    NONE = "none"
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"


class AssessmentResponse(BaseModel):
    """A user's response to a single screening item."""
    item_id: str
    response_value: float  # Numeric encoding of the user's answer


class AssessmentResult(BaseModel):
    """The result of a completed screening assessment.

    CRITICAL: Fields are named for what they are — screening observations,
    not diagnoses. Do not add a `diagnosis` or `disorder` field here.
    """
    assessment_id: str
    user_id: str
    instrument_id: str
    instrument_name: str
    instrument_version: str
    score: float
    max_score: float
    score_percent: float

    # Non-diagnostic output fields (the only fields permitted for AI output)
    screening_observation: str    # e.g. "Responses suggest elevated stress indicators"
    screening_result: str         # e.g. "elevated" | "moderate" | "low" | "minimal"
    risk_indicator: RiskLevel     # Structured risk level (non-diagnostic)
    clinician_review_flag: bool   # Whether professional consultation is recommended

    # Mandatory disclaimer on every result
    non_diagnostic_disclaimer: str = SCREENING_RESULT_DISCLAIMER

    # Never add: diagnosis, initial_diagnosis, disorder, dsm_category, icd_code

    created_at: datetime
    completed_at: datetime | None = None


# ---------------------------------------------------------------------------
# Assessment service
# ---------------------------------------------------------------------------


class AssessmentService:
    """Non-diagnostic screening assessment service.

    Guards:
    - Instruments must be approved (validated_by + approved_at) before use
    - Results use only screening_observation, not diagnosis language
    - Concerning scores trigger CrisisFSM routing (handled by orchestrator)
    - All assessment data is user-deletable and exportable
    """

    def __init__(self) -> None:
        self._instruments: dict[str, ScreeningInstrument] = {}
        logger.info(
            "AssessmentService initialized. "
            "BLOCKED: all instruments require clinician review before use with real users."
        )

    def register_instrument(self, instrument: ScreeningInstrument) -> None:
        """Register a screening instrument.

        In production, only approved instruments (validated_by + approved_at set)
        may be registered. Unapproved instruments are registered as BLOCKED.

        Args:
            instrument: The screening instrument to register.
        """
        if not instrument.is_approved:
            logger.warning(
                "AssessmentService.register_instrument: instrument %r (%s) "
                "has no clinician validation — it will be BLOCKED for real users. "
                "(ADR 0001 §clinical-review-gate)",
                instrument.instrument_id,
                instrument.name,
            )
        self._instruments[instrument.instrument_id] = instrument

    def get_instrument(self, instrument_id: str) -> ScreeningInstrument:
        """Return an instrument by ID.

        Raises:
            KeyError: If the instrument is not registered.
            PermissionError: If the instrument is not yet approved.
        """
        instrument = self._instruments.get(instrument_id)
        if instrument is None:
            raise KeyError(f"Screening instrument {instrument_id!r} is not registered.")
        if not instrument.is_approved:
            raise PermissionError(
                f"Screening instrument {instrument_id!r} ({instrument.name}) "
                f"has not been approved by a licensed clinician and cannot be used "
                f"with real users. (BLOCKED — ADR 0001 §clinical-review-gate)"
            )
        return instrument

    async def score_assessment(
        self,
        user: "UserAccount",
        consent: "ConsentRecord",
        instrument_id: str,
        responses: list[AssessmentResponse],
    ) -> AssessmentResult:
        """Score a completed assessment and return non-diagnostic screening results.

        Args:
            user: The authenticated user.
            consent: The user's consent record.
            instrument_id: The ID of the instrument to score.
            responses: The user's responses.

        Returns:
            An AssessmentResult with only non-diagnostic fields.

        Raises:
            PermissionError: If the instrument is not approved.
            KeyError: If the instrument is not registered.
        """
        import uuid

        instrument = self.get_instrument(instrument_id)

        # Calculate total score
        score = sum(r.response_value for r in responses)
        score_percent = min(score / instrument.max_score, 1.0) if instrument.max_score > 0 else 0.0

        # Determine risk level — using score percent, not a diagnosis
        if score_percent < 0.2:
            risk = RiskLevel.NONE
            obs = "Responses indicate minimal indicators of concern at this time."
            result_label = "minimal"
            review_flag = False
        elif score_percent < 0.4:
            risk = RiskLevel.LOW
            obs = "Responses indicate some indicators that may be worth monitoring."
            result_label = "low"
            review_flag = False
        elif score_percent < 0.6:
            risk = RiskLevel.MODERATE
            obs = "Responses suggest some elevated indicators of concern."
            result_label = "moderate"
            review_flag = True
        elif score_percent < 0.8:
            risk = RiskLevel.HIGH
            obs = "Responses suggest elevated indicators. Professional consultation may be beneficial."
            result_label = "elevated"
            review_flag = True
        else:
            risk = RiskLevel.HIGH
            obs = "Responses indicate high-level indicators. Speaking with a professional is strongly recommended."
            result_label = "high"
            review_flag = True

        now = datetime.now(UTC)
        assessment_id = str(uuid.uuid4())

        result = AssessmentResult(
            assessment_id=assessment_id,
            user_id=user.user_id,
            instrument_id=instrument.instrument_id,
            instrument_name=instrument.name,
            instrument_version=instrument.version,
            score=score,
            max_score=instrument.max_score,
            score_percent=score_percent,
            screening_observation=obs,
            screening_result=result_label,
            risk_indicator=risk,
            clinician_review_flag=review_flag,
            created_at=now,
            completed_at=now,
        )

        # Log for audit without exposing score details
        logger.info(
            "AssessmentService.score_assessment: user_id=%s instrument=%s "
            "risk=%s review_flag=%s",
            user.user_id,
            instrument_id,
            risk.value,
            review_flag,
        )

        # Crisis check: if score exceeds crisis threshold, notify orchestrator
        if score >= instrument.crisis_score_threshold:
            logger.warning(
                "AssessmentService: crisis threshold exceeded for user_id=%s "
                "instrument=%s — CrisisFSM routing required.",
                user.user_id,
                instrument_id,
            )
            # CrisisFSM routing is handled by the orchestrator/session layer,
            # not this service. The caller must check result.risk_indicator == HIGH
            # and route accordingly.

        return result

    def list_instruments(self) -> list[dict]:
        """List all registered instruments with their approval status."""
        return [
            {
                "instrument_id": inst.instrument_id,
                "name": inst.name,
                "version": inst.version,
                "language": inst.language,
                "is_approved": inst.is_approved,
                "validated_by": inst.validated_by,
            }
            for inst in self._instruments.values()
        ]
