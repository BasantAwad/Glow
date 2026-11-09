"""
Key Management Service (KMS) abstractions and LocalDevKMS implementation.
"""

from base64 import urlsafe_b64decode
from typing import Protocol

from glow_api.settings import settings


def decode_key_material(value: str) -> bytes:
    """Decode key material to exactly 32 bytes.

    Accepts 64-char hex (32 bytes) or URL-safe base64. Material decoding to
    more than 32 bytes (e.g. a 64-char base64 string = 48 bytes) is reduced
    to 32 bytes with SHA-256, so any randomly generated key works without
    truncation surprises. Material decoding to fewer than 32 bytes is
    rejected.
    """
    raw = value.strip()
    try:
        decoded = bytes.fromhex(raw)
    except ValueError:
        try:
            padded = raw + "=" * (-len(raw) % 4)
            decoded = urlsafe_b64decode(padded)
        except Exception as exc:
            raise ValueError(
                "key material must be hex or URL-safe base64 (at least 32 bytes)"
            ) from exc
    if len(decoded) < 32:
        raise ValueError(
            f"key material must decode to at least 32 bytes (got {len(decoded)})"
        )
    if len(decoded) > 32:
        from hashlib import sha256

        decoded = sha256(decoded).digest()
    return decoded


class KeyManagementService(Protocol):
    """
    Interface for fetching encryption keys for envelope encryption.
    """
    def get_master_key(self, key_id: str | None = None) -> bytes:
        """
        Returns a 32-byte master key.
        """
        ...

class LocalDevKMS:
    """
    Local development implementation of KMS using an environment variable.
    """
    @property
    def active_key_id(self) -> str:
        return "default"
    def get_master_key(self, key_id: str | None = None) -> bytes:
        hex_key = settings.master_key
        if not hex_key:
            raise RuntimeError("GLOW_MASTER_KEY is not configured in environment.")
        try:
            return decode_key_material(hex_key)
        except ValueError as e:
            raise RuntimeError(f"Invalid GLOW_MASTER_KEY: {e}")

# Global KMS instance for the application
kms_service: KeyManagementService = LocalDevKMS()
