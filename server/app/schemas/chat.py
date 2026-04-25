"""Schemas for chat routes."""

from pydantic import BaseModel


class T_Get_Chat_Base_A_Response(BaseModel):
    """Chat list and message list response body."""

    flag: bool = False
    data: list = []
    log: str = "The server does not expect a valid value to be returned"


class T_Chat_Base_A_Request(BaseModel):
    """Request with chat id and name."""

    username: str = ""
    cid: str = ""
    cname: str = ""


class T_Chat_Base_B_Request(BaseModel):
    """Request with chat id only."""

    username: str = ""
    cid: str = ""


class T_Chat_Base_C_Request(BaseModel):
    """Request with chat id plus serialized settings."""

    username: str = ""
    cid: str = ""
    data: str = ""


class T_Chat_Add_Message_Request(BaseModel):
    """Request used to append a message."""

    username: str = ""
    cid: str = ""
    mid: str = ""
    message: str = ""


class T_Chat_Delete_Message_Request(BaseModel):
    """Request used to delete a message."""

    username: str = ""
    cid: str = ""
    mid: str = ""
