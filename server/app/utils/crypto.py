"""Simple reversible dict encryption helpers kept for compatibility."""

from __future__ import annotations

import base64
import json


def xor_encrypt_decrypt(data: bytes, key: str) -> bytes:
    """Apply a repeated XOR key."""
    padded_key = (key * ((len(data) // len(key)) + 1))[: len(data)]
    return bytes([a ^ b for a, b in zip(data, padded_key.encode("utf-8"))])


def encrypt_dict(data: dict, key: str, layers: int = 5) -> str:
    """Encrypt a dict into a layered base64 string."""
    encrypted_bytes = xor_encrypt_decrypt(json.dumps(data).encode("utf-8"), key)
    for _ in range(layers):
        encrypted_bytes = base64.urlsafe_b64encode(encrypted_bytes)
    return encrypted_bytes.decode("utf-8")


def decrypt_dict(encrypted_str: str, key: str, layers: int = 5) -> dict:
    """Decrypt a dict produced by `encrypt_dict`."""
    encrypted_bytes = encrypted_str.encode("utf-8")
    for _ in range(layers):
        encrypted_bytes = base64.urlsafe_b64decode(add_padding(encrypted_bytes.decode("utf-8")))
    decrypted_bytes = xor_encrypt_decrypt(encrypted_bytes, key)
    return json.loads(decrypted_bytes.decode("utf-8"))


def add_padding(data: str) -> str:
    """Pad a base64 string."""
    return data + "=" * (-len(data) % 4)
