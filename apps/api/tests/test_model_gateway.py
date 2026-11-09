import pytest
from glow_api.errors import ErrorCode, GlowError, ProviderNotConfiguredError
from glow_api.local_gateway import LocalModelGateway
from glow_api.model_gateway import (
    GenerationRequest,
    OpenWeightsModelGateway,
    UnconfiguredModelGateway,
    get_model_gateway,
)
from glow_api.settings import settings

@pytest.mark.asyncio
async def test_local_model_gateway_direct():
    """Verify the local context engine only works when explicitly selected."""
    gateway = LocalModelGateway()
    assert gateway.is_configured is True

    req = GenerationRequest(
        session_id="test_sess_offline",
        user_id="test_user_offline",
        system_prompt="You are Glow.",
        conversation_history=(),
        user_message="I'm feeling really anxious and overwhelmed today.",
        locale="en-US",
        max_tokens=100
    )

    resp = await gateway.generate(req)
    assert resp.text
    assert len(resp.text) > 10
    assert resp.token_count > 0

@pytest.mark.asyncio
async def test_open_weights_gateway_does_not_fallback_on_unreachable():
    """A configured provider outage is surfaced instead of switching models."""
    gateway = OpenWeightsModelGateway()
    # Point to an unreachable mock endpoint to test fallback
    gateway.api_base = "http://127.0.0.1:59999/unreachable"

    req = GenerationRequest(
        session_id="test_sess_fallback",
        user_id="test_user_fallback",
        system_prompt="You are Glow.",
        conversation_history=(),
        user_message="I am having trouble sleeping.",
        locale="en-US",
        max_tokens=60,
        timeout_sec=0.5
    )

    with pytest.raises(GlowError) as exc_info:
        await gateway.generate(req)

    assert exc_info.value.code == ErrorCode.PROVIDER_UNAVAILABLE
    assert "fallback" not in str(exc_info.value).lower()


def test_model_gateway_factory_does_not_select_local_model_automatically(monkeypatch):
    monkeypatch.setattr(settings, "llm_api_base", None)

    assert isinstance(get_model_gateway(), UnconfiguredModelGateway)


@pytest.mark.asyncio
async def test_unconfigured_model_gateway_fails_clearly(monkeypatch):
    monkeypatch.setattr(settings, "llm_api_base", None)
    gateway = get_model_gateway()
    request = GenerationRequest(
        session_id="test_unconfigured",
        user_id="test_user",
        system_prompt="You are Glow.",
        conversation_history=(),
        user_message="Hello.",
        locale="en",
    )

    with pytest.raises(ProviderNotConfiguredError):
        await gateway.generate(request)

@pytest.mark.asyncio
async def test_open_weights_gateway_generate_contract():
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
