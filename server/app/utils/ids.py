"""Short random id helpers."""

from __future__ import annotations

import base64
import random
import string
import time


def oruuid(length: int = 25) -> str:
    """Return a short timestamp-prefixed id."""
    timestamp_bytes = str(int(time.time() * 1000)).encode("ascii")
    timestamp_encoded = base64.urlsafe_b64encode(timestamp_bytes).decode("ascii").rstrip("=")
    random_part = "".join(random.choices(string.ascii_letters + string.digits, k=length - len(timestamp_encoded)))
    return f"{timestamp_encoded}_{random_part}"


def reuuid(length: int = 20) -> str:
    """Return a reversed short id."""
    return oruuid(length)[::-1]
