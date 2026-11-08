"""
Lightweight safety signal classifier for Glow.

Uses a fast regex + heuristic approach as the primary classifier,
with an optional HuggingFace emotion model as a secondary pass when
the transformers library is available and the model is cached.

This runs AFTER the deterministic keyword checks in safety.py and provides
a secondary confidence signal. It never replaces the deterministic FSM.

Design rules:
- Never crashes the safety pipeline. All errors are caught and logged.
- Returns a confidence score (0.0–1.0) for distress/crisis signals.
- The primary classifier (keyword-based) always has priority.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass

logger = logging.getLogger("glow_api.safety_classifier")

# ---------------------------------------------------------------------------
# Result type
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ClassifierResult:
    """Result of the safety classifier pass.

    Fields:
        distress_score:   0.0–1.0, estimated severity of emotional distress.
        dominant_emotion: Most prominent emotion detected (or 'unknown').
        is_high_risk:     True if classifier believes content is high-risk.
        method:           'regex' | 'emotion_model' | 'combined'.
    """
    distress_score: float
    dominant_emotion: str
    is_high_risk: bool
    method: str


# ---------------------------------------------------------------------------
# Heuristic distress patterns (fast, always available)
# ---------------------------------------------------------------------------

_HIGH_DISTRESS_PATTERNS = [
    re.compile(r"\b(hate\s+myself|hate\s+my\s+life|wish\s+i\s+was\s+dead|"
               r"want\s+everything\s+to\s+stop|so\s+much\s+pain|"
               r"unbearable|can'?t\s+stand\s+(it|this|anymore)|"
               r"done\s+with\s+everything|ending\s+it\s+all)\b", re.IGNORECASE),
]

_MODERATE_DISTRESS_PATTERNS = [
    re.compile(r"\b(hopeless|helpless|worthless|exhausted|overwhelmed|"
               r"breaking\s+down|falling\s+apart|not\s+okay|"
               r"struggling|really\s+hard|so\s+hard|can'?t\s+cope)\b", re.IGNORECASE),
]

_POSITIVE_SIGNALS = [
    re.compile(r"\b(better|improving|okay|good|happy|grateful|hopeful|"
               r"progress|thank\s+you|helped)\b", re.IGNORECASE),
]


def _heuristic_classify(text: str) -> ClassifierResult:
    """Fast regex-based distress classifier."""
    if any(p.search(text) for p in _HIGH_DISTRESS_PATTERNS):
        return ClassifierResult(
            distress_score=0.85,
            dominant_emotion="distress",
            is_high_risk=True,
            method="regex",
        )
    if any(p.search(text) for p in _MODERATE_DISTRESS_PATTERNS):
        score = 0.55
        if any(p.search(text) for p in _POSITIVE_SIGNALS):
            score = 0.3
        return ClassifierResult(
            distress_score=score,
            dominant_emotion="sadness",
            is_high_risk=score >= 0.5,
            method="regex",
        )
    return ClassifierResult(
        distress_score=0.1,
        dominant_emotion="neutral",
        is_high_risk=False,
        method="regex",
    )


# ---------------------------------------------------------------------------
# Optional HuggingFace emotion model (j-hartmann/emotion-english-distilroberta-base)
# ---------------------------------------------------------------------------

_emotion_pipeline: object | None = None
_emotion_model_load_attempted = False

_EMOTION_DISTRESS_MAP: dict[str, float] = {
    "sadness": 0.6,
    "fear": 0.55,
    "anger": 0.45,
    "disgust": 0.4,
    "surprise": 0.15,
    "joy": 0.05,
    "neutral": 0.1,
}

_HIGH_RISK_EMOTIONS = {"sadness", "fear"}
_HIGH_RISK_THRESHOLD = 0.75


def _try_load_emotion_model() -> bool:
    """Attempt to load the emotion model. Returns True on success."""
    global _emotion_pipeline, _emotion_model_load_attempted
    if _emotion_model_load_attempted:
        return _emotion_pipeline is not None
    _emotion_model_load_attempted = True
    try:
        from transformers import pipeline  # type: ignore[import]
        _emotion_pipeline = pipeline(
            "text-classification",
            model="j-hartmann/emotion-english-distilroberta-base",
            top_k=1,
            device=-1,  # CPU only
            truncation=True,
            max_length=128,
        )
        logger.info("Safety emotion classifier loaded: j-hartmann/emotion-english-distilroberta-base")
        return True
    except Exception as e:
        logger.info(
            "Safety emotion classifier not available (transformers not installed or model not cached): %s. "
            "Using regex classifier only.", e
        )
        _emotion_pipeline = None
        return False


def _emotion_model_classify(text: str) -> ClassifierResult | None:
    """Run the HuggingFace emotion model. Returns None if unavailable."""
    if not _try_load_emotion_model() or _emotion_pipeline is None:
        return None
    try:
        truncated = text[:512]
        results = _emotion_pipeline(truncated)  # type: ignore[operator]
        if not results or not results[0]:
            return None
        top = results[0][0]
        label: str = top.get("label", "neutral").lower()
        score: float = float(top.get("score", 0.0))

        distress_base = _EMOTION_DISTRESS_MAP.get(label, 0.1)
        distress_score = distress_base * score + distress_base * 0.3
        distress_score = min(distress_score, 1.0)

        is_high_risk = label in _HIGH_RISK_EMOTIONS and score >= _HIGH_RISK_THRESHOLD

        return ClassifierResult(
            distress_score=round(distress_score, 3),
            dominant_emotion=label,
            is_high_risk=is_high_risk,
            method="emotion_model",
        )
    except Exception as e:
        logger.warning("Emotion model classify error: %s", e)
        return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def classify_distress(text: str) -> ClassifierResult:
    """Classify emotional distress in the given text.

    Uses a fast regex heuristic first. If the HuggingFace emotion model
    is available (transformers installed, model cached), combines both.

    Never raises. Errors fall back to the regex result.

    Args:
        text: User input text to classify.

    Returns:
        ClassifierResult with distress_score, dominant_emotion, is_high_risk.
    """
    if not text or not text.strip():
        return ClassifierResult(0.0, "neutral", False, "regex")

    heuristic = _heuristic_classify(text)

    model_result = _emotion_model_classify(text)
    if model_result is not None:
        combined_score = max(heuristic.distress_score, model_result.distress_score)
        combined_high_risk = heuristic.is_high_risk or model_result.is_high_risk
        dominant = (
            model_result.dominant_emotion
            if model_result.distress_score >= heuristic.distress_score
            else heuristic.dominant_emotion
        )
        return ClassifierResult(
            distress_score=round(combined_score, 3),
            dominant_emotion=dominant,
            is_high_risk=combined_high_risk,
            method="combined",
        )

    return heuristic
