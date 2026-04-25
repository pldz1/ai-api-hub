"""Workspace settings persistence."""

from __future__ import annotations

from typing import Optional

import aiosqlite

from app.core import LOGGER


class UserSettingsStore:
    """Persist workspace settings in a single table."""

    def __init__(self, conn: Optional[aiosqlite.Connection] = None) -> None:
        self.sheet = "user_settings"
        self.conn = conn

    async def init_sheet(self) -> None:
        await self.conn.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {self.sheet} (
                id INTEGER PRIMARY KEY,
                username TEXT UNIQUE,
                models TEXT,
                chat_ins_template_list TEXT,
                app_theme TEXT,
                app_network TEXT
            )
            """
        )
        await self.conn.commit()

    async def _get_value(self, username: str, column: str) -> str:
        cursor = await self.conn.execute(f"SELECT {column} FROM {self.sheet} WHERE username = ?", (username,))
        row = await cursor.fetchone()
        if row:
            return row[0]
        LOGGER.warning(f"{column} for {username} not found.")
        return ""

    async def _set_value(self, username: str, column: str, data: str) -> bool:
        cursor = await self.conn.execute(f"SELECT id FROM {self.sheet} WHERE username = ?", (username,))
        row = await cursor.fetchone()
        if row:
            await self.conn.execute(f"UPDATE {self.sheet} SET {column} = ? WHERE username = ?", (data, username))
        else:
            await self.conn.execute(f"INSERT INTO {self.sheet} (username, {column}) VALUES (?, ?)", (username, data))
        await self.conn.commit()
        return True

    async def get_models(self, username: str) -> str:
        return await self._get_value(username, "models")

    async def set_models(self, username: str, data: str) -> bool:
        return await self._set_value(username, "models", data)

    async def get_chat_ins_template_list(self, username: str) -> str:
        return await self._get_value(username, "chat_ins_template_list")

    async def set_chat_ins_template_list(self, username: str, data: str) -> bool:
        return await self._set_value(username, "chat_ins_template_list", data)

    async def get_app_theme(self, username: str) -> str:
        return await self._get_value(username, "app_theme")

    async def set_app_theme(self, username: str, data: str) -> bool:
        return await self._set_value(username, "app_theme", data)

    async def get_app_network(self, username: str) -> str:
        return await self._get_value(username, "app_network")

    async def set_app_network(self, username: str, data: str) -> bool:
        return await self._set_value(username, "app_network", data)
