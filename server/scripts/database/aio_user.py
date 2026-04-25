"""Compatibility wrapper for the user store."""

from app.storage.user_store import USER_DATABASE, UserStore as AIO_User_Database

__all__ = ["AIO_User_Database", "USER_DATABASE"]
