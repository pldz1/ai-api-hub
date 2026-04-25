"""Small JSON serialization helpers."""

from __future__ import annotations

import json


def dict2Str(dict_obj: dict) -> tuple[str, bool]:
    """Serialize a dict to JSON."""
    try:
        return json.dumps(dict_obj), True
    except Exception as error:
        raise ValueError(f"[ERROR] - dict2Str: {error}") from error


def str2Dict(str_obj: str) -> dict | None:
    """Deserialize a JSON string to a dict."""
    if str_obj is None:
        return None
    try:
        return json.loads(str(str_obj))
    except Exception as error:
        raise ValueError(f"[ERROR] - str2Dict: {error}") from error
