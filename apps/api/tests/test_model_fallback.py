"""Tests for the primary -> secondary -> local model fallback chain."""

from __future__ import annotations

from typing import AsyncIterator

import pytest

from glow_api.errors import ErrorCode, GlowError
from glow_api.model_gateway import (
    FallbackModelGateway,
    GenerationRequest,
    GenerationResponse,
    GenerationStopReason,
    ModelGateway,
    UnconfiguredModelGateway,
    get_model_gateway,
)
from glow_api.settings import settings


def _request() -> GenerationRequest:
    return GenerationRequest(
        session_id="test-session",
        user_id="test-user",
        system_prompt="You are Glow.",
        conversation_history=(),
        user_message="I feel overwhelmed.",
        locale="en",
        max_tokens=64,
    )


class _StubGateway(ModelGateway):
    def __init__(self, name: str, *, text: str = "ok", fail: bool = False) -> None:
        self.name = name
        self.text = text
        self.fail = fail
        self.calls = 0

    @property
    def is_configured(self) -> bool:
        return True

    async def generate(self, request: GenerationRequest) -> GenerationResponse:
        self.calls += 1
        if self.fail:
            raise GlowError(ErrorCode.PROVIDER_UNAVAILABLE, "down", http_status=503)
        return GenerationResponse(
            text=self.text,
            stop_reason=GenerationStopReason.STOP_TOKEN,
            model_id=self.name,
            latency_ms=1.0,
            token_count=1,
        )

    async def stream(self, request: GenerationRequest) -> AsyncIterator[str]:
        self.calls += 1
        if self.fail:
            raise GlowError(ErrorCode.PROVIDER_UNAVAILABLE, "down", http_status=503)
        if self.text:
            yield self.text


@pytest.mark.asyncio
async def test_primary_success_does_not_call_fallback():
    primary = _StubGateway("primary", text="primary reply")
    secondary = _StubGateway("secondary", text="secondary reply")
    gateway = FallbackModelGateway([primary, secondary])

    response = await gateway.generate(_request())

    assert response.text == "primary reply"
    assert primary.calls == 1
    assert secondary.calls == 0


@pytest.mark.asyncio
async def test_primary_failure_uses_secondary():
    primary = _StubGateway("primary", fail=True)
    secondary = _StubGateway("secondary", text="secondary reply")
    gateway = FallbackModelGateway([primary, secondary])

    response = await gateway.generate(_request())

    assert response.text == "secondary reply"
    assert primary.calls == 1
    assert secondary.calls == 1


@pytest.mark.asyncio
async def test_empty_primary_response_uses_secondary():
    primary = _StubGateway("primary", text="")
    secondary = _StubGateway("secondary", text="secondary reply")
    gateway = FallbackModelGateway([primary, secondary])

    response = await gateway.generate(_request())

    assert response.text == "secondary reply"
    assert secondary.calls == 1


@pytest.mark.asyncio
async def test_all_gateways_fail_raises_last_error():
    primary = _StubGateway("primary", fail=True)
    secondary = _StubGateway("secondary", fail=True)
    gateway = FallbackModelGateway([primary, secondary])

    with pytest.raises(GlowError):
        await gateway.generate(_request())


@pytest.mark.asyncio
async def test_stream_falls_back_before_first_chunk():
    primary = _StubGateway("primary", fail=True)
    secondary = _StubGateway("secondary", text="streamed")
    gateway = FallbackModelGateway([primary, secondary])

    chunks = [chunk async for chunk in gateway.stream(_request())]

    assert "".join(chunks) == "streamed"
    assert secondary.calls == 1


def test_factory_builds_primary_secondary_local_chain(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "openai_compatible")
    monkeypatch.setattr(settings, "llm_api_base", "https://primary.example/v1")
    monkeypatch.setattr(settings, "llm_fallback_provider", "openai_compatible")
    monkeypatch.setattr(settings, "llm_fallback_api_base", "https://secondary.example/v1")
    monkeypatch.setattr(settings, "llm_fallback_api_key", "secondary-key")
    monkeypatch.setattr(settings, "llm_fallback_model_id", "secondary-model")
    monkeypatch.setattr(settings, "llm_local_fallback_enabled", True)

    gateway = get_model_gateway()

    assert isinstance(gateway, FallbackModelGateway)
    assert len(gateway._gateways) == 3


def test_factory_keeps_fail_clear_when_local_fallback_disabled(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "auto")
    monkeypatch.setattr(settings, "llm_api_base", None)
    monkeypatch.setattr(settings, "llm_fallback_provider", "local")
    monkeypatch.setattr(settings, "llm_local_fallback_enabled", False)
    monkeypatch.setattr(settings, "environment", "test")

    gateway = get_model_gateway()

    assert isinstance(gateway, UnconfiguredModelGateway)


def test_factory_defaults_to_local_last_resort(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "auto")
    monkeypatch.setattr(settings, "llm_api_base", None)
    monkeypatch.setattr(settings, "llm_fallback_provider", "local")
    monkeypatch.setattr(settings, "llm_local_fallback_enabled", True)
    monkeypatch.setattr(settings, "environment", "production")

    gateway = get_model_gateway()

    from glow_api.local_gateway import LocalModelGateway

    assert isinstance(gateway, LocalModelGateway)
