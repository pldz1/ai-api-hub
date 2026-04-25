"""Small utility helpers kept for compatibility."""

from .auth import generate_basic_auth_string
from .crypto import add_padding, decrypt_dict, encrypt_dict, xor_encrypt_decrypt
from .ids import oruuid, reuuid
from .serialize import dict2Str, str2Dict

__all__ = [
    "generate_basic_auth_string",
    "oruuid",
    "reuuid",
    "dict2Str",
    "str2Dict",
    "xor_encrypt_decrypt",
    "encrypt_dict",
    "decrypt_dict",
    "add_padding",
]
