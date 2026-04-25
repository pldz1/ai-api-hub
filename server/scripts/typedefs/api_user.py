"""Compatibility wrapper for user schemas."""

from app.schemas.user import (
    T_Get_Base_A_Request,
    T_Get_Base_A_Response,
    T_Login_Request,
    T_Login_Response,
    T_Set_Base_A_Request,
    T_Set_Base_A_Response,
)

__all__ = [
    "T_Login_Request",
    "T_Login_Response",
    "T_Get_Base_A_Request",
    "T_Get_Base_A_Response",
    "T_Set_Base_A_Request",
    "T_Set_Base_A_Response",
]
