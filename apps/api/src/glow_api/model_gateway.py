"""
Provider-neutral model gateway interface (Phase 3+).

This module defines the *interface* for the AI language model used in
Glow sessions.  It does NOT integrate any specific provider.

Architecture rules (CLAUDE.md §4, §8, ADR 0001):
 - No model provider SDK is imported in this module.
 - The model is called ONLY after the safety pre-generation check passes.
 - Model output MUST pass the post-generation check before being surfaced.
 - If no provider is configured or a provider fails, the gateway fails clearly.
 - The gateway never stores raw session content — that is the responsibility
   of the session persistence layer, subject to consent.
 - The gateway must not claim to be human, to diagnose, or to prescribe.

Provider selection is DEFERRED (ADR 0001).  Until approved:
 - ``ModelGateway.is_configured`` returns False for external providers.
 - No automatic local or canned response fallback is permitted.
"""

from __future__ import annotations

import abc
from dataclasses import dataclass
from enum import StrEnum
from typing import Any, AsyncIterator

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


class FallbackModelGateway(ModelGateway):
    """Try gateways in order, falling back only when a provider fails.

    The primary provider is always attempted first. If it is unconfigured,
    errors, or returns empty text, the next configured gateway is tried.
    The final gateway can be the local rule-based engine (explicitly enabled).
    Safety checks still run in the orchestrator after generation.
    """

    def __init__(self, gateways: list[ModelGateway]) -> None:
        self._gateways = [g for g in gateways if g is not None]

    @property
    def is_configured(self) -> bool:
        return any(g.is_configured for g in self._gateways)

    async def generate(self, request: GenerationRequest) -> GenerationResponse:
        import logging

        from glow_api.errors import ErrorCode, GlowError, ProviderNotConfiguredError

        log = logging.getLogger("glow_api.model_gateway")
        last_error: Exception | None = None

        for index, gateway in enumerate(self._gateways):
            if not gateway.is_configured:
                continue
            try:
                response = await gateway.generate(request)
                if response and response.text and response.text.strip():
                    if index > 0:
                        log.warning(
                            "Primary model unavailable; used fallback gateway %s (%s)",
                            index,
                            type(gateway).__name__,
                        )
                    return response
                last_error = GlowError(
                    ErrorCode.PROVIDER_UNAVAILABLE,
                    "The model provider returned an empty response.",
                    http_status=503,
                )
            except ProviderNotConfiguredError as exc:
                last_error = exc
                continue
            except Exception as exc:
                last_error = exc
                log.warning(
                    "Model gateway %s failed (%s); trying next fallback",
                    type(gateway).__name__,
                    type(exc).__name__,
                )
                continue

        if last_error is not None:
            raise last_error
        raise ProviderNotConfiguredError("model_gateway")

    async def stream(self, request: GenerationRequest) -> AsyncIterator[str]:
        """Stream from the first working gateway.

        Fallback is only attempted before any chunk has been yielded; once
        output has started, switching providers would produce incoherent text.
        """
        import logging

        from glow_api.errors import ProviderNotConfiguredError

        log = logging.getLogger("glow_api.model_gateway")
        last_error: Exception | None = None

        for gateway in self._gateways:
            if not gateway.is_configured:
                continue
            yielded = False
            try:
                async for chunk in gateway.stream(request):
                    yielded = True
                    yield chunk
                return
            except Exception as exc:
                last_error = exc
                if yielded:
                    raise
                log.warning(
                    "Model stream gateway %s failed (%s); trying next fallback",
                    type(gateway).__name__,
                    type(exc).__name__,
                )
                continue

        if last_error is not None:
            raise last_error
        raise ProviderNotConfiguredError("model_gateway")


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
    """OpenAI-compatible chat completions gateway.

    Works with vLLM, Ollama (/v1), Hugging Face Router
    (https://router.huggingface.co/v1), OpenRouter, Groq, or any compatible API.
    Session text is sent only to the configured endpoint.
    """

    def __init__(
        self,
        api_base: str | None = None,
        api_key: str | None = None,
        model_id: str | None = None,
        web_search: object | None = None,
    ) -> None:
        from glow_api.settings import settings
        self.api_base = api_base or settings.llm_api_base
        self.api_key = api_key if api_key is not None else settings.llm_api_key
        self.model_id = model_id or settings.llm_model_id
        self.web_search = web_search

    @property
    def is_configured(self) -> bool:
        return bool(self.api_base)

    def _base_payload(self, request: GenerationRequest, messages: list[dict]) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": self.model_id,
            "messages": messages,
            "max_tokens": request.max_tokens,
            "temperature": request.temperature,
            "top_p": request.top_p,
            "stream": False,
        }
        if "nemotron" in (self.model_id or "").lower():
            payload["reasoning"] = {"enabled": False, "exclude": True}
        return payload

    async def _complete_once(
        self,
        request: GenerationRequest,
        messages: list[dict],
        tools: list[dict] | None,
    ) -> dict[str, Any]:
        """One chat-completions call with free-tier retry + tool-compat fallback.

        If a provider rejects the tools payload (some free models do not
        support function calling), retry once without tools so the turn still
        completes instead of failing into the fallback chain.
        """
        import httpx
        from glow_api.errors import GlowError, ErrorCode

        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        payload = self._base_payload(request, messages)
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        url = self.api_base.rstrip("/") + "/chat/completions"
        last_exc: Exception | None = None
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=request.timeout_sec) as client:
                    resp = await client.post(url, headers=headers, json=payload)
                if resp.status_code in (429, 500, 502, 503, 504) and attempt == 0:
                    import asyncio

                    await asyncio.sleep(1.5)
                    continue
                if resp.status_code == 400 and tools:
                    # Provider rejected function calling — answer without tools.
                    return await self._complete_once(request, messages, None)
                resp.raise_for_status()
                return resp.json()
            except GlowError:
                raise
            except Exception as exc:
                last_exc = exc
                break

        import logging

        logging.getLogger("glow_api.model_gateway").warning(
            "Configured model provider request failed (%s)",
            type(last_exc).__name__ if last_exc else "unknown",
        )
        raise GlowError(
            ErrorCode.PROVIDER_UNAVAILABLE,
            "The configured model provider is unavailable. Please try again later.",
            http_status=503,
        ) from last_exc

    async def generate(self, request: GenerationRequest) -> GenerationResponse:
        import time
        from glow_api.errors import ProviderNotConfiguredError
        from glow_api.web_search import (
            WEB_SEARCH_TOOL,
            format_tool_result,
            record_search,
            sanitize_query,
            search_budget_allows,
        )
        from glow_api.settings import settings

        if not self.is_configured:
            raise ProviderNotConfiguredError("model_gateway")

        messages: list[dict] = [{"role": "system", "content": request.system_prompt}]
        for role, text in request.conversation_history:
            messages.append({"role": role, "content": text})
        messages.append({"role": "user", "content": request.user_message})

        search = self.web_search
        use_tools = bool(search is not None and getattr(search, "is_configured", False))
        tools = [WEB_SEARCH_TOOL] if use_tools else None

        start_time = time.perf_counter()
        data = await self._complete_once(request, messages, tools)

        # Tool loop: execute web_search calls the model makes, then re-prompt.
        # Capped at 3 search rounds so a turn can never loop indefinitely.
        for _ in range(3):
            choices = data.get("choices", [])
            if not choices:
                break
            message = choices[0].get("message", {}) or {}
            tool_calls = message.get("tool_calls") or []
            if not tool_calls or not use_tools or search is None:
                break
            messages.append(message)
            for call in tool_calls:
                function = call.get("function", {}) or {}
                if function.get("name") != "web_search":
                    continue
                arguments = function.get("arguments") or {}
                if isinstance(arguments, str):
                    import json as _json

                    try:
                        arguments = _json.loads(arguments)
                    except Exception:
                        arguments = {}
                query = sanitize_query(str(arguments.get("query") or ""))
                if not query:
                    result_text = "Empty search query."
                elif not search_budget_allows(request.session_id, settings.search_max_per_session):
                    result_text = (
                        "Search budget for this conversation is used up. "
                        "Answer without searching."
                    )
                else:
                    results = await search.search(query, settings.search_max_results)
                    record_search(request.session_id)
                    result_text = format_tool_result(results)
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": call.get("id", "search"),
                        "content": result_text,
                    }
                )
            data = await self._complete_once(request, messages, None)

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
            token_count=token_count,
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
def _hf_token(settings) -> str | None:
    import os

    return (
        getattr(settings, "hf_token", None)
        or os.environ.get("HUGGINGFACE_API_KEY")
        or os.environ.get("HF_TOKEN")
    )


def _search_gateway():
    """Opt-in web search gateway, or None when disabled/unconfigured."""
    from glow_api.web_search import get_web_search_gateway

    return get_web_search_gateway()


def _build_primary_gateway(settings, log) -> ModelGateway | None:
    provider = getattr(settings, "llm_provider", "auto")

    if provider == "disabled":
        return None
    if provider == "local":
        from glow_api.local_gateway import LocalModelGateway

        log.info("Using explicit local context engine (LLM provider=local)")
        return LocalModelGateway()
    if provider == "openai_compatible":
        if settings.llm_api_base:
            log.info("Primary LLM: OpenAI-compatible (%s)", settings.llm_api_base)
            return OpenWeightsModelGateway(web_search=_search_gateway())
        log.warning("GLOW_LLM_PROVIDER=openai_compatible but GLOW_LLM_API_BASE is missing")
        return None
    if provider == "huggingface":
        token = _hf_token(settings)
        if token:
            log.info("Primary LLM: Hugging Face Router (model=%s)", getattr(settings, "hf_model_id", ""))
            return OpenWeightsModelGateway(
                api_base=getattr(settings, "hf_api_base", "https://router.huggingface.co/v1"),
                api_key=token,
                model_id=getattr(settings, "hf_model_id", settings.llm_model_id),
                web_search=_search_gateway(),
            )
        log.warning("GLOW_LLM_PROVIDER=huggingface but no HF token found")
        return None

    # auto: external only when a base URL is configured.
    if settings.llm_api_base:
        log.info("Primary LLM: OpenAI-compatible (auto, %s)", settings.llm_api_base)
        return OpenWeightsModelGateway(web_search=_search_gateway())
    return None


def _build_fallback_gateway(settings, log, local_enabled: bool) -> ModelGateway | None:
    provider = getattr(settings, "llm_fallback_provider", "local")

    if provider == "none":
        return None
    if provider == "local":
        if not local_enabled:
            return None
        from glow_api.local_gateway import LocalModelGateway

        log.info("Fallback LLM: local context engine")
        return LocalModelGateway()
    if provider == "openai_compatible":
        base = getattr(settings, "llm_fallback_api_base", None)
        if not base:
            log.warning("Fallback provider openai_compatible but GLOW_LLM_FALLBACK_API_BASE is missing")
            return None
        log.info("Fallback LLM: OpenAI-compatible (%s)", base)
        return OpenWeightsModelGateway(
            api_base=base,
            api_key=getattr(settings, "llm_fallback_api_key", None),
            model_id=getattr(settings, "llm_fallback_model_id", None) or settings.llm_model_id,
        )
    if provider == "huggingface":
        token = _hf_token(settings)
        if not token:
            log.warning("Fallback provider huggingface but no HF token found")
            return None
        log.info("Fallback LLM: Hugging Face Router")
        return OpenWeightsModelGateway(
            api_base=getattr(settings, "hf_api_base", "https://router.huggingface.co/v1"),
            api_key=token,
            model_id=getattr(settings, "hf_model_id", settings.llm_model_id),
        )
    return None


def get_model_gateway() -> ModelGateway:
    """Return the configured model gateway, optionally wrapped in a fallback chain.

    Order: primary -> configured secondary -> local engine (last resort).
    ``GLOW_LLM_LOCAL_FALLBACK_ENABLED`` defaults to true everywhere so a provider
    outage degrades to the local engine instead of breaking the conversation.
    Set it to false to keep strict fail-clear behavior (e.g. compliance tests).
    """
    import logging

    from glow_api.settings import settings

    log = logging.getLogger(__name__)
    provider = getattr(settings, "llm_provider", "auto")

    if provider == "disabled":
        return UnconfiguredModelGateway()

    local_enabled = getattr(settings, "llm_local_fallback_enabled", True)
    if local_enabled is None:
        # Legacy behavior: opt in by default only in development.
        local_enabled = settings.environment == "development"

    primary = _build_primary_gateway(settings, log)
    fallback = _build_fallback_gateway(settings, log, local_enabled)

    chain: list[ModelGateway] = []
    if primary is not None:
        chain.append(primary)
    if fallback is not None:
        # Avoid duplicate local engines (e.g. explicit local primary + local fallback).
        from glow_api.local_gateway import LocalModelGateway

        if not (isinstance(fallback, LocalModelGateway) and any(isinstance(g, LocalModelGateway) for g in chain)):
            chain.append(fallback)

    # Always keep the local engine as the final last resort when enabled.
    if local_enabled:
        from glow_api.local_gateway import LocalModelGateway

        if not any(isinstance(g, LocalModelGateway) for g in chain):
            log.info("Final fallback LLM: local context engine")
            chain.append(LocalModelGateway())

    if not chain:
        return UnconfiguredModelGateway()
    if len(chain) == 1:
        return chain[0]

    log.info(
        "LLM fallback chain: %s",
        " -> ".join(type(g).__name__ for g in chain),
    )
    return FallbackModelGateway(chain)
