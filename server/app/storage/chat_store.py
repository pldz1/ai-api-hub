"""Chat persistence layer."""

from __future__ import annotations

from typing import Dict, List, Optional

import aiosqlite

from app.core import CONF, LOGGER

from ._shared import require_connection


class ChatStore:
    """Persist chats and messages per workspace."""

    def __init__(self) -> None:
        self.conn: Optional[aiosqlite.Connection] = None
        self.database_name = CONF.get_database_path("chat.db")
        self.cids_sheet_name = "cids"

    async def initialize(self) -> None:
        self.conn = await aiosqlite.connect(self.database_name)
        if self.conn is None:
            LOGGER.error("Failed to connect to the chat database.")
            return

        await self.conn.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {self.cids_sheet_name} (
                id INTEGER PRIMARY KEY,
                username TEXT,
                cid TEXT,
                cname TEXT,
                settings TEXT
            )
            """
        )
        await self.conn.commit()
        LOGGER.info("Successfully initialized the chat database.")

    @require_connection
    async def destroy(self) -> None:
        await self.conn.close()
        LOGGER.info("Closed the chat database connection.")

    @require_connection
    async def get_cids_and_cnames_by_username(self, username: str) -> List[Dict[str, str]]:
        cursor = await self.conn.execute(
            f"SELECT cid, cname FROM {self.cids_sheet_name} WHERE username = ?",
            (username,),
        )
        rows = await cursor.fetchall()
        return [{"cid": row[0], "cname": row[1]} for row in rows]

    @require_connection
    async def get_chat_settings_by_username_cid(self, username: str, cid: str) -> str:
        cursor = await self.conn.execute(
            f"SELECT settings FROM {self.cids_sheet_name} WHERE username = ? AND cid = ?",
            (username, cid),
        )
        data = await cursor.fetchone()
        return data[0] if data else ""

    @require_connection
    async def set_chat_settings_by_username_cid(self, username: str, cid: str, settings: str) -> None:
        cursor = await self.conn.execute(
            f"UPDATE {self.cids_sheet_name} SET settings = ? WHERE username = ? AND cid = ?",
            (settings, username, cid),
        )
        if cursor.rowcount == 0:
            await self.conn.execute(
                f"INSERT INTO {self.cids_sheet_name} (username, cid, settings) VALUES (?, ?, ?)",
                (username, cid, settings),
            )
        await self.conn.commit()

    @require_connection
    async def create_chat_sheet(self, username: str, cid: str, cname: str) -> None:
        await self.conn.execute(
            f"INSERT INTO {self.cids_sheet_name} (username, cid, cname) VALUES (?, ?, ?)",
            (username, cid, cname),
        )
        await self.conn.commit()

        sheet_name = f"{username}-{cid}"
        await self.conn.execute(
            f"""
            CREATE TABLE IF NOT EXISTS "{sheet_name}" (
                id INTEGER PRIMARY KEY,
                mid TEXT,
                message TEXT
            )
            """
        )
        await self.conn.commit()

    @require_connection
    async def delete_chat_sheet(self, username: str, cid: str) -> None:
        await self.conn.execute(
            f"DELETE FROM {self.cids_sheet_name} WHERE username = ? AND cid = ?",
            (username, cid),
        )
        await self.conn.commit()
        await self.conn.execute(f'DROP TABLE IF EXISTS "{username}-{cid}"')
        await self.conn.commit()

    @require_connection
    async def update_cname_by_username_and_cid(self, username: str, cid: str, new_cname: str) -> None:
        await self.conn.execute(
            f"UPDATE {self.cids_sheet_name} SET cname = ? WHERE username = ? AND cid = ?",
            (new_cname, username, cid),
        )
        await self.conn.commit()

    @require_connection
    async def insert_message(self, username: str, cid: str, mid: str, message: str) -> None:
        await self.conn.execute(
            f'INSERT INTO "{username}-{cid}" (mid, message) VALUES (?, ?)',
            (mid, message),
        )
        await self.conn.commit()

    @require_connection
    async def delete_message(self, username: str, cid: str, mid: str) -> None:
        await self.conn.execute(
            f'DELETE FROM "{username}-{cid}" WHERE mid = ?',
            (mid,),
        )
        await self.conn.commit()

    @require_connection
    async def get_all_messages_by_username_cid(self, username: str, cid: str) -> List[Dict[str, str]]:
        cursor = await self.conn.execute(f'SELECT mid, message FROM "{username}-{cid}"')
        rows = await cursor.fetchall()
        return [{"mid": row[0], "message": row[1]} for row in rows]


CHAT_DATABASE = ChatStore()
