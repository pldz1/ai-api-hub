"""Auth-related helpers kept for compatibility."""

from __future__ import annotations

import base64


def generate_basic_auth_string(username: str, password: str) -> str:
    """Return a base64 basic-auth token."""
    if not username or not password:
        raise ValueError("Both 'username' and 'password' are required.")
    token = f"{username}:{password}".encode("utf-8")
    return base64.b64encode(token).decode("utf-8")
