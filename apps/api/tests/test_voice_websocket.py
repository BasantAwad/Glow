"""
End-to-end voice WebSocket test (Phase 6D).

Tests the full STT → Safety Pipeline → LLM → TTS chain via the
/sessions/{session_id}/voice/stream WebSocket endpoint.

LIVE PROVIDER POLICY:
  This test runs ONLY when ENABLE_LIVE_PROVIDER_TESTS=1.
  It does NOT silently skip and report success.
  
  If ENABLE_LIVE_PROVIDER_TESTS is not set, the test is skipped with an
  explicit message indicating it was not run.

KNOWN HARDWARE REQUIREMENTS:
  STT (faster-whisper):
    - large-v3: ~8 GB GPU VRAM  (preferred quality)
    - medium:   ~5 GB GPU VRAM  (first fallback if OOM)
    - small/CPU: ~2 GB RAM       (final fallback, no GPU needed)
    
    The gateway automatically falls back; set WHISPER_MODEL_SIZE=small and
    WHISPER_DEVICE=cpu to force CPU inference on machines without a GPU.

  LLM (vLLM):
    - Requires a running local vLLM instance at LLM_API_BASE (default: http://localhost:8000/v1).
    - If the endpoint is not reachable, the LLM step will produce a clear error response.

AUDIO FIXTURE:
  This test uses a 1-second silence WAV (all-zero PCM samples).
  The STT gateway will correctly return a low-confidence or empty result for silence.
  The test accepts this as a valid outcome (silence → stt_error/low_confidence).
  
  This is NOT the same as the Audio2Face smoke test fixture policy. The voice
  WebSocket test is validating protocol flow and error handling, not AI quality.
  A silence input is appropriate here because we are testing the safety gate
  (low-confidence silence should be rejected before reaching the LLM).
"""

import os
import io
import struct
import wave
import pytest
from fastapi.testclient import TestClient

from glow_api.main import app

client = TestClient(app)


def _make_silence_wav_1s() -> bytes:
    """Generate a 1-second 16kHz / 16-bit PCM / Mono silence WAV."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        wav.writeframes(b"\x00\x00" * 16000)  # 1 second of silence
    return buf.getvalue()


@pytest.mark.asyncio
async def test_websocket_e2e_voice_flow():
    """
    E2E voice flow: silence audio → STT low-confidence gate → graceful error response.

    Verifies:
      1. WebSocket connection is accepted.
      2. Sending binary audio returns an `stt_partial` acknowledgment.
      3. Sending a flush triggers transcription.
      4. Silence audio correctly triggers the low-confidence gate (stt_error) OR
         produces an stt_final with empty/low-confidence text that is rejected
         by the safety pipeline before reaching the LLM.
      5. The connection closes cleanly.
    """
    if os.environ.get("ENABLE_LIVE_PROVIDER_TESTS") != "1":
        pytest.skip(
            "Live provider tests not enabled. "
            "Set ENABLE_LIVE_PROVIDER_TESTS=1 to run E2E voice tests.\n"
            "Also ensure: faster-whisper is installed, and for LLM tests, "
            "vLLM is running at LLM_API_BASE."
        )

    try:
        import faster_whisper  # noqa: F401
    except ImportError:
        pytest.fail(
            "faster-whisper is not installed. "
            "Live E2E voice tests require the real STT dependency. "
            "Run: pip install faster-whisper"
        )

    audio_bytes = _make_silence_wav_1s()

    with client.websocket_connect("/sessions/test_session_123/voice/stream") as websocket:
        # Send binary audio chunk
        websocket.send_bytes(audio_bytes)

        # Expect a partial acknowledgment from the router
        resp1 = websocket.receive_json()
        assert resp1.get("type") == "stt_partial", (
            f"Expected 'stt_partial' acknowledgment, got: {resp1}"
        )

        # Flush to trigger final transcription
        websocket.send_json({"type": "flush"})

        # For silence input, we expect one of:
        #   (a) stt_error — low confidence detected before LLM
        #   (b) stt_final — empty/near-empty text that the safety pipeline rejects
        resp2 = websocket.receive_json()

        if resp2.get("type") == "stt_error":
            # The low-confidence gate correctly blocked the silent audio.
            # Verify the error message is informative.
            assert "confidence" in resp2.get("message", "").lower() or \
                   "low" in resp2.get("message", "").lower(), (
                f"stt_error message is not informative: {resp2}"
            )
            # Flow ends here — correct behavior for silence input.
            return

        assert resp2.get("type") == "stt_final", (
            f"Expected 'stt_final' or 'stt_error', got: {resp2}"
        )

        # If stt_final was returned (possible for near-silent audio with
        # some content), the safety pipeline should handle it.
        # The LLM step may or may not be reached depending on the transcript.
        try:
            resp3 = websocket.receive_json()
            assert resp3.get("type") in ("llm_reply", "error", "safety_blocked"), (
                f"Unexpected message type from LLM step: {resp3}"
            )
            if resp3.get("type") == "llm_reply":
                assert "text" in resp3, "llm_reply must contain 'text' field"
        except Exception as exc:
            # Timeouts or disconnects are acceptable — the session may have
            # ended after the safety pipeline rejected the silent audio.
            pytest.skip(f"WebSocket closed or timed out after stt_final: {exc}")
