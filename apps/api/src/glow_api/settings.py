"""Typed, non-secret application configuration.

All variables use the GLOW_ prefix.
Secret values (keys, passwords) must be supplied via environment variables or
a secret manager.  They are never hardcoded or committed to version control.

For the full variable list and descriptions, see CLAUDE.md §10 and .env.example.
"""

import os
from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings loaded from environment variables, never from clients."""

    model_config = SettingsConfigDict(
        env_prefix="GLOW_",
        extra="ignore",
        # The .env file is a developer convenience only.  Under `test` the
        # environment must be fully controlled by the test fixtures, so the
        # file is ignored — otherwise "provider unconfigured" tests break the
        # moment a real key appears in .env.
        env_file=None if os.environ.get("GLOW_ENVIRONMENT") == "test" else ".env",
    )

    # ---------------------------------------------------------------------------
    # Runtime environment
    # ---------------------------------------------------------------------------
    environment: Literal["development", "test", "production"] = "development"
    service_name: str = "glow-api"

    # ---------------------------------------------------------------------------
    # Web / CORS / cookies
    # ---------------------------------------------------------------------------
    # Comma-separated origins for browser clients. In development, if unset,
    # the API allows common localhost origins. In production, set this explicitly.
    cors_origins: str | None = None
    # Issue auth cookies in addition to JSON bearer tokens (improves persistence).
    auth_cookie_enabled: bool = True
    auth_cookie_name: str = "glow_auth"
    auth_cookie_secure: bool | None = None  # defaults to production-only
    auth_cookie_samesite: Literal["lax", "strict", "none"] = "lax"

    # ---------------------------------------------------------------------------
    # Database
    # ---------------------------------------------------------------------------
    # SQLite is for local development only.
    # PostgreSQL required for any controlled pilot with real user data.
    database_url: str = "sqlite+aiosqlite:///./glow.db"

    # ---------------------------------------------------------------------------
    # Authentication — Glow-owned HMAC-SHA256 signed JWT (ADR 0002)
    # ---------------------------------------------------------------------------
    # Required for any protected endpoint.  Minimum 32 bytes, hex-encoded.
    # When absent, all protected endpoints fail with ProviderNotConfiguredError.
    auth_secret_key: str | None = None

    # Optional rotation key.  Server accepts tokens signed by either key;
    # issues new tokens with v2 key only.
    auth_secret_key_v2: str | None = None

    # ---------------------------------------------------------------------------
    # Encryption (Phase 5 — envelope encryption)
    # ---------------------------------------------------------------------------
    # AES-256-GCM master key.  Hex-encoded 32 bytes.
    # KMS service required for production — see CLAUDE.md §10 key management.
    master_key: str | None = None

    # Optional rotation key — enables key rotation without re-encrypting all data.
    master_key_v2: str | None = None

    # ---------------------------------------------------------------------------
    # LLM gateway (Phase 6A — OpenAI-compatible vLLM endpoint)
    # ---------------------------------------------------------------------------
    # Base URL of a running vLLM-compatible OpenAI API.
    # Example: http://localhost:8000/v1
    # When absent, LLM calls fail with ProviderNotConfiguredError unless an
    # explicit local/development provider is selected via GLOW_LLM_PROVIDER.
    llm_api_base: str | None = None

    # API key for the vLLM endpoint, if auth is enabled there.
    llm_api_key: str | None = None

    # Exact model ID served by vLLM.
    llm_model_id: str = "Qwen/Qwen2.5-14B-Instruct"

    # Optional comma-separated extra model IDs to try on the same provider when
    # the primary model is unavailable (e.g. a free model whose upstream pool is
    # rate-limited). Tried in order before the configured fallback provider.
    llm_model_fallback_ids: str | None = None

    # Maximum tokens to generate per response.
    llm_max_tokens: int = 512

    # Per-provider request timeout in seconds. Lower this for free tiers that
    # often stall, so the fallback chain can answer sooner.
    llm_timeout_sec: float = 30.0

    # Explicit provider selection.
    # - openai_compatible: any OpenAI-compatible chat API (vLLM, Ollama /v1, OpenRouter, Groq, HF Router)
    # - huggingface: Hugging Face Router (OpenAI-compatible) using HF token/model env vars
    # - local: in-process rule-based context engine (dev fallback; not a clinical model)
    # - disabled: fail clearly
    # - auto: external only when GLOW_LLM_API_BASE is set; local fallback in development only
    llm_provider: Literal["auto", "openai_compatible", "huggingface", "local", "disabled"] = "auto"

    # Hugging Face Router support (explicit opt-in; session text is sent to the configured endpoint).
    hf_token: str | None = None
    hf_api_base: str = "https://router.huggingface.co/v1"
    hf_model_id: str = "meta-llama/Llama-3.2-3B-Instruct"

    # ---------------------------------------------------------------------------
    # Optional fallback chain: primary -> secondary -> local (last resort)
    # ---------------------------------------------------------------------------
    # Secondary OpenAI-compatible provider (e.g. OpenRouter free models).
    llm_fallback_provider: Literal["none", "openai_compatible", "huggingface", "local"] = "local"
    llm_fallback_api_base: str | None = None
    llm_fallback_api_key: str | None = None
    llm_fallback_model_id: str | None = None
    # Append the in-process rule-based engine as the final fallback.
    # Enabled by default so a provider outage does not break the conversation;
    # set GLOW_LLM_LOCAL_FALLBACK_ENABLED=false for strict fail-clear behavior.
    # (None keeps the legacy behavior: development only.)
    llm_local_fallback_enabled: bool | None = True

    # ---------------------------------------------------------------------------
    # Email (verification + password reset). Without a provider the link is
    # logged server-side only (dev). Deliver real mail via Resend's free tier.
    # ---------------------------------------------------------------------------
    email_provider: Literal["none", "resend"] = "none"
    resend_api_key: str | None = None
    email_from: str | None = None  # e.g. "Glow <noreply@yourdomain.com>"
    web_base_url: str | None = None  # e.g. "https://your-app.vercel.app"
    require_email_verification: bool = False

    # ---------------------------------------------------------------------------
    # Optional web search tool for the primary model (opt-in, informational only)
    # ---------------------------------------------------------------------------    # When enabled with a free-tier key, the primary model may call a
    # `web_search` tool for general-knowledge questions. Guardrails (prompt,
    # per-session cap, evidence-first ordering) are documented in
    # docs/web-search.md. Search is never used for crisis, diagnosis, or
    # medication questions; the curated evidence corpus stays authoritative.
    web_search_enabled: bool = False
    search_api_key: str | None = None
    search_provider: Literal["tavily", "brave"] = "tavily"
    search_max_results: int = 3
    search_max_per_session: int = 5
    search_timeout_sec: float = 8.0

    # ---------------------------------------------------------------------------
    # Tavus avatar conversation API (secret remains server-side)
    # ---------------------------------------------------------------------------
    tavus_api_key: str | None = None
    tavus_replica_id: str | None = None
    tavus_persona_id: str | None = None

    # ---------------------------------------------------------------------------
    # STT Gateway (Phase 6B — Faster-Whisper)
    # ---------------------------------------------------------------------------
    stt_model_id: str | None = None
    stt_model_path: str | None = None
    stt_device: str = "cpu"
    stt_compute_type: str = "int8"

    # ---------------------------------------------------------------------------
    # TTS Gateway (Phase 6C — Kokoro TTS)
    # ---------------------------------------------------------------------------
    tts_model_id: str | None = None
    tts_model_path: str | None = None
    tts_voice_id: str | None = None
    tts_device: str = "cpu"

    # ---------------------------------------------------------------------------
    # NVIDIA API (Phase 10 — Audio2Face-3D, BLOCKED)
    # ---------------------------------------------------------------------------
    nvidia_api_key: str | None = None
    a2f_endpoint: str | None = None
    a2f_function_id: str | None = None

    # ---------------------------------------------------------------------------
    # Hugging Face (optional — model downloads)
    # ---------------------------------------------------------------------------
    hf_token: str | None = None


@lru_cache
def get_settings() -> Settings:
    """Return process-wide validated settings (cached after first call)."""
    return Settings()


settings = get_settings()
