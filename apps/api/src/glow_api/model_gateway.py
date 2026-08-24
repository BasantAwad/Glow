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
