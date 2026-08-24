import pytest
from glow_api.stt_gateway import FasterWhisperSttGateway, TranscriptionRequest

@pytest.mark.asyncio
async def test_faster_whisper_stt_gateway_contract():
    # Only test if faster-whisper is installed
    try:
        import faster_whisper
    except ImportError:
        pytest.skip("faster-whisper is not installed, skipping real provider test.")

    # We use the tiny model for tests so we don't download 3GB of large-v3 in the pipeline
    gateway = FasterWhisperSttGateway(model_size="tiny", device="cpu", compute_type="int8")
    assert gateway.is_configured

    # Generate a simple 1 second silent/noise WAV file in memory
    import io
    import wave
    import struct

    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        # Write 16000 samples of 0
        for _ in range(16000):
            wav.writeframes(struct.pack('<h', 0))

    audio_bytes = buffer.getvalue()

    req = TranscriptionRequest(
        session_id="test_stt_1",
        audio_chunk=audio_bytes,
        language="en",
        is_final=True
    )

    resp = await gateway.transcribe(req)
    assert resp.is_partial is False
    assert resp.latency_ms > 0
    # Whisper might transcribe silence as empty string or hallucinatory text,
    # but we just assert it returns a valid structure.
    assert isinstance(resp.text, str)
    assert 0.0 <= resp.confidence <= 1.0

@pytest.mark.asyncio
async def test_faster_whisper_stream():
    try:
        import faster_whisper
    except ImportError:
        pytest.skip("faster-whisper is not installed, skipping real provider test.")
        
    gateway = FasterWhisperSttGateway(model_size="tiny", device="cpu", compute_type="int8")

    import io
    import wave
    import struct

    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        for _ in range(16000):
            wav.writeframes(struct.pack('<h', 0))

    audio_bytes = buffer.getvalue()

    async def mock_audio_stream():
        yield audio_bytes[:len(audio_bytes)//2]
        yield audio_bytes[len(audio_bytes)//2:]

    chunks = []
    async for resp in gateway.stream("test_stream", mock_audio_stream(), "en"):
        chunks.append(resp)

    assert len(chunks) == 1
    assert chunks[0].is_partial is False
