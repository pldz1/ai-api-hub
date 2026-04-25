"""Compatibility exports for storage singletons."""

from app.storage import CHAT_DATABASE, IMAGE_DATABASE, USER_DATABASE

__all__ = ["USER_DATABASE", "CHAT_DATABASE", "IMAGE_DATABASE"]
