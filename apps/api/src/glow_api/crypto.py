import os
from typing import Tuple
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

class EnvelopeEncryption:
    """
    AES-256-GCM envelope encryption provider.
    Expects a 32-byte key for encryption/decryption operations.
    """
    @staticmethod
    def encrypt(key: bytes, plaintext: bytes) -> Tuple[bytes, bytes]:
        """
        Encrypts plaintext using AES-256-GCM.
        Returns (nonce, ciphertext).
        The ciphertext includes the authentication tag.
        """
        aesgcm = AESGCM(key)
        nonce = os.urandom(12)
        ciphertext = aesgcm.encrypt(nonce, plaintext, None)
        return nonce, ciphertext

    @staticmethod
    def decrypt(key: bytes, nonce: bytes, ciphertext: bytes) -> bytes:
        """
        Decrypts AES-256-GCM ciphertext using the given key and nonce.
        Raises InvalidTag if authentication fails.
        """
        aesgcm = AESGCM(key)
        return aesgcm.decrypt(nonce, ciphertext, None)
