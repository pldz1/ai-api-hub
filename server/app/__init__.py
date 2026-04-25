"""Modern server package entrypoint with lazy server imports."""

from __future__ import annotations


def run_dev():
    from .server import run_dev as _run_dev

    return _run_dev()


def run_main():
    from .server import run_main as _run_main

    return _run_main()


def __getattr__(name: str):
    if name == "app":
        from .server import app as fastapi_app

        return fastapi_app
    raise AttributeError(name)


__all__ = ["app", "run_dev", "run_main"]
