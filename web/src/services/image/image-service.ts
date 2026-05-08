// @ts-nocheck
import store from "@/store";
import { apiRequest } from "../transport/request";
import { dsAlert, getUuid } from "@/utils";
import { tr } from "@/i18n";
import { generateImageByProvider } from "./providers";
import type { ApiResponse, ImageDataItem, ImageGenerationParams, ImageGenerationResult, ImageProviderModel } from "@/services/types";

/**
 * Image service.
 *
 * Owns image generation entrypoints and the persisted gallery list. Provider
 * request details live under `image/providers`.
 */

/**
 * Request the saved image list.
 */
export const getImageListAPI = (): Promise<ApiResponse<ImageDataItem[]>> => apiRequest("post", "/_api/image/getImageList", {});

/**
 * Save one image record.
 */
export const pushImageAPI = (id: string, prompt: string, url: string): Promise<ApiResponse<ImageDataItem>> =>
  apiRequest("post", "/_api/image/pushImage", {
    image_id: id,
    image_prompt: prompt,
    image_url: url,
  });

/**
 * Delete one image record.
 */
export const deleteImageAPI = (id: string): Promise<ApiResponse<null>> =>
  apiRequest("post", "/_api/image/deleteImage", {
    image_id: id,
  });

/**
 * Generate images through the selected provider.
 */
export async function generateImage(model: ImageProviderModel, params: ImageGenerationParams): Promise<ImageGenerationResult> {
  return generateImageByProvider(model, params);
}

/**
 * Load the saved image list into the store.
 */
export async function getImageList(): Promise<boolean | void> {
  const res = await getImageListAPI();
  if (!res.flag) {
    await store.dispatch("resetImageList", []);
    dsAlert({ type: "error", message: tr("toast.imageListFetchFailed", { error: res.log }) });
    return false;
  } else {
    if (Array.isArray(res.data)) {
      const reversed = res.data.slice().reverse();
      await store.dispatch("resetImageList", reversed);
    } else {
      await store.dispatch("resetImageList", []);
      dsAlert({
        type: "error",
        message: tr("toast.imageListInvalid"),
      });
    }
  }
}

/**
 * Add an image locally and persist it.
 */
export async function pushImage(prompt: string, url: string): Promise<boolean> {
  const id = getUuid("img");
  await store.dispatch("pushImage", { id: id, prompt: prompt, src: url });
  const res = await pushImageAPI(id, prompt, url);
  if (!res.flag) {
    dsAlert({
      type: "error",
      message: tr("toast.imagePushFailed", { error: res.log }),
    });
    return false;
  } else {
    if (res.data?.src) {
      const nextImageList = store.state.imageList.map((item) => {
        return item.id === id ? { ...item, src: res.data.src } : item;
      });
      await store.dispatch("resetImageList", nextImageList);
    }
    return true;
  }
}

/**
 * Delete an image locally and from storage.
 */
export async function deleteImage(id: string): Promise<boolean> {
  await store.dispatch("deleteImage", id);
  const res = await deleteImageAPI(id);
  if (!res.flag) {
    dsAlert({
      type: "error",
      message: tr("toast.imageDeleteFailed", { error: res.log }),
    });
    return false;
  }

  return true;
}
