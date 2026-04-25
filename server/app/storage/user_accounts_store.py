"""Compatibility user account store for legacy features."""

from __future__ import annotations

from typing import Optional

import aiosqlite

from app.core import LOGGER


class UserAccountsStore:
    """Persist legacy account records when older integrations still expect them."""

    def __init__(self, conn: Optional[aiosqlite.Connection] = None) -> None:
        self.sheet = "users"
        self.conn = conn

    async def init_sheet(self) -> None:
        await self.conn.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {self.sheet} (
                id INTEGER PRIMARY KEY,
                username TEXT UNIQUE,
                password TEXT,
                uid TEXT,
                session_id TEXT,
                expired_time TIMESTAMP,
                max_age INTEGER
            )
            """
        )
        await self.conn.commit()

    async def add_user(self, username: str, password: str) -> None:
        await self.conn.execute(f"INSERT INTO {self.sheet} (username, password) VALUES (?, ?)", (username, password))
        await self.conn.commit()
        LOGGER.info(f"User database added '{username}'.")

    async def check_user_exists(self, username: str, password: str) -> bool:
        async with self.conn.execute(
            f"SELECT id FROM {self.sheet} WHERE username = ? AND password = ?",
            (username, password),
        ) as cursor:
            return await cursor.fetchone() is not None

    async def update_password(self, username: str, new_password: str) -> bool:
        cursor = await self.conn.execute(
            f"UPDATE {self.sheet} SET password = ? WHERE username = ?",
            (new_password, username),
        )
        await self.conn.commit()
        return cursor.rowcount > 0

    async def update_session_id(self, username: str, new_session_id: str) -> bool:
        cursor = await self.conn.execute(
            f"UPDATE {self.sheet} SET session_id = ? WHERE username = ?",
            (new_session_id, username),
        )
        await self.conn.commit()
        return cursor.rowcount > 0

    async def get_username_by_session_id(self, session_id: str | None) -> str | None:
        if not session_id:
            return None
        async with self.conn.execute(
            f"SELECT username FROM {self.sheet} WHERE session_id = ?",
            (session_id,),
        ) as cursor:
            row = await cursor.fetchone()
            return row[0] if row else None
