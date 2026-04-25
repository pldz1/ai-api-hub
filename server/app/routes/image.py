"""Image routes."""

from __future__ import annotations

from io import BytesIO

import fastapi
from fastapi.responses import StreamingResponse

from app.core import CONF
from app.schemas import T_Delete_Image_Request, T_Get_Base_A_Request, T_Get_Image_Base_A_Response, T_Push_Image_Request, T_Set_Base_A_Response
from app.storage import IMAGE_DATABASE

IMAGE_ROUTE = fastapi.APIRouter()


@IMAGE_ROUTE.post("/_api/image/getImageList")
async def get_image_list_api(req: T_Get_Base_A_Request):
    """Return cached images for the current workspace."""
    response = T_Get_Image_Base_A_Response()
    try:
        response.data = await IMAGE_DATABASE.get_image_list_by_workspace(CONF.workspace_id)
        response.flag = True
        response.log = "Successfully."
    except Exception as error:
        response.log = f"Error: {error}"
    return response


@IMAGE_ROUTE.post("/_api/image/pushImage")
async def push_image_api(req: T_Push_Image_Request):
    """Cache a generated image inside SQLite."""
    response = T_Set_Base_A_Response()
    try:
        blob = await IMAGE_DATABASE.fetch_image_blob(req.image_url)
        await IMAGE_DATABASE.push_image(
            workspace_id=CONF.workspace_id,
            image_id=req.image_id,
            image_prompt=req.image_prompt,
            image_src=blob,
        )
        response.flag = True
        response.log = "Successfully."
    except Exception as error:
        response.log = f"Upload Failed: {error}"
    return response


@IMAGE_ROUTE.post("/_api/image/deleteImage")
async def delete_image_api(req: T_Delete_Image_Request):
    """Delete a cached image."""
    response = T_Set_Base_A_Response()
    try:
        await IMAGE_DATABASE.delete_image(req.image_id)
        response.flag = True
        response.log = "Successfully."
    except Exception as error:
        response.log = f"Delete Failed: {error}"
    return response


@IMAGE_ROUTE.get("/_api/image/get/{image_id}")
async def get_image_api(image_id: str):
    """Stream a cached image for `<img src>` usage."""
    blob = await IMAGE_DATABASE.get_image_by_id(image_id)
    if not blob:
        return fastapi.responses.JSONResponse(status_code=404, content={"error": "Image not found"})
    return StreamingResponse(BytesIO(blob), media_type="image/*")
