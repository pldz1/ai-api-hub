"""FastAPI application setup and run helpers."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core import CONF
from app.routes import CHAT_ROUTE, IMAGE_ROUTE, USER_ROUTE
from app.storage import CHAT_DATABASE, IMAGE_DATABASE, USER_DATABASE


@asynccontextmanager
async def lifespan(app=FastAPI):
    """Initialize and dispose database resources."""
    await USER_DATABASE.initialize()
    await CHAT_DATABASE.initialize()
    await IMAGE_DATABASE.initialize()
    yield
    await USER_DATABASE.destroy()
    await CHAT_DATABASE.destroy()
    await IMAGE_DATABASE.destroy()


app = FastAPI(lifespan=lifespan)
app.include_router(USER_ROUTE)
app.include_router(CHAT_ROUTE)
app.include_router(IMAGE_ROUTE)


def configure_dev_cors() -> None:
    """Allow local frontend origins in dev mode."""
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origin_regex=".*",
        allow_methods=["*"],
        allow_headers=["*"],
    )


def run_dev() -> None:
    """Run the companion in API-only dev mode."""
    import uvicorn

    configure_dev_cors()
    uvicorn.run(app, host=CONF.host, port=CONF.port)


def run_main() -> None:
    """Run the companion and serve built frontend assets."""
    import uvicorn

    statics_path = CONF.get_statics_path()
    if not os.path.exists(statics_path):
        raise FileNotFoundError(f"Failed to start the server with static files: no static resources found {statics_path}")

    from fastapi.staticfiles import StaticFiles

    app.mount("/", StaticFiles(directory=statics_path, html=True), name="static")
    uvicorn.run(app, host=CONF.host, port=CONF.port)
