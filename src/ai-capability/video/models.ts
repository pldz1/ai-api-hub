import type { VideoModelCapabilities, VideoModelProvider, VideoModelParamDef } from "./types";

export const videoParamList: Partial<VideoModelParamDef>[] = [
  { key: "resolution", label: "resolution", type: "string", defaultValue: "720P", placeholder: "720P" },
  { key: "duration", label: "duration", type: "number", defaultValue: 5, min: 5, max: 10, step: 5, placeholder: "5" },
  { key: "prompt_extend", label: "prompt_extend", type: "boolean", defaultValue: true, placeholder: "" },
  { key: "watermark", label: "watermark", type: "boolean", defaultValue: true, placeholder: "" },
  { key: "first_frame", label: "first_frame", type: "image", defaultValue: null, placeholder: "image/png" },
];

export type VideoModelCatalogItem = {
  name: string;
  videoParamKeys: string[];
  resolutionList: string[];
  providers: {
    provider: VideoModelProvider;
    capabilities: VideoModelCapabilities;
  }[];
};

export const videoModelCatalog: VideoModelCatalogItem[] = [
  {
    name: "wan2.7-i2v-2026-04-25",
    videoParamKeys: ["resolution", "duration", "prompt_extend", "watermark", "first_frame"],
    resolutionList: ["720P", "1080P"],
    providers: [
      {
        provider: "DashScope",
        capabilities: { imageInput: true, audioInput: true, videoInput: false },
      },
    ],
  },
  {
    name: "wan2.7-t2v",
    videoParamKeys: ["resolution", "duration", "prompt_extend", "watermark", "first_frame"],
    resolutionList: ["720P", "1080P"],
    providers: [
      {
        provider: "DashScope",
        capabilities: { imageInput: false, audioInput: false, videoInput: false },
      },
    ],
  },
  {
    name: "wan2.7-r2v",
    videoParamKeys: ["resolution", "duration", "prompt_extend", "watermark", "first_frame"],
    resolutionList: ["720P", "1080P"],
    providers: [
      {
        provider: "DashScope",
        capabilities: { imageInput: true, audioInput: true, videoInput: true },
      },
    ],
  },
  {
    name: "wan2.7-videoedit",
    videoParamKeys: ["resolution", "duration", "prompt_extend", "watermark", "first_frame"],
    resolutionList: ["720P", "1080P"],
    providers: [
      {
        provider: "DashScope",
        capabilities: { imageInput: true, audioInput: true, videoInput: true },
      },
    ],
  },
];

export const videoModelTypeList: VideoModelCatalogItem[] = videoModelCatalog;

export function findVideoModelCatalogItems(model: string = ""): VideoModelCatalogItem[] {
  const targetModel = model.trim().toLowerCase();
  if (!targetModel) return [];
  return videoModelCatalog.filter((item) => item.name.toLowerCase() === targetModel);
}

export function findVideoModelCatalogItem(model: string = "", provider?: VideoModelProvider | null): VideoModelCatalogItem | null {
  const catalogItems = findVideoModelCatalogItems(model);
  if (!catalogItems.length) return null;
  if (!provider) return catalogItems[0] || null;
  return catalogItems.find((item) => item.providers.some((p) => p.provider === provider)) || catalogItems[0] || null;
}

export function findVideoModelCatalogProvider(model: string = "", provider?: VideoModelProvider | null): VideoModelCatalogItem["providers"][number] | null {
  const catalogItem = findVideoModelCatalogItem(model, provider);
  if (!catalogItem) return null;
  if (!provider) return catalogItem.providers[0] || null;
  return catalogItem.providers.find((p) => p.provider === provider) || catalogItem.providers[0] || null;
}

export const defaultVideoModelCapabilities: VideoModelCapabilities = {
  imageInput: false,
  audioInput: false,
  videoInput: false,
};

export const videoDisplayedCapabilityKeys: (keyof VideoModelCapabilities)[] = ["imageInput", "audioInput"];
