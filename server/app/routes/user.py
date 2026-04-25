"""Workspace settings routes."""

from __future__ import annotations

import fastapi

from app.core import CONF
from app.schemas import (
    T_Get_Base_A_Request,
    T_Get_Base_A_Response,
    T_Login_Request,
    T_Login_Response,
    T_Set_Base_A_Request,
    T_Set_Base_A_Response,
)
from app.storage import USER_DATABASE

USER_ROUTE = fastapi.APIRouter()


@USER_ROUTE.post("/_api/login")
async def login(data: T_Login_Request):
    """Compatibility bootstrap route for the single workspace."""
    response = T_Login_Response()
    response.flag = True
    response.log = "Workspace ready."
    return response


@USER_ROUTE.post("/_api/user/getModels")
async def get_user_models(req: T_Get_Base_A_Request):
    """Return serialized workspace models."""
    response = T_Get_Base_A_Response()
    response.data = await USER_DATABASE.get_models(CONF.workspace_id)
    response.flag = True
    response.log = "Successfully."
    return response


@USER_ROUTE.post("/_api/user/setModels")
async def set_user_models(req: T_Set_Base_A_Request):
    """Persist serialized workspace models."""
    response = T_Set_Base_A_Response()
    response.flag = await USER_DATABASE.set_models(CONF.workspace_id, req.data)
    response.log = "Successfully." if response.flag else "The database setting user dialogue model operation failed."
    return response


@USER_ROUTE.post("/_api/user/getChatInsTemplateList")
async def get_user_chat_ins_template_list(req: T_Get_Base_A_Request):
    """Return serialized workspace prompt templates."""
    response = T_Get_Base_A_Response()
    response.data = await USER_DATABASE.get_chat_ins_template_list(CONF.workspace_id)
    response.flag = True
    response.log = "Successfully."
    return response


@USER_ROUTE.post("/_api/user/setChatInsTemplateList")
async def set_user_chat_ins_template_list(req: T_Set_Base_A_Request):
    """Persist serialized workspace prompt templates."""
    response = T_Set_Base_A_Response()
    response.flag = await USER_DATABASE.set_chat_ins_template_list(CONF.workspace_id, req.data)
    response.log = "Successfully." if response.flag else "The database setting user dialogue model operation failed."
    return response
