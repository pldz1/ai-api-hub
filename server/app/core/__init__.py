"""Shared runtime objects for the companion service."""

from .config import ProjectConfig
from .logging import Log

CONF = ProjectConfig()
LOGGER = Log()

__all__ = ["CONF", "LOGGER", "ProjectConfig", "Log"]
