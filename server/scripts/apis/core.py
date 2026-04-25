"""Compatibility wrapper for the modern app server module."""

from app.server import app, run_dev, run_main

__all__ = ["app", "run_dev", "run_main"]
