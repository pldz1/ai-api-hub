"""Compatibility wrapper for the image store."""

from app.storage.image_store import IMAGE_DATABASE, ImageStore as AIO_Image_Database

__all__ = ["AIO_Image_Database", "IMAGE_DATABASE"]
