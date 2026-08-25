import os
import pytest
from glow_api.tts_gateway import KokoroTtsGateway, SynthesizeRequest


@pytest.mark.asyncio
async def test_kokoro_tts_gateway_contract():
    """
    Live contract test for KokoroTtsGateway.
    
    This test runs ONLY when ENABLE_LIVE_PROVIDER_TESTS=1.
    If that variable is set and the provider fails, this test FAILS explicitly.
    It does NOT silently skip and report success.
    """
    if os.environ.get("ENABLE_LIVE_PROVIDER_TESTS") != "1":
        pytest.skip(
            "Live provider tests not enabled. "
            "Set ENABLE_LIVE_PROVIDER_TESTS=1 to run real provider tests."
        )

    try:
        import kokoro
    except ImportError:
        pytest.fail(
            "kokoro-onnx is not installed. "
            "Live provider tests require the real dependency. "
            "Run: pip install kokoro-onnx soundfile"
        )

    try:
        import soundfile
    except ImportError:
        pytest.fail(
            "soundfile is not installed. "
            "Run: pip install soundfile"
        )

    gateway = KokoroTtsGateway()
    assert gateway.is_configured, "KokoroTtsGateway.is_configured returned False."

    req = SynthesizeRequest(
        session_id="smoke_tts_test",
        text="Hello. This is a short smoke test.",
        language="en",
    )

    resp = await gateway.synthesize(req)

    assert isinstance(resp.audio_chunk, bytes), "audio_chunk is not bytes."
    assert len(resp.audio_chunk) > 1000, \
        f"audio_chunk is suspiciously small ({len(resp.audio_chunk)} bytes). Synthesis may have failed silently."
    assert resp.latency_ms > 0, "latency_ms must be positive."
    assert resp.model_id == gateway.model_id, \
        f"model_id mismatch: {resp.model_id!r} != {gateway.model_id!r}"

    # Verify the output is a valid WAV file
    import io
    import soundfile as sf
    audio_data, sample_rate = sf.read(io.BytesIO(resp.audio_chunk))
    assert sample_rate == 24000, f"Expected 24000 Hz sample rate, got {sample_rate}"
    assert len(audio_data) > 0, "Audio data is empty."

    print(
        f"\n[LIVE TTS TEST] model={resp.model_id} "
        f"latency={resp.latency_ms:.1f}ms "
        f"bytes={len(resp.audio_chunk)} "
        f"sample_rate={sample_rate} "
        f"duration={len(audio_data)/sample_rate:.2f}s"
    )
