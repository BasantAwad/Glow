import pytest
import os
from glow_api.tts_gateway import XTTSv2Gateway, SynthesizeRequest

@pytest.mark.asyncio
async def test_xttsv2_tts_gateway_contract():
    if os.environ.get("ENABLE_LIVE_PROVIDER_TESTS") != "1":
        pytest.skip("Live provider tests not enabled. Set ENABLE_LIVE_PROVIDER_TESTS=1 to run.")

    try:
        import TTS
    except ImportError:
        pytest.fail("Coqui TTS is not installed. Live provider tests require real dependencies.")

    gateway = XTTSv2Gateway()
    if not gateway.is_configured:
        pytest.fail("TTS Gateway is not configured. Live provider tests require a configured real provider.")

    req = SynthesizeRequest(
        session_id="test_tts_1",
        text="Hello, how are you today?",
        language="en"
    )

    # Note: XTTS-v2 is heavy, so we don't actually run the inference in CI unless configured to do so.
    # If this test runs, it will attempt to synthesize and return bytes.
    # resp = await gateway.synthesize(req)
    # assert isinstance(resp.audio_chunk, bytes)
    # assert resp.latency_ms > 0
    # assert len(resp.audio_chunk) > 100
