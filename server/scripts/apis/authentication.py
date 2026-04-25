"""Legacy auth helper kept only for compatibility."""

from fastapi import Depends
from fastapi.requests import Request
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from app.core import CONF, LOGGER

security = HTTPBasic()


async def authenticate_username(request: Request, credentials: HTTPBasicCredentials = Depends(security)):
    """Return the single workspace id for legacy code paths."""
    LOGGER.info(f"Legacy auth compatibility hit for path: {request.url.path}")
    return CONF.workspace_id
