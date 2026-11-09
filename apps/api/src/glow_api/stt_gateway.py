"""
Speech-to-Text (STT) Gateway (Phase 6B).

Defines the interface and implementation for real-time and chunked transcription,
strictly adhering to the no-mock policy.

The interface requires confidence scoring, partial/final states, and timestamping.
Final text outputs must always be validated by the safety pipeline (Orchestrator).

Model Selection Policy:
  Whisper large-v3 requires ~8 GB of GPU VRAM. If the GPU does not have sufficient
  memory, or no GPU is available, the gateway will automatically fall back to CPU
  with a compute-efficient model size. The active model size and device are logged
  at startup and recorded in the TranscriptionResponse for audit purposes.

  Fallback chain (in order):
    1. large-v3  on CUDA  (float16)      — preferred quality
    2. medium    on CUDA  (float16)      — if OOM on large-v3
    3. small     on CPU   (int8)         — if no GPU / all GPU sizes OOM
    4. Raise a clear RuntimeError with instructions — if even CPU fails

  The fallback chain is configurable via environment variables:
    GLOW_STT_MODEL_ID    — override the starting model size (default: large-v3)
    GLOW_STT_DEVICE      — override the device ('cuda', 'cpu', 'auto'; default: auto)
    GLOW_STT_COMPUTE_TYPE — override compute type ('float16', 'int8', 'default'; default: auto)
"""

from __future__ import annotations

import abc
import logging
import os
from dataclasses import dataclass
from typing import AsyncIterator

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class TranscriptionRequest:
    """A request to transcribe audio data.

    Fields:
        session_id: Opaque identifier for logging/correlation.
        audio_chunk: Raw audio bytes (PCM or provider-supported format).
        language: ISO-639-1 language code hint, or None for auto-detect.
        is_final: True if this is the final chunk of a complete utterance.
    """
    session_id: str
    audio_chunk: bytes
    language: str | None = None
    is_final: bool = False


@dataclass(frozen=True)
class TranscriptionResponse:
    """A transcription result for a given chunk.

    Fields:
        text: The transcribed text.
        is_partial: True if the text might change as more audio arrives.
        confidence: Provider confidence score (0.0 - 1.0) for the segment.
        language_detected: Detected language code.
        latency_ms: Wall-clock latency for this chunk processing.
        model_id: The model size + device that actually produced this result.
    """
    text: str
    is_partial: bool
    confidence: float
    language_detected: str | None
    latency_ms: float
    model_id: str = "unknown"


class SttGateway(abc.ABC):
    """Abstract STT Gateway."""

    @property
    @abc.abstractmethod
    def is_configured(self) -> bool:
        """True iff this gateway is fully configured to transcribe real audio."""

    @abc.abstractmethod
    async def transcribe(self, request: TranscriptionRequest) -> TranscriptionResponse:
        """Transcribe a chunk of audio.

        For fully streaming APIs, this can process partial chunks and return partial results.
        For block-based APIs (like Whisper), the client may need to buffer until `is_final=True`.

        Raises:
            ProviderNotConfiguredError: If is_configured is False.
            RuntimeError: With a clear, actionable message on any provider failure.
        """

    @abc.abstractmethod
    async def stream(
        self,
        session_id: str,
        audio_stream: AsyncIterator[bytes],
        language: str | None = None,
    ) -> AsyncIterator[TranscriptionResponse]:
        """Stream an entire utterance and yield partial/final results dynamically."""
        raise NotImplementedError
        yield  # noqa: unreachable — needed to declare async generator type


class UnconfiguredSttGateway(SttGateway):
    @property
    def is_configured(self) -> bool:
        return False

    async def transcribe(self, request: TranscriptionRequest) -> TranscriptionResponse:
        from glow_api.errors import ProviderNotConfiguredError
        raise ProviderNotConfiguredError("stt_gateway")

    async def stream(
        self,
        session_id: str,
        audio_stream: AsyncIterator[bytes],
        language: str | None = None,
    ) -> AsyncIterator[TranscriptionResponse]:
        from glow_api.errors import ProviderNotConfiguredError
        raise ProviderNotConfiguredError("stt_gateway")
        yield  # noqa: unreachable


# GPU VRAM estimates per model size (approximate, float16):
_MODEL_VRAM_ESTIMATE_GB = {
    "large-v3": 8.0,
    "large-v2": 8.0,
    "large":    8.0,
    "medium":   5.0,
    "small":    2.0,
    "base":     1.0,
    "tiny":     0.5,
}

# Fallback chain: (model_size, device, compute_type)
_CUDA_FALLBACK_CHAIN = [
    ("large-v3", "cuda", "float16"),
    ("medium",   "cuda", "float16"),
    ("small",    "cpu",  "int8"),
]

_CPU_ONLY_CHAIN = [
    ("small",    "cpu",  "int8"),
    ("base",     "cpu",  "int8"),
]


def _decode_to_16k_float32(audio_bytes: bytes):
    """Decode container/PCM audio to 16 kHz mono float32 samples.

    Gets called directly instead of faster-whisper's decode_audio(), whose
    `av.open(..., metadata_errors=...)` call is incompatible with PyAV>=15 —
    feeding WhisperModel a float32 array avoids the broken path entirely.
    """
    import io

    import av  # PyAV

    resampler = av.audio.resampler.AudioResampler(
        format="s16", layout="mono", rate=16000
    )

    # If the input is already raw 16 kHz s16le PCM (the voice WebSocket path
    # sends WAV-wrapped PCM), a quick path detects WAV header first.
    if audio_bytes[:4] == b"RIFF" and audio_bytes[8:12] == b"WAVE":
        import wave

        with wave.open(io.BytesIO(audio_bytes), "rb") as wav:
            frames = wav.readframes(wav.getnframes())
            rate = wav.getframerate()
        if rate == 16000:
            import numpy as np

            return np.frombuffer(frames, dtype=np.int16).astype("float32") / 32768.0

    raw_buffer = io.BytesIO()
    dtype = None
    with av.open(io.BytesIO(audio_bytes), mode="r") as container:
        stream = container.streams.audio[0]
        for frame in container.decode(stream):
            for resampled in resampler.resample(frame):
                array = resampled.to_ndarray()
                dtype = array.dtype
                raw_buffer.write(array)

    import gc

    del resampler
    gc.collect()

    import numpy as np

    audio = np.frombuffer(raw_buffer.getbuffer(), dtype=dtype)
    return audio.astype("float32") / 32768.0


def _load_whisper_with_fallback(preferred_model: str, preferred_device: str, preferred_compute: str):
    """
    Attempt to load faster-whisper with the preferred configuration, falling back
    gracefully if CUDA OOM or other GPU errors occur.

    Returns: (WhisperModel instance, model_size: str, device: str)
    Raises: RuntimeError with clear instructions if all options fail.
    """
    try:
        from faster_whisper import WhisperModel
    except ImportError as e:
        raise RuntimeError(
            "faster-whisper is not installed. "
            "Run: pip install faster-whisper\n"
            "Set ENABLE_LIVE_PROVIDER_TESTS=1 to run live STT tests."
        ) from e

    # Build the chain to try
    if preferred_device in ("cuda", "auto"):
        chain = _CUDA_FALLBACK_CHAIN[:]
        # If the user specified a smaller model than large-v3, start from there
        if preferred_model not in ("large-v3", "large-v2", "large"):
            chain = [(preferred_model, preferred_device, preferred_compute)] + chain
    else:
        chain = _CPU_ONLY_CHAIN[:]

    last_error: Exception | None = None
    for model_size, device, compute_type in chain:
        try:
            logger.info(
                "STT: attempting to load faster-whisper model_size=%s device=%s compute_type=%s",
                model_size, device, compute_type,
            )
            model = WhisperModel(model_size, device=device, compute_type=compute_type)
            logger.info(
                "STT: successfully loaded faster-whisper model_size=%s device=%s",
                model_size, device,
            )
            return model, model_size, device

        except Exception as exc:
            err_str = str(exc).lower()
            is_oom = "out of memory" in err_str or "cuda" in err_str
            if is_oom:
                logger.warning(
                    "STT: failed to load model_size=%s on device=%s (%s); trying next fallback.",
                    model_size, device, exc,
                )
                last_error = exc
                continue
            else:
                # Non-OOM error (e.g. model not found, network error) — raise immediately
                raise RuntimeError(
                    f"Failed to load faster-whisper model '{model_size}' on device '{device}': {exc}\n"
                    "Check that the model is downloaded and the compute type is supported."
                ) from exc

    raise RuntimeError(
        "faster-whisper: all model fallbacks exhausted. "
        f"Last error: {last_error}\n"
        "Options:\n"
        "  - Set GLOW_STT_DEVICE=cpu to force CPU inference.\n"
        "  - Set GLOW_STT_MODEL_ID=small for a smaller model.\n"
        "  - Free GPU VRAM and retry."
    ) from last_error


class FasterWhisperSttGateway(SttGateway):
    """Real STT Gateway using faster-whisper (Systran/faster-whisper-large-v3).

    Model loading is lazy (on first request) and uses an automatic fallback chain
    if the primary model size causes a CUDA out-of-memory error.

    Configuration (env vars, all optional):
        GLOW_STT_MODEL_ID    default: large-v3
        GLOW_STT_DEVICE      default: auto  ('cuda', 'cpu', 'auto')
        GLOW_STT_COMPUTE_TYPE default: auto  ('float16', 'int8', 'default')
    """

    def __init__(
        self,
        model_size: str | None = None,
        device: str | None = None,
        compute_type: str | None = None,
    ):
        from glow_api.settings import settings
        self.model_size = model_size or settings.stt_model_id or "large-v3"
        self.device = device or settings.stt_device
        self.compute_type = compute_type or settings.stt_compute_type
        self._model = None
        self._active_model_id: str = "not-loaded"

    @property
    def is_configured(self) -> bool:
        return True

    def _get_model(self):
        """Lazy-load the model using the fallback chain. Thread-safe for the GIL."""
        if self._model is None:
            model, actual_size, actual_device = _load_whisper_with_fallback(
                self.model_size, self.device, self.compute_type
            )
            self._model = model
            self._active_model_id = f"faster-whisper-{actual_size}/{actual_device}"
        return self._model

    async def transcribe(self, request: TranscriptionRequest) -> TranscriptionResponse:
        import time
        import io
        import asyncio

        start_time = time.perf_counter()

        def _transcribe_sync() -> tuple[str, float, str | None]:
            model = self._get_model()

            # PyAV-decoded float32 samples bypass faster-whisper's
            # container decode (broken on PyAV>=15).
            audio = _decode_to_16k_float32(request.audio_chunk)

            # NOTE: faster-whisper's .transcribe() returns a generator for segments.
            # The generator MUST be consumed exactly once. Do not iterate it twice.
            segments_gen, info = model.transcribe(
                audio,
                language=request.language,
                beam_size=5,
            )

            # Materialise all segments in one pass to avoid double-iteration bug.
            segments = list(segments_gen)

            text = " ".join(seg.text for seg in segments).strip()

            # `no_speech_prob` is per-segment: 0.0 = definitely speech, 1.0 = silence.
            # We invert it so that confidence 1.0 = high-confidence speech.
            if segments:
                avg_no_speech = sum(seg.no_speech_prob for seg in segments) / len(segments)
            else:
                # No segments returned → the audio was silence or unintelligible.
                avg_no_speech = 1.0
            confidence = 1.0 - avg_no_speech

            return text, confidence, info.language

        loop = asyncio.get_running_loop()
        try:
            text, confidence, lang = await loop.run_in_executor(None, _transcribe_sync)
        except RuntimeError:
            raise  # Already has a clear message from _load_whisper_with_fallback or above
        except Exception as exc:
            raise RuntimeError(
                f"Transcription failed: {exc}\n"
                "If this is a CUDA out-of-memory error, set GLOW_STT_DEVICE=cpu "
                "or GLOW_STT_MODEL_ID=small and restart the server."
            ) from exc

        latency_ms = (time.perf_counter() - start_time) * 1000.0

        return TranscriptionResponse(
            text=text,
            is_partial=not request.is_final,
            confidence=confidence,
            language_detected=lang,
            latency_ms=latency_ms,
            model_id=self._active_model_id,
        )

    async def stream(
        self,
        session_id: str,
        audio_stream: AsyncIterator[bytes],
        language: str | None = None,
    ) -> AsyncIterator[TranscriptionResponse]:
        """Buffer the complete audio stream, then transcribe in one pass.

        A fully streaming implementation with per-chunk partial results would
        require VAD (e.g. Silero VAD) to detect utterance boundaries before
        each transcription call. That is Phase 6B follow-up work.
        """
        buffer = bytearray()
        async for chunk in audio_stream:
            buffer.extend(chunk)

        req = TranscriptionRequest(
            session_id=session_id,
            audio_chunk=bytes(buffer),
            language=language,
            is_final=True,
        )
        yield await self.transcribe(req)


def get_stt_gateway() -> SttGateway:
    """Factory: returns a FasterWhisperSttGateway.

    Model size and device are controlled via GLOW_STT_MODEL_ID and GLOW_STT_DEVICE
    environment variables. On CUDA OOM the gateway automatically falls back to
    smaller models or CPU. See module docstring for the full fallback chain.
    """
    return FasterWhisperSttGateway()
