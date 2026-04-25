"""Workspace-level user store."""

from __future__ import annotations

from typing import Optional

import aiosqlite

from app.core import CONF, LOGGER

from ._shared import require_connection
from .user_accounts_store import UserAccountsStore
from .user_settings_store import UserSettingsStore


class UserStore:
    """Persist workspace settings in SQLite."""

    def __init__(self) -> None:
        self.users: Optional[UserAccountsStore] = None
        self.settings: Optional[UserSettingsStore] = None
        self.conn: Optional[aiosqlite.Connection] = None
        self.database_name = CONF.get_database_path("user.db")

    async def initialize(self) -> None:
        self.conn = await aiosqlite.connect(self.database_name)
        if self.conn is None:
            return
        self.users = UserAccountsStore(self.conn)
        await self.users.init_sheet()
        self.settings = UserSettingsStore(self.conn)
        await self.settings.init_sheet()
        await self._ensure_workspace_user()
        LOGGER.info("Successfully initialized the user database.")

    @require_connection
    async def destroy(self) -> None:
        await self.conn.close()
        LOGGER.info("Closed the user database.")

    @require_connection
    async def get_sheet_data(self, sheet: str) -> None:
        async with self.conn.execute(f"SELECT * FROM {sheet}") as cursor:
            rows = await cursor.fetchall()
            LOGGER.info(f"{sheet} all information: {rows}")

    @require_connection
    async def login(self, username: str, password: str) -> bool:
        if not username:
            return True
        if username == CONF.workspace_id:
            return True
        return await self.users.check_user_exists(username, password)

    @require_connection
    async def _ensure_workspace_user(self) -> None:
        """Keep a workspace record so legacy account helpers still function."""
        exists = await self.users.check_user_exists(CONF.workspace_id, "")
        if not exists:
            try:
                await self.users.add_user(CONF.workspace_id, "")
            except Exception:
                # An older database may already contain the row with another shape.
                pass

    @require_connection
    async def get_models(self, username: str) -> str:
        return await self.settings.get_models(username)

    @require_connection
    async def set_models(self, username: str, data: str) -> bool:
        return await self.settings.set_models(username, data)

    @require_connection
    async def get_chat_ins_template_list(self, username: str) -> str:
        return await self.settings.get_chat_ins_template_list(username)

    @require_connection
    async def set_chat_ins_template_list(self, username: str, data: str) -> bool:
        return await self.settings.set_chat_ins_template_list(username, data)

    @require_connection
    async def get_image_models(self, username: str) -> str:
        return await self.settings.get_models(username)

    @require_connection
    async def set_image_models(self, username: str, data: str) -> bool:
        return await self.settings.set_models(username, data)

    @require_connection
    async def get_rt_audio_models(self, username: str) -> str:
        return ""

    @require_connection
    async def set_rt_audio_models(self, username: str, data: str) -> bool:
        return True

    @require_connection
    async def get_app_theme(self, username: str) -> str:
        return await self.settings.get_app_theme(username)

    @require_connection
    async def set_app_theme(self, username: str, data: str) -> bool:
        return await self.settings.set_app_theme(username, data)

    @require_connection
    async def get_app_network(self, username: str) -> str:
        return await self.settings.get_app_network(username)

    @require_connection
    async def set_app_network(self, username: str, data: str) -> bool:
        return await self.settings.set_app_network(username, data)

    @require_connection
    async def update_password(self, username: str, new_password: str) -> bool:
        return await self.users.update_password(username, new_password)

    @require_connection
    async def update_session_id(self, username: str, new_session_id: str) -> bool:
        return await self.users.update_session_id(username, new_session_id)

    @require_connection
    async def get_username_by_session_id(self, session_id: str | None) -> str | None:
        return await self.users.get_username_by_session_id(session_id)


USER_DATABASE = UserStore()
