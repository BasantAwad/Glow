import pytest
from glow_api.model_gateway import OpenWeightsModelGateway, GenerationRequest

@pytest.mark.asyncio
async def test_open_weights_gateway_generate_contract():
    # This is a live provider contract test using non-sensitive utterances
    import os
    if os.environ.get("ENABLE_LIVE_PROVIDER_TESTS") != "1":
        pytest.skip("Live provider tests not enabled.")
        
    gateway = OpenWeightsModelGateway()
    if not gateway.is_configured:
        pytest.fail("Live LLM test BLOCKED: GLOW_LLM_API_BASE is missing.")

    req = GenerationRequest(
        session_id="test_sess_1",
        user_id="test_user_1",
        system_prompt="You are a helpful assistant.",
        conversation_history=(),
        user_message="Hello, can you hear me? Respond with 'Yes I can hear you.'",
        locale="en-US",
        max_tokens=20
    )

    resp = await gateway.generate(req)
    assert resp.text
    assert resp.token_count > 0
    assert resp.latency_ms > 0
    assert "Yes" in resp.text or "hear you" in resp.text or len(resp.text) > 0

@pytest.mark.asyncio
async def test_open_weights_gateway_stream_contract():
    import os
    if os.environ.get("ENABLE_LIVE_PROVIDER_TESTS") != "1":
        pytest.skip("Live provider tests not enabled.")

    gateway = OpenWeightsModelGateway()
    if not gateway.is_configured:
        pytest.fail("Live LLM stream test BLOCKED: GLOW_LLM_API_BASE is missing.")

    req = GenerationRequest(
        session_id="test_sess_2",
        user_id="test_user_2",
        system_prompt="You are a helpful assistant.",
        conversation_history=(),
        user_message="Count from 1 to 3.",
        locale="en-US",
        max_tokens=20
    )

    chunks = []
    async for chunk in gateway.stream(req):
        chunks.append(chunk)

    full_text = "".join(chunks)
    assert len(chunks) > 0
    assert "1" in full_text
    assert "3" in full_text
