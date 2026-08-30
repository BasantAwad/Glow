"""
Provider-neutral model gateway interface (Phase 3+).

This module defines the *interface* for the AI language model used in
Glow sessions.  It does NOT integrate any specific provider.

Architecture rules (CLAUDE.md §4, §8, ADR 0001):
 - No model provider SDK is imported in this module.
 - The model is called ONLY after the safety pre-generation check passes.
 - Model output MUST pass the post-generation check before being surfaced.
 - If no provider is configured, the gateway raises ProviderNotConfiguredError.
 - The gateway never stores raw session content — that is the responsibility
   of the session persistence layer, subject to consent.
 - The gateway must not claim to be human, to diagnose, or to prescribe.

Provider selection is DEFERRED (ADR 0001).  Until approved:
 - ``ModelGateway.is_configured`` returns False.
 - All generation calls raise ``ProviderNotConfiguredError``.
 - Tests use a ``FakeModelGateway`` test double (defined in tests/helpers/).
"""

from __future__ import annotations

import abc
from dataclasses import dataclass
from enum import StrEnum
from typing import AsyncIterator


class GenerationStopReason(StrEnum):
    """Why the model stopped generating."""

    STOP_TOKEN = "stop_token"
    MAX_TOKENS = "max_tokens"
    SAFETY_FILTER = "safety_filter"
    ERROR = "error"


@dataclass(frozen=True)
class GenerationRequest:
    """A request to the model gateway.

    Fields:
        session_id:     Opaque session identifier (for logging correlation).
        user_id:        Opaque user identifier (for logging correlation).
        system_prompt:  The server-composed system prompt.  Must include the
                        AI disclosure, crisis safety rules, and policy constraints.
        conversation_history: List of prior turns (role, text) tuples.
        user_message:   The current user turn.
        locale:         BCP 47 locale for the session.
        max_tokens:     Hard cap on generated tokens.
        temperature:    Sampling temperature (0.0–1.0).
    """

    session_id: str
    user_id: str
    system_prompt: str
    conversation_history: tuple[tuple[str, str], ...]
    user_message: str
    locale: str
    max_tokens: int = 512
    temperature: float = 0.7
    top_p: float = 0.95
    timeout_sec: float = 30.0


@dataclass(frozen=True)
class GenerationResponse:
    """The result of a model generation call.

    Fields:
        text:        The generated text.  May be empty if the model was
                     filtered or timed out.
        stop_reason: Why generation stopped.
        model_id:    Provider-specific model identifier (for audit logs).
        latency_ms:  Wall-clock latency in milliseconds.
        token_count: Approximate total tokens used.
    """

    text: str
    stop_reason: GenerationStopReason
    model_id: str
    latency_ms: float
    token_count: int


class ModelGateway(abc.ABC):
    """Abstract model gateway.  One concrete subclass per approved provider."""

    @property
    @abc.abstractmethod
    def is_configured(self) -> bool:
        """True iff this gateway has valid credentials and is ready."""

    @abc.abstractmethod
    async def generate(self, request: GenerationRequest) -> GenerationResponse:
        """Generate a response for the given request.

        Raises:
            ProviderNotConfiguredError: If is_configured is False.
            GlowError: On any provider-level failure.
        """

    @abc.abstractmethod
    async def stream(self, request: GenerationRequest) -> AsyncIterator[str]:
        """Stream a response token-by-token.

        Raises:
            ProviderNotConfiguredError: If is_configured is False.
        """


class UnconfiguredModelGateway(ModelGateway):
    """Sentinel gateway used until a real provider is approved."""

    @property
    def is_configured(self) -> bool:
        return False

    async def generate(self, request: GenerationRequest) -> GenerationResponse:
        from glow_api.errors import ProviderNotConfiguredError
        raise ProviderNotConfiguredError("model_gateway")

    async def stream(self, request: GenerationRequest) -> AsyncIterator[str]:
        from glow_api.errors import ProviderNotConfiguredError
        raise ProviderNotConfiguredError("model_gateway")
        yield  # make this a generator (unreachable but required by type)


class OpenWeightsModelGateway(ModelGateway):
    """
    Model gateway implementation for a locally hosted, open-weights LLM.
    By default, it expects a vLLM instance serving an OpenAI-compatible API
    at `http://localhost:8000/v1`. 

    Strictly enforces the user's data processing policy by never sending
    sensitive session data to third-party endpoints.
    """

    def __init__(self) -> None:
        from glow_api.settings import settings
        self.api_base = settings.llm_api_base
        self.api_key = settings.llm_api_key
        self.model_id = settings.llm_model_id

    @property
    def is_configured(self) -> bool:
        return bool(self.api_base)

    async def generate(self, request: GenerationRequest) -> GenerationResponse:
        import httpx
        import time
        from glow_api.errors import ProviderNotConfiguredError, GlowError, ErrorCode

        if not self.is_configured:
            raise ProviderNotConfiguredError("model_gateway")

        # Assemble OpenAI-compatible messages array
        messages = [{"role": "system", "content": request.system_prompt}]
        for role, text in request.conversation_history:
            messages.append({"role": role, "content": text})
        messages.append({"role": "user", "content": request.user_message})

        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
            
        payload = {
            "model": self.model_id,
            "messages": messages,
            "max_tokens": request.max_tokens,
            "temperature": request.temperature,
            "top_p": request.top_p,
            "stream": False,
            # Reasoning models (e.g. NVIDIA Nemotron hybrid) must not leak their
            # chain-of-thought into user-facing support responses.
            "reasoning": {"enabled": False, "exclude": True},
        }

        url = self.api_base.rstrip("/") + "/chat/completions"
        start_time = time.perf_counter()
        
        async with httpx.AsyncClient(timeout=request.timeout_sec) as client:
            try:
                resp = await client.post(url, headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
            except httpx.HTTPError as e:
                raise GlowError(
                    ErrorCode.PROVIDER_UNAVAILABLE,
                    f"Model provider request failed: {e}",
                    http_status=503,
                ) from e

        latency_ms = (time.perf_counter() - start_time) * 1000.0

        choices = data.get("choices", [])
        if not choices:
            raise RuntimeError("No choices returned by model provider.")
            
        message = choices[0].get("message", {})
        text = message.get("content", "")
        
        finish_reason = choices[0].get("finish_reason", "unknown")
        if finish_reason == "stop":
            stop_reason = GenerationStopReason.STOP_TOKEN
        elif finish_reason == "length":
            stop_reason = GenerationStopReason.MAX_TOKENS
        else:
            stop_reason = GenerationStopReason.ERROR

        usage = data.get("usage", {})
        token_count = usage.get("total_tokens", 0)

        return GenerationResponse(
            text=text,
            stop_reason=stop_reason,
            model_id=data.get("model", self.model_id),
            latency_ms=latency_ms,
            token_count=token_count
        )

    async def stream(self, request: GenerationRequest) -> AsyncIterator[str]:
        import httpx
        import json
        from glow_api.errors import ProviderNotConfiguredError, GlowError, ErrorCode

        if not self.is_configured:
            raise ProviderNotConfiguredError("model_gateway")

        messages = [{"role": "system", "content": request.system_prompt}]
        for role, text in request.conversation_history:
            messages.append({"role": role, "content": text})
        messages.append({"role": "user", "content": request.user_message})

        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
            
        payload = {
            "model": self.model_id,
            "messages": messages,
            "max_tokens": request.max_tokens,
            "temperature": request.temperature,
            "top_p": request.top_p,
            "stream": True,
            # Keep chain-of-thought out of streamed support content as well.
            "reasoning": {"enabled": False, "exclude": True},
        }

        url = self.api_base.rstrip("/") + "/chat/completions"

        try:
            async with httpx.AsyncClient(timeout=request.timeout_sec) as client:
                async with client.stream("POST", url, headers=headers, json=payload) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        if line.startswith("data: "):
                            data_str = line[6:]
                            if data_str.strip() == "[DONE]":
                                break
                            try:
                                chunk = json.loads(data_str)
                                choices = chunk.get("choices", [])
                                if choices:
                                    delta = choices[0].get("delta", {})
                                    content = delta.get("content")
                                    if content:
                                        yield content
                            except json.JSONDecodeError:
                                pass
        except httpx.HTTPError as e:
            raise GlowError(
                ErrorCode.PROVIDER_UNAVAILABLE,
                f"Model provider stream request failed: {e}",
                http_status=503,
            ) from e

# Gateway factory — lazy, called at dependency-injection time (not at import time).
# Never call this at module level; doing so crashes when settings fields are absent.
def get_model_gateway() -> ModelGateway:
    """Return a configured ModelGateway, or UnconfiguredModelGateway if GLOW_LLM_API_BASE is not set.

    Always call this at request time (via FastAPI Depends), never at module level.
    """
    from glow_api.settings import settings
    if settings.llm_api_base:
        return OpenWeightsModelGateway()
    return UnconfiguredModelGateway()
