"""
Speech-to-Text (STT) Gateway (Phase 6B).

Defines the interface and implementation for real-time and chunked transcription,
strictly adhering to the no-mock policy.

The interface requires confidence scoring, partial/final states, and timestamping.
Final text outputs must always be validated by the safety pipeline (Orchestrator).
"""

from __future__ import annotations

import abc
from dataclasses import dataclass
from typing import AsyncIterator


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
    """
    text: str
    is_partial: bool
    confidence: float
    language_detected: str | None
    latency_ms: float


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
        """

    @abc.abstractmethod
    async def stream(self, session_id: str, audio_stream: AsyncIterator[bytes], language: str | None = None) -> AsyncIterator[TranscriptionResponse]:
        """Stream an entire utterance and yield partial/final results dynamically."""


class UnconfiguredSttGateway(SttGateway):
    @property
    def is_configured(self) -> bool:
        return False

    async def transcribe(self, request: TranscriptionRequest) -> TranscriptionResponse:
        from glow_api.errors import ProviderNotConfiguredError
        raise ProviderNotConfiguredError("stt_gateway")

    async def stream(self, session_id: str, audio_stream: AsyncIterator[bytes], language: str | None = None) -> AsyncIterator[TranscriptionResponse]:
        from glow_api.errors import ProviderNotConfiguredError
        raise ProviderNotConfiguredError("stt_gateway")
        yield


class FasterWhisperSttGateway(SttGateway):
    """Real STT Gateway using faster-whisper.
    
    This fulfills the requirement to use a real model without third-party data retention.
    `faster-whisper` must be installed.
    """

    def __init__(self, model_size: str = "large-v3", device: str = "auto", compute_type: str = "default"):
        self.model_size = model_size
        self.device = device
        self.compute_type = compute_type
        self._model = None
        # We assume configuration is valid if we instantiate it.
        # However, we only load the model into memory on the first request to save RAM.

    @property
    def is_configured(self) -> bool:
        return True

    def _get_model(self):
        # Lazy load to avoid importing faster-whisper globally (since it's heavy)
        if self._model is None:
            try:
                from faster_whisper import WhisperModel
                self._model = WhisperModel(self.model_size, device=self.device, compute_type=self.compute_type)
            except ImportError as e:
                raise RuntimeError("faster-whisper is not installed. Cannot use FasterWhisperSttGateway.") from e
        return self._model

    async def transcribe(self, request: TranscriptionRequest) -> TranscriptionResponse:
        import time
        import io
        import asyncio

        start_time = time.perf_counter()
        
        # faster-whisper generally expects complete audio files for transcription.
        # In a highly optimized streaming setup, VAD (Voice Activity Detection) 
        # is used to chunk audio and send it. Here we simulate the processing of a chunk.
        
        def _transcribe_sync():
            model = self._get_model()
            # faster-whisper can read from a file-like object containing wav/mp3 data
            # Or raw numpy arrays. We assume audio_chunk contains encoded audio bytes (e.g., WAV).
            audio_io = io.BytesIO(request.audio_chunk)
            segments, info = model.transcribe(audio_io, language=request.language, beam_size=5)
            
            text = " ".join([segment.text for segment in segments])
            # Calculate average confidence if segments exist
            seg_list = list(segments)
            avg_confidence = sum([s.no_speech_prob for s in seg_list]) / len(seg_list) if seg_list else 1.0
            # Whisper gives no_speech_prob. Confidence of speech is 1 - no_speech_prob
            confidence = 1.0 - avg_confidence

            return text.strip(), confidence, info.language

        # Run transcription in a threadpool to not block the async event loop
        loop = asyncio.get_running_loop()
        try:
            text, confidence, lang = await loop.run_in_executor(None, _transcribe_sync)
        except Exception as e:
            raise RuntimeError(f"Transcription failed: {e}") from e

        latency_ms = (time.perf_counter() - start_time) * 1000.0

        return TranscriptionResponse(
            text=text,
            is_partial=not request.is_final,
            confidence=confidence,
            language_detected=lang,
            latency_ms=latency_ms
        )

    async def stream(self, session_id: str, audio_stream: AsyncIterator[bytes], language: str | None = None) -> AsyncIterator[TranscriptionResponse]:
        # A true streaming implementation with faster-whisper requires a rolling buffer
        # and VAD (like Silero VAD) to detect utterance boundaries.
        # For the scope of this gateway contract, we will buffer until the stream ends
        # and yield a final result, as faster-whisper is block-based.
        buffer = bytearray()
        async for chunk in audio_stream:
            buffer.extend(chunk)
            # Yielding partials could be done here if we implement a rolling window transcribe
        
        # Once stream ends, transcribe the whole buffer
        req = TranscriptionRequest(
            session_id=session_id,
            audio_chunk=bytes(buffer),
            language=language,
            is_final=True
        )
        res = await self.transcribe(req)
        yield res


def get_stt_gateway() -> SttGateway:
    # We default to FasterWhisper per Phase 6B
    # Note: If faster-whisper is not installed, it will fail cleanly at runtime.
    return FasterWhisperSttGateway()
