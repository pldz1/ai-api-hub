"""Compatibility wrapper for simple encryption helpers."""

from app.utils.crypto import add_padding, decrypt_dict, encrypt_dict, xor_encrypt_decrypt

__all__ = ["xor_encrypt_decrypt", "encrypt_dict", "decrypt_dict", "add_padding"]
