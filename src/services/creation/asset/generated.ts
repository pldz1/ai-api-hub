import { imageRepository, videoRepository } from "@/persistence";
import type { ImageDataItem, VideoDataItem } from "@/types";

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

export async function getGeneratedAssets(): Promise<GeneratedAssetItem[]> {
  const [imageItems, videoItems] = await Promise.all([imageRepository.listAssets(), videoRepository.listAssets()]);
  return [...imageItems.map(normalizeImageAsset).reverse(), ...videoItems.map(normalizeVideoAsset).reverse()];
}

export async function deleteGeneratedAsset(item: Pick<GeneratedAssetItem, "id" | "kind">): Promise<void> {
  if (item.kind === "image") await imageRepository.deleteAsset(item.id);
  else await videoRepository.deleteAsset(item.id);
}
