"""Unit tests for crisis keyword detection, Egypt crisis resources, and safety classifier."""

from glow_api.safety import (
    CRISIS_REGISTRY,
    RiskTier,
    SafetySignal,
    run_pre_generation_check,
)
from glow_api.safety_classifier import classify_distress


def test_crisis_keyword_detection_suicidal():
    result = run_pre_generation_check("I feel like I want to die and end my life", is_adult_confirmed=True)
    assert result.block_generation is True
    assert result.require_crisis is True
    assert result.risk_tier == RiskTier.CRISIS
    assert SafetySignal.SUICIDAL_IDEATION in result.signals
    assert result.response_override is not None
    assert "123" in result.response_override  # Egypt emergency
    assert "16328" in result.response_override  # Egypt mental health line


def test_crisis_keyword_detection_self_harm():
    result = run_pre_generation_check("I have been thinking about cutting myself", is_adult_confirmed=True)
    assert result.block_generation is True
    assert result.risk_tier == RiskTier.HIGH
    assert SafetySignal.SELF_HARM in result.signals
    assert result.response_override is not None


def test_safe_input_not_blocked():
    result = run_pre_generation_check("Today was a stressful day at work", is_adult_confirmed=True)
    assert result.block_generation is False
    assert result.require_crisis is False
    assert result.risk_tier == RiskTier.NONE or result.risk_tier == RiskTier.MODERATE


def test_egypt_crisis_resources_populated():
    eg_resources = CRISIS_REGISTRY.get_resources(jurisdiction="EG", locale="ar")
    assert len(eg_resources) >= 3
    numbers = {r.contact_value for r in eg_resources}
    assert "123" in numbers
    assert "122" in numbers
    assert "16328" in numbers

    eg_en_resources = CRISIS_REGISTRY.get_resources(jurisdiction="EG", locale="en")
    assert any("762 1602" in r.contact_value for r in eg_en_resources)


def test_safety_classifier_distress():
    res_high = classify_distress("I hate myself and want everything to stop, unbearable pain")
    assert res_high.is_high_risk is True
    assert res_high.distress_score >= 0.7

    res_calm = classify_distress("Hello, I would like to try a breathing exercise today")
    assert res_calm.is_high_risk is False
    assert res_calm.distress_score < 0.5
