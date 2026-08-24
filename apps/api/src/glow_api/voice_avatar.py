"""
Provider-neutral interfaces for voice, multilingual support, and avatar (Phases 6–7).

Implements:
 - STT (speech-to-text) interface.
 - TTS (text-to-speech) interface.
 - Language detection and translation interface.
 - Avatar presentation layer interface.
 - WebSocket/WebRTC session signalling interface.
 - AI disclosure requirement (avatar must never claim to be human).
 - Support for pilot locales: Arabic, English, Spanish, Japanese, Simplified Chinese.

Rules (CLAUDE.md §2, §4):
 - Raw audio is not retained by default.  Storage requires explicit audio_storage consent.
 - The avatar is a replaceable presentation layer.  It is NOT the intelligence.
 - The avatar MUST disclose that it is AI at all times.
 - Text-only and voice-only modes must be available as fallbacks.
 - Reduced-motion and captions must be available.
 - No paid provider may be integrated without explicit approval and documented terms.
 - Language support is NOT claimed to be clinically validated until real evaluation
   data and qualified reviewers are available.

All providers are DEFERRED.  All gateway classes raise ProviderNotConfiguredError
until a real, approved provider is wired in.
"""

from __future__ import annotations

import abc
from dataclasses import dataclass
from enum import StrEnum
from typing import AsyncIterator

# ---------------------------------------------------------------------------
# Supported pilot locales
# ---------------------------------------------------------------------------

PILOT_LOCALES: frozenset[str] = frozenset({"en", "ar", "es", "ja", "zh-Hans"})

# Languages for which clinical validation has NOT yet been performed.
# This set starts as all languages and shrinks only after documented validation.
CLINICALLY_UNVALIDATED_LOCALES: frozenset[str] = PILOT_LOCALES.copy()


# ---------------------------------------------------------------------------
# Audio types
# ---------------------------------------------------------------------------


class AudioFormat(StrEnum):
    OPUS = "opus"
    PCM16 = "pcm16"
    MP3 = "mp3"


@dataclass(frozen=True)
class AudioChunk:
    """A chunk of audio data.  Raw bytes; format specified separately."""

    data: bytes
    format: AudioFormat
    sample_rate_hz: int = 16000
    is_final: bool = False


@dataclass(frozen=True)
class TranscriptionResult:
    """Result of a speech-to-text transcription.

    Fields:
        text:           The transcribed text.
        confidence:     0.0–1.0 confidence score (provider-dependent).
        locale:         Detected or specified locale.
        is_final:       True for a final (non-streaming) result.
        raw_retained:   MUST be False unless audio_storage consent is True.
    """

    text: str
    confidence: float
    locale: str
    is_final: bool = True
    raw_retained: bool = False  # Default: audio not retained


# ---------------------------------------------------------------------------
# STT interface
# ---------------------------------------------------------------------------


class STTGateway(abc.ABC):
    """Abstract speech-to-text gateway."""

    @property
    @abc.abstractmethod
    def is_configured(self) -> bool: ...

    @abc.abstractmethod
    async def transcribe_stream(
        self,
        audio_stream: AsyncIterator[AudioChunk],
        locale: str,
        *,
        retain_audio: bool = False,
    ) -> AsyncIterator[TranscriptionResult]: ...


class UnconfiguredSTTGateway(STTGateway):
    @property
    def is_configured(self) -> bool:
        return False

    async def transcribe_stream(
        self,
        audio_stream: AsyncIterator[AudioChunk],
        locale: str,
        *,
        retain_audio: bool = False,
    ) -> AsyncIterator[TranscriptionResult]:
        from glow_api.errors import ProviderNotConfiguredError
        raise ProviderNotConfiguredError("stt_gateway")
        yield  # unreachable; makes this a generator


# ---------------------------------------------------------------------------
# TTS interface
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class SynthesisRequest:
    text: str
    locale: str
    voice_id: str | None = None  # Provider-specific; None means default voice


class TTSGateway(abc.ABC):
    """Abstract text-to-speech gateway."""

    @property
    @abc.abstractmethod
    def is_configured(self) -> bool: ...

    @abc.abstractmethod
    async def synthesize_stream(
        self,
        request: SynthesisRequest,
    ) -> AsyncIterator[AudioChunk]: ...


class UnconfiguredTTSGateway(TTSGateway):
    @property
    def is_configured(self) -> bool:
        return False

    async def synthesize_stream(
        self,
        request: SynthesisRequest,
    ) -> AsyncIterator[AudioChunk]:
        from glow_api.errors import ProviderNotConfiguredError
        raise ProviderNotConfiguredError("tts_gateway")
        yield  # unreachable


# ---------------------------------------------------------------------------
# Language detection and translation interface
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class DetectionResult:
    detected_locale: str
    confidence: float


@dataclass(frozen=True)
class TranslationResult:
    source_locale: str
    target_locale: str
    translated_text: str
    is_clinically_validated: bool = False


class TranslationGateway(abc.ABC):
    @property
    @abc.abstractmethod
    def is_configured(self) -> bool: ...

    @abc.abstractmethod
    async def detect_language(self, text: str) -> DetectionResult: ...

    @abc.abstractmethod
    async def translate(
        self,
        text: str,
        source_locale: str,
        target_locale: str,
    ) -> TranslationResult: ...


class UnconfiguredTranslationGateway(TranslationGateway):
    @property
    def is_configured(self) -> bool:
        return False

    async def detect_language(self, text: str) -> DetectionResult:
        from glow_api.errors import ProviderNotConfiguredError
        raise ProviderNotConfiguredError("translation_gateway")

    async def translate(self, text: str, source_locale: str, target_locale: str) -> TranslationResult:
        from glow_api.errors import ProviderNotConfiguredError
        raise ProviderNotConfiguredError("translation_gateway")


# ---------------------------------------------------------------------------
# Avatar interface (Phase 7)
# ---------------------------------------------------------------------------


class AvatarMode(StrEnum):
    """Avatar presentation mode."""

    TEXT_ONLY = "text_only"         # No avatar; text chat only
    VOICE_ONLY = "voice_only"       # Voice without visual avatar
    FULL = "full"                   # Voice + visual avatar
    CAPTIONS = "captions"           # Voice + captions (no visual avatar)
    REDUCED_MOTION = "reduced_motion"  # Avatar with no animations


# Mandatory disclosure string.  Must be visible in all avatar modes.
# This text is not negotiable — CLAUDE.md §2 absolute rule.
AVATAR_AI_DISCLOSURE: str = (
    "I am Glow, an AI. I am not a human, not a therapist, and not a clinician. "
    "I do not have personal experience, feelings, or consciousness. "
    "I am not a substitute for professional mental health care."
)


@dataclass(frozen=True)
class AvatarConfig:
    """Configuration for the avatar presentation layer.

    The avatar is purely a presentation layer.  It does NOT affect the
    underlying model, safety checks, or session logic.

    Fields:
        mode:           Presentation mode.
        provider_id:    Opaque provider-assigned avatar identifier.
                        None = provider not configured (show text-only).
        disclosure_always_visible: Must be True; enforced server-side.
        reduce_motion:  Whether animations are suppressed.
        captions_enabled: Whether captions are shown alongside voice.
    """

    mode: AvatarMode = AvatarMode.TEXT_ONLY
    provider_id: str | None = None  # None = unconfigured
    disclosure_always_visible: bool = True  # ALWAYS True; not configurable
    reduce_motion: bool = False
    captions_enabled: bool = False

    def __post_init__(self) -> None:
        if not self.disclosure_always_visible:
            raise ValueError(
                "disclosure_always_visible must always be True. "
                "The AI disclosure is mandatory and cannot be disabled."
            )


class AvatarGateway(abc.ABC):
    """Abstract avatar provider gateway."""

    @property
    @abc.abstractmethod
    def is_configured(self) -> bool: ...

    @abc.abstractmethod
    async def get_available_avatars(self) -> list[str]:
        """Return available avatar IDs from the provider."""


class UnconfiguredAvatarGateway(AvatarGateway):
    @property
    def is_configured(self) -> bool:
        return False

    async def get_available_avatars(self) -> list[str]:
        return []  # No avatars available; fall back to text-only mode
