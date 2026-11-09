"""Helpers for single-use auth tokens (email verification, password reset).

Raw tokens are random 32-byte secrets hex-encoded once; only their SHA-256
hash is persisted. Tokens are single-use and expire after 24 hours.
"""

from __future__ import annotations

import datetime
import hashlib
import secrets

TOKEN_TTL_HOURS = 24
verify_email = "verify_email"
password_reset = "password_reset"


def new_token() -> str:
    return secrets.token_hex(32)


def token_hash(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def expiry() -> datetime.datetime:
    return datetime.datetime.now(datetime.UTC) + datetime.timedelta(hours=TOKEN_TTL_HOURS)


def is_valid(row, raw: str) -> bool:
    if row is None or row.used_at is not None:
        return False
    if row.token_hash != token_hash(raw):
        return False
    expires = row.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=datetime.UTC)
    return datetime.datetime.now(datetime.UTC) < expires
