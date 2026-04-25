"""Chat routes."""

from __future__ import annotations

import fastapi

from app.core import CONF
from app.schemas import (
    T_Chat_Add_Message_Request,
    T_Chat_Base_A_Request,
    T_Chat_Base_B_Request,
    T_Chat_Base_C_Request,
    T_Chat_Delete_Message_Request,
    T_Get_Base_A_Request,
    T_Get_Base_A_Response,
    T_Get_Chat_Base_A_Response,
    T_Set_Base_A_Response,
)
from app.storage import CHAT_DATABASE

CHAT_ROUTE = fastapi.APIRouter()


@CHAT_ROUTE.post("/_api/chat/getChatList")
async def get_chat_list(req: T_Get_Base_A_Request):
    """Return the workspace chat list."""
    response = T_Get_Chat_Base_A_Response()
    response.data = await CHAT_DATABASE.get_cids_and_cnames_by_username(CONF.workspace_id)
    response.flag = True
    response.log = "Successfully."
    return response


@CHAT_ROUTE.post("/_api/chat/addChat")
async def add_chat(req: T_Chat_Base_A_Request):
    """Create a new chat sheet."""
    response = T_Set_Base_A_Response()
    await CHAT_DATABASE.create_chat_sheet(CONF.workspace_id, req.cid, req.cname)
    response.flag = True
    response.log = "Successfully."
    return response


@CHAT_ROUTE.post("/_api/chat/deleteChat")
async def delete_chat(req: T_Chat_Base_B_Request):
    """Delete a chat and its messages."""
    response = T_Set_Base_A_Response()
    await CHAT_DATABASE.delete_chat_sheet(CONF.workspace_id, req.cid)
    response.flag = True
    response.log = "Successfully."
    return response


@CHAT_ROUTE.post("/_api/chat/renameChat")
async def rename_chat(req: T_Chat_Base_A_Request):
    """Rename a workspace chat."""
    response = T_Set_Base_A_Response()
    await CHAT_DATABASE.update_cname_by_username_and_cid(CONF.workspace_id, req.cid, req.cname)
    response.flag = True
    response.log = "Successfully."
    return response


@CHAT_ROUTE.post("/_api/chat/getAllMessage")
async def get_all_message(req: T_Chat_Base_B_Request):
    """Return all messages for a chat."""
    response = T_Get_Chat_Base_A_Response()
    response.data = await CHAT_DATABASE.get_all_messages_by_username_cid(CONF.workspace_id, req.cid)
    response.flag = True
    response.log = "Successfully."
    return response


@CHAT_ROUTE.post("/_api/chat/addMessage")
async def add_message(req: T_Chat_Add_Message_Request):
    """Insert a single chat message."""
    response = T_Set_Base_A_Response()
    await CHAT_DATABASE.insert_message(CONF.workspace_id, req.cid, req.mid, req.message)
    response.flag = True
    response.log = "Successfully."
    return response


@CHAT_ROUTE.post("/_api/chat/deleteMessage")
async def delete_message(req: T_Chat_Delete_Message_Request):
    """Delete a single chat message."""
    response = T_Set_Base_A_Response()
    await CHAT_DATABASE.delete_message(CONF.workspace_id, req.cid, req.mid)
    response.flag = True
    response.log = "Successfully."
    return response


@CHAT_ROUTE.post("/_api/chat/getChatSettings")
async def get_chat_settings(req: T_Chat_Base_B_Request):
    """Return serialized chat settings."""
    response = T_Get_Base_A_Response()
    response.data = await CHAT_DATABASE.get_chat_settings_by_username_cid(CONF.workspace_id, req.cid)
    response.flag = True
    response.log = "Successfully."
    return response


@CHAT_ROUTE.post("/_api/chat/setChatSettings")
async def set_chat_settings(req: T_Chat_Base_C_Request):
    """Persist serialized chat settings."""
    response = T_Set_Base_A_Response()
    await CHAT_DATABASE.set_chat_settings_by_username_cid(CONF.workspace_id, req.cid, req.data)
    response.flag = True
    response.log = "Successfully."
    return response
