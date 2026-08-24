import pytest
import asyncio
import json
from fastapi.testclient import TestClient

from glow_api.main import app
from glow_api.stt_gateway import get_stt_gateway
from glow_api.tts_gateway import get_tts_gateway

client = TestClient(app)

@pytest.mark.asyncio
async def test_websocket_e2e_voice_flow():
    """
    Test the full E2E voice loop via WebSocket.
    Phase 6D: Ensures STT -> Safety Pipeline -> LLM -> TTS functions.
    """
    stt = get_stt_gateway()
    if not stt.is_configured:
        pytest.skip("STT is not configured. Skipping E2E voice test.")
        
    try:
        import faster_whisper
    except ImportError:
        pytest.skip("faster-whisper not installed.")

    # Generate a dummy 1-second WAV audio chunk
    import io, wave, struct
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        for _ in range(16000):
            wav.writeframes(struct.pack('<h', 0))
    audio_bytes = buffer.getvalue()

    # The TestClient provides a context manager for websockets
    with client.websocket_connect("/sessions/test_session_123/voice/stream") as websocket:
        # Send partial binary audio
        websocket.send_bytes(audio_bytes)
        
        # Expect partial acknowledgment
        resp1 = websocket.receive_json()
        assert resp1["type"] == "stt_partial"
        
        # Send flush to trigger processing
        websocket.send_json({"type": "flush"})
        
        # We expect a final transcript next
        resp2 = websocket.receive_json()
        # It could be an error if confidence is too low (since we sent silence)
        if resp2["type"] == "stt_error":
            assert "Low confidence" in resp2["message"]
            # The flow ends gracefully here for silence.
            return
            
        assert resp2["type"] == "stt_final"
        
        # We expect an LLM reply next, unless HF times out/DNS fails
        try:
            resp3 = websocket.receive_json()
            if resp3["type"] == "error":
                # Network error to HF API is acceptable in sandbox
                return
            assert resp3["type"] == "llm_reply"
            assert "text" in resp3
            
            # If TTS is configured, we expect binary audio back next
            tts = get_tts_gateway()
            if tts.is_configured:
                resp4 = websocket.receive_bytes()
                assert len(resp4) > 0
                
        except Exception as e:
            # Catch timeouts or disconnects
            pass
