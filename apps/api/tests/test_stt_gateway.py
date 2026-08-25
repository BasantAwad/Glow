import os
import pytest
from glow_api.stt_gateway import FasterWhisperSttGateway, TranscriptionRequest

@pytest.mark.asyncio
async def test_faster_whisper_stt_gateway_contract():
    if os.environ.get("ENABLE_LIVE_PROVIDER_TESTS") != "1":
        pytest.skip("Live provider tests not enabled.")
        
    try:
        import faster_whisper
    except ImportError:
        pytest.fail("faster-whisper is not installed.")

    fixture_path = os.path.join(os.path.dirname(__file__), "fixtures", "stt_smoke_sentence_16k_mono.wav")
    if not os.path.exists(fixture_path):
        pytest.fail(
            "Live STT test BLOCKED.\n"
            "Required: A real short human-recorded technical sentence (16kHz PCM mono).\n"
            "Do NOT use synthetic audio or silent WAVs."
        )

    gateway = FasterWhisperSttGateway(model_size="tiny", device="cpu", compute_type="int8")
    assert gateway.is_configured

    with open(fixture_path, "rb") as f:
        audio_bytes = f.read()

    req = TranscriptionRequest(
        session_id="test_stt_1",
        audio_chunk=audio_bytes,
        language="en",
        is_final=True
    )

    resp = await gateway.transcribe(req)
    assert resp.is_partial is False
    assert resp.latency_ms > 0
    assert isinstance(resp.text, str)
    assert 0.0 <= resp.confidence <= 1.0


@pytest.mark.asyncio
async def test_faster_whisper_stream():
    if os.environ.get("ENABLE_LIVE_PROVIDER_TESTS") != "1":
        pytest.skip("Live provider tests not enabled.")

    try:
        import faster_whisper
    except ImportError:
        pytest.fail("faster-whisper is not installed.")
        
    fixture_path = os.path.join(os.path.dirname(__file__), "fixtures", "stt_smoke_sentence_16k_mono.wav")
    if not os.path.exists(fixture_path):
        pytest.fail("Live STT stream test BLOCKED (missing real audio fixture).")

    gateway = FasterWhisperSttGateway(model_size="tiny", device="cpu", compute_type="int8")

    with open(fixture_path, "rb") as f:
        audio_bytes = f.read()

    async def real_audio_stream():
        # Yield the real file in chunks
        chunk_size = len(audio_bytes) // 2
        yield audio_bytes[:chunk_size]
        yield audio_bytes[chunk_size:]

    chunks = []
    async for resp in gateway.stream("test_stream", real_audio_stream(), "en"):
        chunks.append(resp)

    assert len(chunks) > 0
    assert chunks[-1].is_partial is False
