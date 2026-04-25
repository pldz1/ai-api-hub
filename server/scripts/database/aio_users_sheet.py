"""Compatibility wrapper for the legacy users sheet."""

from app.storage.user_accounts_store import UserAccountsStore as AIO_Users_Sheet

__all__ = ["AIO_Users_Sheet"]
