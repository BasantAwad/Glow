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
    # When absent, LLM calls fail with ProviderNotConfiguredError.
    llm_api_base: str | None = None

    # API key for the vLLM endpoint, if auth is enabled there.
    llm_api_key: str | None = None

    # Exact model ID served by vLLM.
    llm_model_id: str = "Qwen/Qwen2.5-14B-Instruct"

    # Maximum tokens to generate per response.
    llm_max_tokens: int = 512

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
