"""Typed, non-secret application configuration."""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings loaded from environment variables, never from clients."""

    model_config = SettingsConfigDict(env_prefix="GLOW_", extra="ignore")

    environment: Literal["development", "test", "production"] = "development"
    service_name: str = "glow-api"


@lru_cache
def get_settings() -> Settings:
    """Return process-wide validated settings."""

    return Settings()

settings = get_settings()

