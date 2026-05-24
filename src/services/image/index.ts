import store from "@/store";
import { apiRequest } from "@/services/storage";
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

const getImageListAPI = (): Promise<ApiResponse<ImageDataItem[]>> => apiRequest("post", "/_api/image/getImageList", {});

const pushImageAPI = (id: string, prompt: string, url: string): Promise<ApiResponse<ImageDataItem>> =>
  apiRequest("post", "/_api/image/pushImage", {
    image_id: id,
    image_prompt: prompt,
    image_url: url,
  });

const deleteImageAPI = (id: string): Promise<ApiResponse<null>> =>
  apiRequest("post", "/_api/image/deleteImage", {
    image_id: id,
  });

export async function generateImage(model: ImageProviderModel, params: ImageGenerationParams): Promise<ImageGenerationResult> {
  return generateImageByProvider(model, params);
}

export async function getImageList(): Promise<boolean> {
  const res = await getImageListAPI();
  if (!res.flag) {
    await store.dispatch("resetImageList", []);
    dsAlert({ type: "error", message: tr("toast.imageListFetchFailed", { error: res.log }) });
    return false;
  }

  if (!Array.isArray(res.data)) {
    await store.dispatch("resetImageList", []);
    dsAlert({
      type: "error",
      message: tr("toast.imageListInvalid"),
    });
    return false;
  }

  const reversed = res.data.slice().reverse();
  await store.dispatch("resetImageList", reversed);
  return true;
}

export async function pushImage(prompt: string, url: string): Promise<boolean> {
  const id = getUuid("img");
  const res = await pushImageAPI(id, prompt, url);
  if (!res.flag) {
    dsAlert({
      type: "error",
      message: tr("toast.imagePushFailed", { error: res.log }),
    });
    return false;
  }

  await store.dispatch("pushImage", res.data?.id ? res.data : { id, prompt, src: url });

  return true;
}

export async function deleteImage(id: string): Promise<boolean> {
  const res = await deleteImageAPI(id);
  if (!res.flag) {
    dsAlert({
      type: "error",
      message: tr("toast.imageDeleteFailed", { error: res.log }),
    });
    return false;
  }

  await store.dispatch("deleteImage", id);
  return true;
}
