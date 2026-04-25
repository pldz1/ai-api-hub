"""Project configuration and path helpers."""

from __future__ import annotations

import json
import os
from typing import Any


class ProjectConfig:
    """Singleton project configuration."""

    _instance: "ProjectConfig | None" = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return

        self._initialized = True
        self._config_file_name = "config.json"
        self._database_path = ".database"
        self._cache_path = ".cache"
        self._statics_path = "statics"
        self._bin_path = ".bin"

        self.host = "127.0.0.1"
        self.port = 20088
        self.workspace_id = "__workspace__"
        self.chat_models: dict[str, Any] = {}
        self.image_models: dict[str, Any] = {}

        self.update_config()
        self.ensure_runtime_directories()

    def _project_root(self) -> str:
        """Return the absolute path to the server directory."""
        return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    def get_abs_path(self, path: str | None = None, filename: str | None = None) -> str:
        """Resolve a path inside the server directory."""
        return os.path.normpath(os.path.join(self._project_root(), path or "", filename or ""))

    def update_config(self) -> None:
        """Load optional overrides from config.json."""
        config_path = self.get_abs_path(filename=self._config_file_name)
        if not os.path.exists(config_path):
            return

        try:
            with open(config_path, "r", encoding="utf-8") as file:
                config_data = json.load(file)
        except (OSError, json.JSONDecodeError):
            return

        if not isinstance(config_data, dict):
            return

        for key, value in config_data.items():
            setattr(self, key, value)

    def ensure_runtime_directories(self) -> None:
        """Create the runtime directories the server expects."""
        for relative_dir in (self._database_path, self._cache_path, self._statics_path, self._bin_path):
            os.makedirs(self.get_abs_path(relative_dir), exist_ok=True)

    def get_database_path(self, filename: str | None = None) -> str:
        """Return the absolute path to a SQLite database file."""
        return self.get_abs_path(self._database_path, filename)

    def get_statics_path(self) -> str:
        """Return the built frontend output directory."""
        return self.get_abs_path(self._statics_path)

    def get_cache_path(self) -> str:
        """Return the cache directory."""
        return self.get_abs_path(self._cache_path)
