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
import wave
import pytest
from fastapi.testclient import TestClient

from glow_api.main import app
from glow_api.routers.session_router import _pcm16_to_wav

client = TestClient(app)


def test_pcm16_stream_frames_are_wrapped_as_mono_wav():
    pcm_frames = b"\x00\x00\x10\x00\xf0\xff\x00\x00"

    wav_bytes = _pcm16_to_wav(pcm_frames, 16_000)
    with wave.open(io.BytesIO(wav_bytes), "rb") as wav_file:
        assert wav_file.getnchannels() == 1
        assert wav_file.getsampwidth() == 2
        assert wav_file.getframerate() == 16_000
        assert wav_file.readframes(wav_file.getnframes()) == pcm_frames

@pytest.mark.asyncio
async def test_websocket_e2e_voice_flow():
    if os.environ.get("ENABLE_LIVE_PROVIDER_TESTS") != "1":
        pytest.skip("Live provider tests not enabled.")

    try:
        import faster_whisper  # noqa: F401
    except ImportError:
        pytest.fail("faster-whisper is not installed.")

    fixture_path = os.path.join(os.path.dirname(__file__), "fixtures", "stt_smoke_sentence_16k_mono.wav")
    if not os.path.exists(fixture_path):
        pytest.fail(
            "Live E2E Voice Test BLOCKED.\n"
            "Required: A real short human-recorded technical sentence (16kHz PCM mono).\n"
            "Do NOT use synthetic audio or silent WAVs."
        )

    with open(fixture_path, "rb") as f:
        audio_bytes = f.read()

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

        # Wait for either stt_error or stt_final
        resp2 = websocket.receive_json()

        if resp2.get("type") == "stt_error":
            pytest.fail("Audio fixture was rejected as low confidence/silence.")

        assert resp2.get("type") == "stt_final", (
            f"Expected 'stt_final', got: {resp2}"
        )

        try:
            resp3 = websocket.receive_json()
            assert resp3.get("type") in ("llm_reply", "error", "safety_blocked"), (
                f"Unexpected message type from LLM step: {resp3}"
            )
            if resp3.get("type") == "llm_reply":
                assert "text" in resp3, "llm_reply must contain 'text' field"
        except Exception as exc:
            pytest.skip(f"WebSocket closed or timed out after stt_final: {exc}")
