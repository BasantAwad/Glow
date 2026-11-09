"""
Glow-owned HMAC-SHA256 signed JWT authentication provider (ADR 0002).

This is the concrete implementation of the AuthProvider interface for Phase 1.
It does NOT depend on any third-party identity service.

Properties:
  - Algorithm: HMAC-SHA256 (HS256) via PyJWT (MIT license)
  - Token lifetime: 1 hour (not configurable to prevent accidental extension)
  - Key: GLOW_AUTH_SECRET_KEY (hex-encoded, min 32 bytes) from environment
  - Key rotation: GLOW_AUTH_SECRET_KEY_V2 — accepted for verification;
    used exclusively for issuance when present
  - Claims: sub (user_id), iat, exp, jti (unique token ID), aud, iss
  - Fail behavior: ProviderNotConfiguredError when key is not set

Security notes:
  - jti is a UUID4 — enables future server-side revocation list (JTI blocklist)
    without invalidating existing tokens
  - Token payload must never contain therapy content, diagnosis, or PII beyond
    the opaque user_id (sub)
  - Key material must never appear in any log line (enforced by error messages
    not including the raw key value)

Installing PyJWT:
  pip install 'PyJWT>=2.8,<3'
  (Add to pyproject.toml dependencies before production)
"""

from __future__ import annotations

import hashlib
import hmac as hmac_module
import json
import logging
import uuid
from base64 import urlsafe_b64decode, urlsafe_b64encode
from datetime import UTC, datetime, timedelta

from glow_api.auth import AuthPrincipal, AuthProvider, TokenValidationResult
from glow_api.errors import ProviderNotConfiguredError

logger = logging.getLogger(__name__)

_TOKEN_LIFETIME_SECONDS: int = 3600  # 1 hour
_AUDIENCE: str = "glow-api"
_ISSUER: str = "glow"


def _b64_encode(data: bytes) -> str:
    return urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64_decode(s: str) -> bytes:
    # Pad to a multiple of 4
    padding = 4 - len(s) % 4
    if padding != 4:
        s += "=" * padding
    return urlsafe_b64decode(s)


def _sign_hs256(key_bytes: bytes, message: bytes) -> bytes:
    return hmac_module.new(key_bytes, message, hashlib.sha256).digest()


def _issue_token(key_bytes: bytes, user_id: str, device_id: str, is_adult_confirmed: bool) -> str:
    """Issue a signed JWT token without PyJWT dependency (pure stdlib).

    Produces a standard HS256 JWT. Compatible with PyJWT for verification
    if PyJWT is later added as a production dependency.
    """
    now = int(datetime.now(UTC).timestamp())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "iss": _ISSUER,
        "aud": _AUDIENCE,
        "sub": user_id,
        "device_id": device_id,
        "is_adult_confirmed": is_adult_confirmed,
        "jti": str(uuid.uuid4()),
        "iat": now,
        "exp": now + _TOKEN_LIFETIME_SECONDS,
    }
    header_b64 = _b64_encode(json.dumps(header, separators=(",", ":")).encode())
    payload_b64 = _b64_encode(json.dumps(payload, separators=(",", ":")).encode())
    message = f"{header_b64}.{payload_b64}".encode()
    sig = _sign_hs256(key_bytes, message)
    return f"{header_b64}.{payload_b64}.{_b64_encode(sig)}"


def _verify_token(
    token: str,
    keys: list[bytes],
) -> dict | None:
    """Verify a JWT token against one or more HMAC keys (pure stdlib).

    Returns the decoded payload dict on success, None on any verification failure.
    Checks:
      - Header alg == HS256
      - Signature valid against at least one provided key
      - exp not passed
      - iss and aud match expected values
    """
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None

        header_b64, payload_b64, sig_b64 = parts
        message = f"{header_b64}.{payload_b64}".encode()

        # Check header
        header = json.loads(_b64_decode(header_b64))
        if header.get("alg") != "HS256":
            return None

        # Verify signature against at least one key
        expected_sig = _b64_decode(sig_b64)
        sig_valid = False
        for key in keys:
            candidate_sig = _sign_hs256(key, message)
            if hmac_module.compare_digest(candidate_sig, expected_sig):
                sig_valid = True
                break
        if not sig_valid:
            return None

        # Decode payload
        payload = json.loads(_b64_decode(payload_b64))

        # Check exp
        now = int(datetime.now(UTC).timestamp())
        if payload.get("exp", 0) < now:
            return None

        # Check iss and aud
        if payload.get("iss") != _ISSUER:
            return None
        aud = payload.get("aud")
        if isinstance(aud, list):
            if _AUDIENCE not in aud:
                return None
        elif aud != _AUDIENCE:
            return None

        return payload

    except Exception:
        # Any parse/decode error = invalid token
        return None


def _get_key_bytes(hex_key: str) -> bytes:
    """Convert key material to bytes (hex or URL-safe base64, minimum 32 bytes)."""
    from glow_api.kms import decode_key_material

    try:
        key_bytes = decode_key_material(hex_key)
    except ValueError as e:
        raise ProviderNotConfiguredError("glow_jwt_auth") from e
    return key_bytes


class GlowSignedJwtAuthProvider(AuthProvider):
    """Glow-owned HMAC-SHA256 signed JWT authentication provider.

    No third-party identity service required.  Key material is loaded from
    GLOW_AUTH_SECRET_KEY (and optionally GLOW_AUTH_SECRET_KEY_V2 for rotation).

    When neither key is configured, all token operations raise
    ProviderNotConfiguredError — the application starts without auth rather
    than silently accepting all requests.

    Key rotation workflow:
      1. Set GLOW_AUTH_SECRET_KEY_V2 to the new key and restart.
      2. Server now accepts tokens from both old and new key; issues with new key.
      3. After all old tokens have expired (1 hour), remove GLOW_AUTH_SECRET_KEY
         and rename V2 to V1.

    This provider is intended for Phase 1 development and early pilot.
    Before production, integrate a proper identity provider (ADR 0002) and
    add a JTI blocklist for per-token revocation.
    """

    def __init__(self) -> None:
        from glow_api.settings import get_settings
        s = get_settings()

        if not s.auth_secret_key:
            self._configured = False
            self._issuance_key: bytes | None = None
            self._verification_keys: list[bytes] = []
            return

        primary = _get_key_bytes(s.auth_secret_key)
        v2: bytes | None = None
        if s.auth_secret_key_v2:
            v2 = _get_key_bytes(s.auth_secret_key_v2)

        # Issue with V2 if available; verify against both
        self._issuance_key = v2 if v2 is not None else primary
        self._verification_keys = [primary] if v2 is None else [v2, primary]
        self._configured = True

        logger.info(
            "GlowSignedJwtAuthProvider initialized (key_rotation=%s)",
            v2 is not None,
        )

    @property
    def is_configured(self) -> bool:
        return self._configured

    async def validate_token(self, raw_token: str) -> TokenValidationResult:
        """Validate a Glow-signed JWT.

        Returns valid=False on any error rather than raising, so route handlers
        can return a clean 401 rather than a 500.
        """
        if not self._configured:
            # Fail clearly — do not silently accept anything
            raise ProviderNotConfiguredError("glow_jwt_auth")

        payload = _verify_token(raw_token, self._verification_keys)
        if payload is None:
            return TokenValidationResult(valid=False, error_reason="invalid_or_expired_token")

        user_id = payload.get("sub", "")
        if not user_id:
            return TokenValidationResult(valid=False, error_reason="missing_sub_claim")

        exp_ts = payload.get("exp", 0)
        iat_ts = payload.get("iat", 0)

        try:
            principal = AuthPrincipal(
                user_id=user_id,
                issued_at=datetime.fromtimestamp(iat_ts, tz=UTC),
                expires_at=datetime.fromtimestamp(exp_ts, tz=UTC),
                device_id=payload.get("device_id", ""),
                is_adult_confirmed=bool(payload.get("is_adult_confirmed", False)),
                scopes=frozenset(payload.get("scopes", [])),
            )
        except Exception as e:
            logger.warning("GlowSignedJwtAuthProvider: failed to build principal: %s", e)
            return TokenValidationResult(valid=False, error_reason="malformed_claims")

        return TokenValidationResult(valid=True, principal=principal)

    async def revoke_token(self, raw_token: str) -> None:
        """Best-effort revocation.

        Full per-token revocation requires a JTI blocklist (e.g. Redis-backed).
        That is deferred to production hardening.  For now, tokens expire
        naturally after 1 hour.
        """
        # jti = json.loads(_b64_decode(raw_token.split(".")[1])).get("jti")
        # TODO: add jti to server-side blocklist when implemented.
        logger.info("GlowSignedJwtAuthProvider.revoke_token called (JTI blocklist not yet implemented)")

    def issue_token(self, user_id: str, device_id: str = "", *, is_adult_confirmed: bool = False) -> str:
        """Issue a signed JWT for the given user_id.

        This method is used by the POST /auth/token endpoint.
        It must not be called from any route that can be reached without
        prior server-side identity verification.

        Args:
            user_id: Server-assigned opaque user identifier.
            device_id: Optional device identifier.
            is_adult_confirmed: Whether the user's adult status has been confirmed.

        Returns:
            A signed JWT string.

        Raises:
            ProviderNotConfiguredError: If the auth secret key is not set.
        """
        if not self._configured or self._issuance_key is None:
            raise ProviderNotConfiguredError("glow_jwt_auth")
        return _issue_token(self._issuance_key, user_id, device_id, is_adult_confirmed)


def get_auth_provider() -> GlowSignedJwtAuthProvider:
    """Return the singleton Glow JWT auth provider.

    Raises ProviderNotConfiguredError on first call if GLOW_AUTH_SECRET_KEY
    is not set.  Call this from dependency-injection context, not module level.
    """
    return GlowSignedJwtAuthProvider()
