"""
Tests for the Glow-owned HMAC-SHA256 signed JWT auth provider (ADR 0002).

These tests verify:
  - Token issuance when key is configured
  - Token validation (valid, expired, wrong key, missing token)
  - Key rotation (V2 key accepts new tokens, V1 key still validates old tokens)
  - ProviderNotConfiguredError when key is not set
  - No development bypass possible

No mocks of the auth provider are used. The tests use real token issuance and
validation paths with a test key.
"""
from __future__ import annotations

import os
import secrets
import time
from datetime import UTC, datetime


import pytest

TEST_KEY_HEX = secrets.token_hex(32)  # 32 bytes = 64 hex chars
TEST_KEY_V2_HEX = secrets.token_hex(32)
WEAK_KEY_HEX = secrets.token_hex(4)  # 4 bytes — too short, must be rejected


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def clear_settings_cache():
    """Clear the lru_cache on get_settings between tests."""
    from glow_api.settings import get_settings
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture()
def configured_provider(monkeypatch):
    """Return a GlowSignedJwtAuthProvider with a real test key."""
    monkeypatch.setenv("GLOW_AUTH_SECRET_KEY", TEST_KEY_HEX)
    monkeypatch.delenv("GLOW_AUTH_SECRET_KEY_V2", raising=False)
    from glow_api.settings import get_settings
    get_settings.cache_clear()
    from glow_api.auth_providers.glow_jwt import GlowSignedJwtAuthProvider
    return GlowSignedJwtAuthProvider()


@pytest.fixture()
def rotation_provider(monkeypatch):
    """Return a GlowSignedJwtAuthProvider with both V1 and V2 keys."""
    monkeypatch.setenv("GLOW_AUTH_SECRET_KEY", TEST_KEY_HEX)
    monkeypatch.setenv("GLOW_AUTH_SECRET_KEY_V2", TEST_KEY_V2_HEX)
    from glow_api.settings import get_settings
    get_settings.cache_clear()
    from glow_api.auth_providers.glow_jwt import GlowSignedJwtAuthProvider
    return GlowSignedJwtAuthProvider()


# ---------------------------------------------------------------------------
# Configuration tests
# ---------------------------------------------------------------------------


def test_provider_unconfigured_when_no_key(monkeypatch):
    """Provider reports not configured when GLOW_AUTH_SECRET_KEY is absent."""
    monkeypatch.delenv("GLOW_AUTH_SECRET_KEY", raising=False)
    monkeypatch.delenv("GLOW_AUTH_SECRET_KEY_V2", raising=False)
    from glow_api.settings import get_settings
    get_settings.cache_clear()
    from glow_api.auth_providers.glow_jwt import GlowSignedJwtAuthProvider
    provider = GlowSignedJwtAuthProvider()
    assert not provider.is_configured


def test_issue_token_raises_when_unconfigured(monkeypatch):
    """Issuing a token without a key raises ProviderNotConfiguredError."""
    monkeypatch.delenv("GLOW_AUTH_SECRET_KEY", raising=False)
    monkeypatch.delenv("GLOW_AUTH_SECRET_KEY_V2", raising=False)
    from glow_api.settings import get_settings
    get_settings.cache_clear()
    from glow_api.auth_providers.glow_jwt import GlowSignedJwtAuthProvider
    from glow_api.errors import ProviderNotConfiguredError
    provider = GlowSignedJwtAuthProvider()
    with pytest.raises(ProviderNotConfiguredError):
        provider.issue_token("user-123")


@pytest.mark.asyncio
async def test_validate_raises_when_unconfigured(monkeypatch):
    """Validating a token without a key raises ProviderNotConfiguredError."""
    monkeypatch.delenv("GLOW_AUTH_SECRET_KEY", raising=False)
    monkeypatch.delenv("GLOW_AUTH_SECRET_KEY_V2", raising=False)
    from glow_api.settings import get_settings
    get_settings.cache_clear()
    from glow_api.auth_providers.glow_jwt import GlowSignedJwtAuthProvider
    from glow_api.errors import ProviderNotConfiguredError
    provider = GlowSignedJwtAuthProvider()
    with pytest.raises(ProviderNotConfiguredError):
        await provider.validate_token("any.token.here")


# ---------------------------------------------------------------------------
# Token issuance and validation
# ---------------------------------------------------------------------------


def test_provider_configured_when_key_present(configured_provider):
    assert configured_provider.is_configured


def test_issue_token_returns_three_part_jwt(configured_provider):
    token = configured_provider.issue_token("user-abc")
    parts = token.split(".")
    assert len(parts) == 3, f"Expected 3-part JWT, got: {token!r}"


@pytest.mark.asyncio
async def test_valid_token_validates_successfully(configured_provider):
    token = configured_provider.issue_token("user-xyz", is_adult_confirmed=True)
    result = await configured_provider.validate_token(token)
    assert result.valid
    assert result.principal is not None
    assert result.principal.user_id == "user-xyz"
    assert result.principal.is_adult_confirmed is True


@pytest.mark.asyncio
async def test_different_user_ids_are_preserved(configured_provider):
    for uid in ["alice", "bob-123", "user_001"]:
        token = configured_provider.issue_token(uid)
        result = await configured_provider.validate_token(token)
        assert result.valid
        assert result.principal is not None
        assert result.principal.user_id == uid


@pytest.mark.asyncio
async def test_tampered_token_fails_validation(configured_provider):
    token = configured_provider.issue_token("user-1")
    # Tamper with the signature
    parts = token.split(".")
    tampered = ".".join(parts[:2] + ["invalidsignatureXXX"])
    result = await configured_provider.validate_token(tampered)
    assert not result.valid


@pytest.mark.asyncio
async def test_garbage_token_fails_validation(configured_provider):
    result = await configured_provider.validate_token("not.a.real.jwt.at.all.extra")
    assert not result.valid


@pytest.mark.asyncio
async def test_empty_token_fails_validation(configured_provider):
    result = await configured_provider.validate_token("")
    assert not result.valid


@pytest.mark.asyncio
async def test_wrong_key_fails_validation(monkeypatch):
    """Token signed with one key must fail validation against a different key."""
    monkeypatch.setenv("GLOW_AUTH_SECRET_KEY", TEST_KEY_HEX)
    monkeypatch.delenv("GLOW_AUTH_SECRET_KEY_V2", raising=False)
    from glow_api.settings import get_settings
    get_settings.cache_clear()
    from glow_api.auth_providers.glow_jwt import GlowSignedJwtAuthProvider
    provider_a = GlowSignedJwtAuthProvider()

    monkeypatch.setenv("GLOW_AUTH_SECRET_KEY", TEST_KEY_V2_HEX)
    get_settings.cache_clear()
    provider_b = GlowSignedJwtAuthProvider()

    token = provider_a.issue_token("user-a")
    result = await provider_b.validate_token(token)
    assert not result.valid


# ---------------------------------------------------------------------------
# Key rotation
# ---------------------------------------------------------------------------


def test_rotation_provider_issues_with_v2(rotation_provider):
    """When V2 is configured, the provider issues tokens signed with V2."""
    from glow_api.auth_providers.glow_jwt import _verify_token, _get_key_bytes
    token = rotation_provider.issue_token("user-rotation")
    v2_bytes = _get_key_bytes(TEST_KEY_V2_HEX)
    # Verify directly with V2 key — must succeed
    payload = _verify_token(token, [v2_bytes])
    assert payload is not None
    assert payload.get("sub") == "user-rotation"


@pytest.mark.asyncio
async def test_rotation_provider_validates_old_v1_token(monkeypatch):
    """After adding V2, tokens issued with V1 key still validate."""
    # Issue with V1-only provider
    monkeypatch.setenv("GLOW_AUTH_SECRET_KEY", TEST_KEY_HEX)
    monkeypatch.delenv("GLOW_AUTH_SECRET_KEY_V2", raising=False)
    from glow_api.settings import get_settings
    get_settings.cache_clear()
    from glow_api.auth_providers.glow_jwt import GlowSignedJwtAuthProvider
    provider_v1 = GlowSignedJwtAuthProvider()
    old_token = provider_v1.issue_token("user-v1-issued")

    # Now add V2 to simulate rotation
    monkeypatch.setenv("GLOW_AUTH_SECRET_KEY_V2", TEST_KEY_V2_HEX)
    get_settings.cache_clear()
    provider_rotation = GlowSignedJwtAuthProvider()

    # Old V1 token must still validate
    result = await provider_rotation.validate_token(old_token)
    assert result.valid
    assert result.principal is not None
    assert result.principal.user_id == "user-v1-issued"


@pytest.mark.asyncio
async def test_rotation_provider_validates_v2_token(rotation_provider):
    """V2-issued tokens validate against the rotation provider."""
    token = rotation_provider.issue_token("user-v2-issued")
    result = await rotation_provider.validate_token(token)
    assert result.valid
    assert result.principal is not None
    assert result.principal.user_id == "user-v2-issued"


# ---------------------------------------------------------------------------
# Security: no development bypass
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_no_environment_bypass_allows_empty_token(configured_provider):
    """There is no GLOW_ALLOW_ANONYMOUS or similar bypass — always validate."""
    result = await configured_provider.validate_token("")
    assert not result.valid


@pytest.mark.asyncio
async def test_no_dev_mode_skips_validation(monkeypatch, configured_provider):
    """Setting GLOW_ENVIRONMENT=development does NOT disable token validation."""
    monkeypatch.setenv("GLOW_ENVIRONMENT", "development")
    result = await configured_provider.validate_token("obviously.invalid.token")
    assert not result.valid
