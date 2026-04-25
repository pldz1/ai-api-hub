"""Minimal logging wrapper used across the companion service."""

from __future__ import annotations

import logging


class Log:
    """Singleton logger wrapper."""

    _instance: "Log | None" = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, console_level: int = logging.INFO) -> None:
        if self._initialized:
            return

        self._initialized = True
        self.logger = logging.getLogger("AI_API_HUB_SERVER")
        self.logger.setLevel(logging.DEBUG)
        self.logger.propagate = False

        if not self.logger.handlers:
            handler = logging.StreamHandler()
            handler.setLevel(console_level)
            handler.setFormatter(logging.Formatter("[ %(levelname)s ] AI_API_HUB_SERVER: %(message)s"))
            self.logger.addHandler(handler)

    def debug(self, message: str) -> None:
        self.logger.debug(message)

    def info(self, message: str) -> None:
        self.logger.info(message)

    def warning(self, message: str) -> None:
        self.logger.warning(message)

    def error(self, message: str) -> None:
        self.logger.error(message)

    def critical(self, message: str) -> None:
        self.logger.critical(message)
