"""Schemas for workspace-level user routes."""

from pydantic import BaseModel


class T_Login_Request(BaseModel):
    """Compatibility request for workspace bootstrap."""

    username: str = ""
    password: str = ""


class T_Login_Response(BaseModel):
    """Compatibility response for workspace bootstrap."""

    flag: bool = False
    uid: str = ""
    log: str = "Login failed."
    role: str = "administrator"


class T_Get_Base_A_Request(BaseModel):
    """Compatibility get request body."""

    username: str = ""


class T_Get_Base_A_Response(BaseModel):
    """Generic get response body."""

    flag: bool = False
    data: str = ""
    log: str = "The server does not expect a valid value to be returned"


class T_Set_Base_A_Request(BaseModel):
    """Generic set request body."""

    username: str = ""
    data: str = ""


class T_Set_Base_A_Response(BaseModel):
    """Generic set response body."""

    flag: bool = False
    log: str = "The server does not expect a valid value to be returned."
