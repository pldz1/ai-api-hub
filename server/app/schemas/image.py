"""Schemas for image routes."""

from pydantic import BaseModel


class T_Get_Image_Base_A_Response(BaseModel):
    """Image list response."""

    flag: bool = False
    data: list = []
    log: str = "The server does not expect a valid value to be returned"


class T_Delete_Image_Request(BaseModel):
    """Request used to delete an image."""

    username: str = ""
    image_id: str = ""


class T_Push_Image_Request(BaseModel):
    """Request used to cache an image."""

    username: str = ""
    image_id: str = ""
    image_prompt: str = ""
    image_url: str = ""
