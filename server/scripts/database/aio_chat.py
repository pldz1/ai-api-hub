"""Compatibility wrapper for the chat store."""

from app.storage.chat_store import CHAT_DATABASE, ChatStore as AIO_Chat_Database

__all__ = ["AIO_Chat_Database", "CHAT_DATABASE"]
