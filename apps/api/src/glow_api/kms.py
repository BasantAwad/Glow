"""
Key Management Service (KMS) abstractions and LocalDevKMS implementation.
"""

from typing import Protocol

from glow_api.settings import settings


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
            key_bytes = bytes.fromhex(hex_key)
            if len(key_bytes) != 32:
                raise ValueError("Master key must be exactly 32 bytes (64 hex chars).")
            return key_bytes
        except ValueError as e:
            raise RuntimeError(f"Invalid GLOW_MASTER_KEY: {e}")

# Global KMS instance for the application
kms_service: KeyManagementService = LocalDevKMS()
