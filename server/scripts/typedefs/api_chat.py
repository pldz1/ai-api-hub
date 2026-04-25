"""Compatibility wrapper for chat schemas."""

from app.schemas.chat import (
    T_Chat_Add_Message_Request,
    T_Chat_Base_A_Request,
    T_Chat_Base_B_Request,
    T_Chat_Base_C_Request,
    T_Chat_Delete_Message_Request,
    T_Get_Chat_Base_A_Response,
)

__all__ = [
    "T_Get_Chat_Base_A_Response",
    "T_Chat_Base_A_Request",
    "T_Chat_Base_B_Request",
    "T_Chat_Base_C_Request",
    "T_Chat_Add_Message_Request",
    "T_Chat_Delete_Message_Request",
]
