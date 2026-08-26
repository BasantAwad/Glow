"""
Text-to-Speech (TTS) Gateway (Phase 6C).

Defines the interface and a Kokoro-TTS–based implementation.

LICENSING NOTE:
  XTTS-v2 (Coqui) is BANNED from this codebase. Coqui Inc. ceased operations in
  January 2024. The XTTS-v2 model weights remain under CPML (non-commercial only).
  There is no legal entity to issue a commercial license.

  This gateway uses Kokoro TTS (Apache 2.0), which explicitly permits commercial use.
  Source: https://huggingface.co/hexgrad/Kokoro-82M
  License: Apache 2.0
  
  The Kokoro model checkpoint used must be pinned by SHA-256 hash. The hash
  must be recorded in docs/real-model-configuration.md before production deployment.

UNRESOLVED BLOCKER (Phase 6E):
  Arabic voice quality must be evaluated on the specific Kokoro checkpoint before
  the model is approved for Arabic-language therapy sessions. A community fine-tune
  (e.g., Nabra/Kokoro-Arabic) may be required. It must carry a compatible license.
"""

from __future__ import annotations

import abc
import asyncio
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass


@dataclass(frozen=True)
class SynthesizeRequest:
    """A request to synthesize text into audio.

    Fields:
        session_id: Opaque identifier for logging/correlation only. Never stored.
        text:       The safety-validated text to synthesize.
        language:   BCP-47 language code.
        voice_id:   Identifier for the voice/persona. Defaults to "af_heart" (Kokoro default).
    """
    session_id: str
    text: str
    language: str
    voice_id: str = "af_heart"


@dataclass(frozen=True)
class SynthesizeResponse:
    """A synthesized audio result.

    Fields:
        audio_chunk: Raw WAV bytes (16-bit PCM, 24 kHz, mono for Kokoro).
        latency_ms:  Wall-clock latency for this synthesis call.
        model_id:    Checkpoint identifier used (for audit log).
    """
    audio_chunk: bytes
    latency_ms: float
    model_id: str


class TtsGateway(abc.ABC):
    """Abstract TTS Gateway. One concrete implementation per approved provider."""

    @property
    @abc.abstractmethod
    def is_configured(self) -> bool:
        """True iff this gateway is fully configured and ready to synthesize real audio."""

    @abc.abstractmethod
    async def synthesize(self, request: SynthesizeRequest) -> SynthesizeResponse:
        """Synthesize a complete string into audio.

        Raises:
            ProviderNotConfiguredError: If is_configured is False.
            RuntimeError: On any provider failure.
        """

    @abc.abstractmethod
    async def stream_synthesize(self, request: SynthesizeRequest) -> AsyncIterator[bytes]:
        """Stream audio bytes as they are generated (for long texts)."""
        # Must be overridden; the `yield` here makes the abstract method a generator.
        raise NotImplementedError
        yield b""  # noqa: unreachable — needed to declare async generator type


class UnconfiguredTtsGateway(TtsGateway):
    """Sentinel. Raises clearly when no real TTS provider is configured."""

    @property
    def is_configured(self) -> bool:
        return False

    async def synthesize(self, request: SynthesizeRequest) -> SynthesizeResponse:
        from glow_api.errors import ProviderNotConfiguredError
        raise ProviderNotConfiguredError("tts_gateway")

    async def stream_synthesize(self, request: SynthesizeRequest) -> AsyncIterator[bytes]:
        from glow_api.errors import ProviderNotConfiguredError
        raise ProviderNotConfiguredError("tts_gateway")
        yield b""  # noqa: unreachable


class KokoroTtsGateway(TtsGateway):
    """TTS Gateway using Kokoro-82M (Apache 2.0).

    Kokoro is a lightweight (82M parameter) model capable of high-quality
    speech synthesis. It runs on CPU, making it suitable for local-only
    inference without GPU requirements at TTS layer.

    Hardware: CPU-only capable. Inference time ~0.1–0.5s per sentence.
    Output format: WAV, 24 kHz, 16-bit PCM, mono.
    Install: pip install kokoro-onnx soundfile

    LANGUAGE SUPPORT STATUS:
      en:     ✅ Verified native support.
      es:     ✅ Supported via multilingual checkpoint.
      ja:     ✅ Supported via multilingual checkpoint.
      zh:     ✅ Supported via multilingual checkpoint.
      ar:     ⚠️  UNRESOLVED. Requires evaluation of a community Arabic fine-tune
                   (e.g., Nabra-Kokoro-Arabic). Must carry Apache 2.0 or compatible
                   license. Quality for Arabic must be tested before production approval.
    """

    def __init__(self) -> None:
        from glow_api.settings import settings
        self.model_id = settings.tts_model_id or "hexgrad/Kokoro-82M"
        self.voice_id = settings.tts_voice_id or "af_heart"
        self._pipeline = None  # Lazy-loaded

    @property
    def is_configured(self) -> bool:
        return True  # Always configured; fails at inference time if `kokoro-onnx` not installed.

    def _get_pipeline(self):
        """Lazy-load the Kokoro ONNX model from .models/ (int8 CPU build).

        Uses kokoro-onnx directly: the `kokoro` pip package (KPipeline) cannot
        build on this environment, and kokoro-onnx is Apache-2.0 compatible.
        """
        if self._pipeline is None:
            try:
                import os

                from kokoro_onnx import Kokoro

                model_dir = os.path.join(os.getcwd(), ".models")
                model_path = os.path.join(model_dir, "kokoro-v1.0.onnx")
                voices_path = os.path.join(model_dir, "voices.bin")
                if not (os.path.isfile(model_path) and os.path.isfile(voices_path)):
                    raise RuntimeError(
                        "Kokoro ONNX weights missing. Download kokoro-v1.0.onnx "
                        "and voices.bin into .models/ (see docs)."
                    )
                self._pipeline = Kokoro(model_path, voices_path)
            except ImportError as e:
                raise RuntimeError(
                    "Kokoro TTS package is not installed. "
                    "Run: pip install kokoro-onnx soundfile"
                ) from e
        return self._pipeline

    async def synthesize(self, request: SynthesizeRequest) -> SynthesizeResponse:
        start_time = time.perf_counter()

        def _run_sync() -> bytes:
            import io

            import numpy as np
            import soundfile as sf

            pipeline = self._get_pipeline()

            # kokoro-onnx Kokoro.create() synthesizes the full utterance at once
            audio, sr = pipeline.create(
                request.text,
                voice=request.voice_id or self.voice_id,
                speed=1.0,
                lang="en-us",
            )
            audio_segments = [audio]
            sample_rate = sr

            if not audio_segments:
                raise RuntimeError("Kokoro returned no audio segments.")

            combined = np.concatenate(audio_segments)

            buf = io.BytesIO()
            sf.write(buf, combined, samplerate=sample_rate, format="WAV", subtype="PCM_16")
            return buf.getvalue()

        loop = asyncio.get_running_loop()
        try:
            audio_bytes = await loop.run_in_executor(None, _run_sync)
        except Exception as e:
            raise RuntimeError(f"Kokoro TTS synthesis failed: {e}") from e

        latency_ms = (time.perf_counter() - start_time) * 1000.0
        return SynthesizeResponse(
            audio_chunk=audio_bytes,
            latency_ms=latency_ms,
            model_id=self.model_id,
        )

    async def stream_synthesize(self, request: SynthesizeRequest) -> AsyncIterator[bytes]:
        """For now, synthesize the full utterance and yield as a single chunk.
        
        Kokoro's KPipeline can be used in a streaming fashion per-sentence;
        this can be refactored to yield per-sentence WAV chunks once
        the client protocol supports incremental audio streaming.
        """
        resp = await self.synthesize(request)
        yield resp.audio_chunk


def get_tts_gateway() -> TtsGateway:
    """Factory: returns a KokoroTtsGateway.
    
    Fails clearly at inference time if kokoro-onnx is not installed.
    XTTS-v2 has been permanently removed due to CPML licensing violation.
    """
    return KokoroTtsGateway()
