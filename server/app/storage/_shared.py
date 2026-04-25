"""Shared database helpers."""

from __future__ import annotations

import functools

from app.core import LOGGER


def require_connection(func):
    """Skip store operations when SQLite is unavailable."""

    @functools.wraps(func)
    async def wrapper(self, *args, **kwargs):
        if self.conn is None:
            LOGGER.warning(f"Connection is None. Skipping '{func.__name__}'.")
            raise ConnectionError(f"Connection is None. Skipping '{func.__name__}'.")
        return await func(self, *args, **kwargs)

    return wrapper
