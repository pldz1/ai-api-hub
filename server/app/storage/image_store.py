"""Image persistence and caching."""

from __future__ import annotations

from io import BytesIO
from typing import Dict, List, Optional, Union

import aiohttp
import aiosqlite

from app.core import CONF, LOGGER

from ._shared import require_connection


class ImageStore:
    """Persist cached images in SQLite."""

    def __init__(self) -> None:
        self.conn: Optional[aiosqlite.Connection] = None
        self.database_name = CONF.get_database_path("image.db")
        self.image_list_sheet = "image_list_sheet"

    async def initialize(self) -> None:
        self.conn = await aiosqlite.connect(self.database_name)
        if self.conn is None:
            LOGGER.error("Failed to connect to the image database.")
            return

        await self.conn.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {self.image_list_sheet} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                workspace_id TEXT,
                image_id TEXT UNIQUE,
                image_prompt TEXT,
                image_src BLOB
            )
            """
        )
        await self.conn.commit()
        LOGGER.info("Successfully initialized the image database.")

    @require_connection
    async def destroy(self) -> None:
        await self.conn.close()
        LOGGER.info("Closed the image database connection.")

    async def fetch_image_blob(self, url: str) -> bytes:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status != 200:
                    raise ValueError(f"Failed to fetch image: {response.status}")
                return await response.read()

    @require_connection
    async def push_image(self, workspace_id: str, image_id: str, image_prompt: str, image_src: Union[bytes, BytesIO]) -> None:
        if isinstance(image_src, BytesIO):
            image_src = image_src.getvalue()

        await self.conn.execute(
            f"""
            INSERT OR REPLACE INTO {self.image_list_sheet}
            (workspace_id, image_id, image_prompt, image_src)
            VALUES (?, ?, ?, ?)
            """,
            (workspace_id, image_id, image_prompt, image_src),
        )
        await self.conn.commit()

    @require_connection
    async def delete_image(self, image_id: str) -> None:
        await self.conn.execute(f"DELETE FROM {self.image_list_sheet} WHERE image_id = ?", (image_id,))
        await self.conn.commit()

    @require_connection
    async def get_image_list_by_workspace(self, workspace_id: str) -> List[Dict[str, Union[str, int]]]:
        cursor = await self.conn.execute(
            f"SELECT image_id, image_prompt FROM {self.image_list_sheet} WHERE workspace_id = ?",
            (workspace_id,),
        )
        rows = await cursor.fetchall()
        return [{"id": row[0], "prompt": row[1], "src": f"/_api/image/get/{row[0]}"} for row in rows]

    @require_connection
    async def get_image_by_id(self, image_id: str) -> Optional[bytes]:
        cursor = await self.conn.execute(
            f"SELECT image_src FROM {self.image_list_sheet} WHERE image_id = ?",
            (image_id,),
        )
        row = await cursor.fetchone()
        return row[0] if row else None


IMAGE_DATABASE = ImageStore()
