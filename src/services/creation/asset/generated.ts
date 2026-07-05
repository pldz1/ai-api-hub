import { deleteImageAPI, getImageListAPI } from "../image/api";
import { deleteVideoAPI, getVideoListAPI } from "../video/api";
import type { ApiResponse, ImageDataItem, VideoDataItem } from "@/types";

export type GeneratedAssetKind = "image" | "video";

export interface GeneratedAssetItem {
  id: string;
  kind: GeneratedAssetKind;
  prompt: string;
  src: string;
}

function normalizeImageAsset(item: ImageDataItem): GeneratedAssetItem {
  return {
    id: item.id,
    kind: "image",
    prompt: item.prompt,
    src: item.src,
  };
}

function normalizeVideoAsset(item: VideoDataItem): GeneratedAssetItem {
  return {
    id: item.id,
    kind: "video",
    prompt: item.prompt,
    src: item.src,
  };
}

export async function getGeneratedAssets(): Promise<ApiResponse<GeneratedAssetItem[]>> {
  const [imageResponse, videoResponse] = await Promise.all([getImageListAPI(), getVideoListAPI()]);

  if (!imageResponse.flag) return { flag: false, log: imageResponse.log, data: [] };
  if (!videoResponse.flag) return { flag: false, log: videoResponse.log, data: [] };

  const images = Array.isArray(imageResponse.data) ? imageResponse.data.map(normalizeImageAsset) : [];
  const videos = Array.isArray(videoResponse.data) ? videoResponse.data.map(normalizeVideoAsset) : [];

  return {
    flag: true,
    log: "Successfully.",
    data: [...images.reverse(), ...videos.reverse()],
  };
}

export async function deleteGeneratedAsset(item: Pick<GeneratedAssetItem, "id" | "kind">): Promise<ApiResponse<null>> {
  return item.kind === "image" ? deleteImageAPI(item.id) : deleteVideoAPI(item.id);
}
