"""
Tests for glow_api.consent — typed, server-authoritative consent model.

These tests verify all validation rules, cross-field constraints, the purpose
check helper, the initial consent factory, and the consent update application
function.  No database or authentication dependency is required; all tests run
against the pure in-memory model.

Tests are grouped by concern so that a failing group immediately identifies
the broken invariant for clinical/safety review.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from glow_api.consent import (
    CONSENT_POLICY_VERSION,
    ConsentPurpose,
    ConsentRecord,
    ConsentUpdateRequest,
    apply_consent_update,
    make_initial_consent,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_NOW = datetime(2026, 1, 1, 12, 0, 0, tzinfo=UTC)
_USER = "user-abc-123"
_LOCALE = "en"


def _record(**overrides: object) -> ConsentRecord:
    """Build a minimal valid ConsentRecord, overriding any field."""
    defaults: dict[str, object] = {
        "user_id": _USER,
        "record_version": 1,
        "recorded_at": _NOW,
        "locale_presented": _LOCALE,
        "service_use": True,
    }
    defaults.update(overrides)
    return ConsentRecord(**defaults)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# ConsentRecord — field validation
# ---------------------------------------------------------------------------


class TestConsentRecordFieldValidation:
    def test_minimal_valid_record(self) -> None:
        r = _record()
        assert r.user_id == _USER
        assert r.record_version == 1
        assert r.policy_version == CONSENT_POLICY_VERSION
        assert r.locale_presented == _LOCALE
        assert r.service_use is True
        # Privacy-protective defaults
        assert r.transcript_retention is True
        assert r.audio_storage is False
        assert r.video_storage is False
        assert r.session_summary is True
        assert r.personalisation is False
        assert r.research_and_model_improvement is False

    def test_record_is_frozen(self) -> None:
        """Pydantic v2 frozen models raise ValidationError on attribute assignment."""
        r = _record()
        with pytest.raises(ValidationError):
            r.__setattr__("service_use", False)

    def test_user_id_required_not_empty(self) -> None:
        with pytest.raises(ValidationError):
            _record(user_id="")

    def test_record_version_must_be_positive(self) -> None:
        with pytest.raises(ValidationError):
            _record(record_version=0)
        with pytest.raises(ValidationError):
            _record(record_version=-1)

    def test_recorded_at_must_be_timezone_aware(self) -> None:
        naive = datetime(2026, 1, 1, 12, 0, 0)
        with pytest.raises(ValidationError):
            _record(recorded_at=naive)

    def test_locale_must_match_bcp47_pattern(self) -> None:
        valid_locales = ["en", "ar", "ar-EG", "zh-Hans", "ja", "es"]
        for loc in valid_locales:
            r = _record(locale_presented=loc)
            assert r.locale_presented == loc

    def test_invalid_locale_rejected(self) -> None:
        bad_locales = ["", "x", "123", "en_US", "en US", "a" * 21]
        for loc in bad_locales:
            with pytest.raises(ValidationError, match="locale"):
                _record(locale_presented=loc)


# ---------------------------------------------------------------------------
# ConsentRecord — cross-field invariants
# ---------------------------------------------------------------------------


class TestConsentRecordInvariants:
    def test_service_use_false_rejected(self) -> None:
        """A record with service_use=False must never be constructable."""
        with pytest.raises(ValidationError, match="service_use"):
            _record(service_use=False)

    def test_audio_without_transcript_rejected(self) -> None:
        with pytest.raises(ValidationError, match="audio_storage"):
            _record(audio_storage=True, transcript_retention=False)

    def test_video_without_transcript_rejected(self) -> None:
        with pytest.raises(ValidationError, match="video_storage"):
            _record(video_storage=True, transcript_retention=False)

    def test_audio_with_transcript_accepted(self) -> None:
        r = _record(audio_storage=True, transcript_retention=True)
        assert r.audio_storage is True

    def test_video_with_transcript_accepted(self) -> None:
        r = _record(video_storage=True, transcript_retention=True)
        assert r.video_storage is True


# ---------------------------------------------------------------------------
# ConsentRecord — is_purpose_consented
# ---------------------------------------------------------------------------


class TestIsPurposeConsented:
    def test_service_use_is_always_true_on_valid_record(self) -> None:
        r = _record()
        assert r.is_purpose_consented(ConsentPurpose.SERVICE_USE) is True

    def test_research_defaults_to_false(self) -> None:
        r = _record()
        assert r.is_purpose_consented(ConsentPurpose.RESEARCH_AND_MODEL_IMPROVEMENT) is False

    def test_research_true_when_opted_in(self) -> None:
        r = _record(research_and_model_improvement=True)
        assert r.is_purpose_consented(ConsentPurpose.RESEARCH_AND_MODEL_IMPROVEMENT) is True

    def test_all_purposes_covered(self) -> None:
        """Every ConsentPurpose must be handled by is_purpose_consented."""
        r = _record(
            transcript_retention=True,
            audio_storage=True,
            video_storage=True,
            session_summary=True,
            personalisation=True,
            research_and_model_improvement=True,
        )
        for purpose in ConsentPurpose:
            # Should not raise KeyError
            r.is_purpose_consented(purpose)

    def test_transcript_off_returns_false(self) -> None:
        r = _record(transcript_retention=False)
        assert r.is_purpose_consented(ConsentPurpose.TRANSCRIPT_RETENTION) is False

    def test_personalisation_off_returns_false(self) -> None:
        r = _record(personalisation=False)
        assert r.is_purpose_consented(ConsentPurpose.PERSONALISATION) is False


# ---------------------------------------------------------------------------
# ConsentUpdateRequest — validation
# ---------------------------------------------------------------------------


class TestConsentUpdateRequest:
    def test_valid_minimal_request(self) -> None:
        req = ConsentUpdateRequest(locale_presented="en")
        assert req.locale_presented == "en"
        assert req.transcript_retention is None

    def test_valid_full_request(self) -> None:
        req = ConsentUpdateRequest(
            locale_presented="ar-EG",
            transcript_retention=False,
            audio_storage=False,
            video_storage=False,
            session_summary=True,
            personalisation=True,
            research_and_model_improvement=False,
        )
        assert req.personalisation is True

    def test_invalid_locale_rejected(self) -> None:
        with pytest.raises(ValidationError, match="locale"):
            ConsentUpdateRequest(locale_presented="bad locale!")


# ---------------------------------------------------------------------------
# make_initial_consent
# ---------------------------------------------------------------------------


class TestMakeInitialConsent:
    def test_defaults_are_privacy_protective(self) -> None:
        r = make_initial_consent(user_id=_USER, locale_presented=_LOCALE, now=_NOW)
        assert r.record_version == 1
        assert r.service_use is True
        assert r.transcript_retention is True
        assert r.audio_storage is False
        assert r.video_storage is False
        assert r.session_summary is True
        assert r.personalisation is False
        assert r.research_and_model_improvement is False
        assert r.policy_version == CONSENT_POLICY_VERSION
        assert r.recorded_at == _NOW
        assert r.locale_presented == _LOCALE

    def test_explicit_overrides_accepted(self) -> None:
        r = make_initial_consent(
            user_id=_USER,
            locale_presented="ja",
            now=_NOW,
            personalisation=True,
            research_and_model_improvement=True,
        )
        assert r.personalisation is True
        assert r.research_and_model_improvement is True

    def test_invalid_cross_field_still_rejected(self) -> None:
        """Even via the factory, invariants must hold."""
        with pytest.raises(ValidationError):
            make_initial_consent(
                user_id=_USER,
                locale_presented=_LOCALE,
                now=_NOW,
                audio_storage=True,
                transcript_retention=False,
            )

    def test_uses_utc_now_when_not_supplied(self) -> None:
        r = make_initial_consent(user_id=_USER, locale_presented=_LOCALE)
        assert r.recorded_at.tzinfo is not None


# ---------------------------------------------------------------------------
# apply_consent_update
# ---------------------------------------------------------------------------


class TestApplyConsentUpdate:
    def _base(self) -> ConsentRecord:
        return make_initial_consent(user_id=_USER, locale_presented=_LOCALE, now=_NOW)

    def test_unchanged_fields_carried_forward(self) -> None:
        base = self._base()
        update = ConsentUpdateRequest(locale_presented="en")
        new_record = apply_consent_update(base, update, now=_NOW)
        assert new_record.transcript_retention == base.transcript_retention
        assert new_record.personalisation == base.personalisation
        assert new_record.research_and_model_improvement == base.research_and_model_improvement

    def test_version_increments(self) -> None:
        base = self._base()
        update = ConsentUpdateRequest(locale_presented="en", personalisation=True)
        new_record = apply_consent_update(base, update, now=_NOW)
        assert new_record.record_version == base.record_version + 1

    def test_changed_field_applied(self) -> None:
        base = self._base()
        assert base.personalisation is False
        update = ConsentUpdateRequest(locale_presented="en", personalisation=True)
        new_record = apply_consent_update(base, update, now=_NOW)
        assert new_record.personalisation is True

    def test_locale_updated(self) -> None:
        base = self._base()
        update = ConsentUpdateRequest(locale_presented="ar-EG")
        new_record = apply_consent_update(base, update, now=_NOW)
        assert new_record.locale_presented == "ar-EG"

    def test_service_use_never_revoked_by_update(self) -> None:
        """service_use cannot be withdrawn via a ConsentUpdateRequest.

        Revoking service-use requires account deletion, not a consent update.
        The field is not present on ConsentUpdateRequest for this reason.
        """
        base = self._base()
        update = ConsentUpdateRequest(locale_presented="en")
        new_record = apply_consent_update(base, update, now=_NOW)
        assert new_record.service_use is True

    def test_invalid_update_rejected(self) -> None:
        """Disabling transcript while audio is on must still be rejected."""
        base = make_initial_consent(
            user_id=_USER,
            locale_presented=_LOCALE,
            now=_NOW,
            audio_storage=True,
            transcript_retention=True,
        )
        update = ConsentUpdateRequest(locale_presented="en", transcript_retention=False)
        with pytest.raises(ValidationError):
            apply_consent_update(base, update, now=_NOW)

    def test_sequential_updates_increment_version(self) -> None:
        base = self._base()
        u1 = ConsentUpdateRequest(locale_presented="en", personalisation=True)
        r1 = apply_consent_update(base, u1, now=_NOW)
        u2 = ConsentUpdateRequest(locale_presented="en", personalisation=False)
        r2 = apply_consent_update(r1, u2, now=_NOW)
        assert r2.record_version == 3
        assert r2.personalisation is False

    def test_research_opt_in_then_out(self) -> None:
        base = self._base()
        assert base.research_and_model_improvement is False
        u1 = ConsentUpdateRequest(locale_presented="en", research_and_model_improvement=True)
        r1 = apply_consent_update(base, u1, now=_NOW)
        assert r1.research_and_model_improvement is True
        u2 = ConsentUpdateRequest(locale_presented="en", research_and_model_improvement=False)
        r2 = apply_consent_update(r1, u2, now=_NOW)
        assert r2.research_and_model_improvement is False

    def test_update_policy_version_is_current(self) -> None:
        base = self._base()
        update = ConsentUpdateRequest(locale_presented="en")
        new_record = apply_consent_update(base, update, now=_NOW)
        assert new_record.policy_version == CONSENT_POLICY_VERSION
