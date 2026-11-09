"""Single-use auth tokens (email verification, password reset) — unit level.

Hermetic coverage of the token helpers; the HTTP flows themselves are
verified end-to-end against the live app (test-runtime/reset_e2e_test.py).
"""

import datetime

from glow_api.auth_tokens import (
    TOKEN_TTL_HOURS,
    expiry,
    is_valid,
    new_token,
    token_hash,
)


class _Row:
    def __init__(self, token_hash_: str, used_at=None, expires_at=None):
        self.token_hash = token_hash_
        self.used_at = used_at
        self.expires_at = expires_at or expiry()


def test_hash_roundtrip_and_uniqueness():
    a, b = new_token(), new_token()
    assert a != b
    assert len(a) == 64  # 32 bytes hex
    assert token_hash(a) != a
    assert token_hash(a) == token_hash(a)


def test_is_valid_checks_hash_and_expiry():
    raw = new_token()
    row = _Row(token_hash(raw))
    assert is_valid(row, raw) is True
    assert is_valid(row, "0" * 64) is False
    assert is_valid(None, raw) is False


def test_is_valid_rejects_used_and_expired():
    raw = new_token()
    used = _Row(token_hash(raw), used_at=datetime.datetime.now(datetime.UTC))
    assert is_valid(used, raw) is False

    stale = _Row(
        token_hash(raw),
        expires_at=datetime.datetime.now(datetime.UTC) - datetime.timedelta(hours=1),
    )
    assert is_valid(stale, raw) is False

    future = _Row(
        token_hash(raw),
        expires_at=datetime.datetime.now(datetime.UTC) + datetime.timedelta(hours=2),
    )
    assert is_valid(future, raw) is True


def test_expiry_is_ttl_in_future():
    delta = expiry() - datetime.datetime.now(datetime.UTC)
    assert TOKEN_TTL_HOURS * 3600 - 60 < delta.total_seconds() <= TOKEN_TTL_HOURS * 3600
