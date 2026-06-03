import type { ImageModelCapabilities, ImageModelProvider, ImageModelParamDef } from "./types";

export const imageParamList: Partial<ImageModelParamDef>[] = [
  {
    key: "quality",
    label: "quality",
    type: "string",
    defaultValue: "auto",
    placeholder: "auto",
  },
  {
    key: "output_format",
    label: "output_format",
    type: "string",
    defaultValue: "png",
    placeholder: "png",
  },
  {
    key: "background",
    label: "background",
    type: "string",
    defaultValue: "",
    placeholder: "auto",
  },
  {
    key: "moderation",
    label: "moderation",
    type: "string",
    defaultValue: "",
    placeholder: "auto",
  },
  {
    key: "negative_prompt",
    label: "negative_prompt",
    type: "string",
    defaultValue: "",
    placeholder: "",
  },
  {
    key: "watermark",
    label: "watermark",
    type: "boolean",
    defaultValue: false,
  },
  {
    key: "image",
    label: "image",
    type: "image",
    defaultValue: null,
    placeholder: "image/png",
  },
  {
    key: "mask",
    label: "mask",
    type: "image",
    defaultValue: null,
    placeholder: "image/png",
  },
];

export type ImageModelCatalogItem = {
  name: string;
  imageParamKeys: string[];
  sizeList: string[];
  providers: {
    provider: ImageModelProvider;
    capabilities: ImageModelCapabilities;
  }[];
};

export const imageModelCatalog: ImageModelCatalogItem[] = [
  {
    name: "gpt-image-2",
    imageParamKeys: ["quality", "output_format", "background", "moderation", "image", "mask"],
    sizeList: ["1024x1024", "1536x1024", "1024x1536", "2048x2048", "2048x1152", "3840x2160", "2160x3840", "auto"],
    providers: [
      {
        provider: "OpenAI",
        capabilities: { imageInput: true, maskInput: true },
      },
      {
        provider: "Azure OpenAI",
        capabilities: { imageInput: true, maskInput: true },
      },
    ],
  },
  {
    name: "qwen-image-2.0-pro-2026-04-22",
    imageParamKeys: ["negative_prompt", "watermark", "image"],
    sizeList: ["1024x1024", "1536x1024", "1024x1536", "2048x2048", "2048x1152", "3840x2160", "2160x3840"],
    providers: [
      {
        provider: "DashScope",
        capabilities: { imageInput: true, maskInput: false },
      },
    ],
  },
];

export const imageModelTypeList: ImageModelCatalogItem[] = imageModelCatalog;

export function findImageModelCatalogItems(model = ""): ImageModelCatalogItem[] {
  const targetModel = model.trim().toLowerCase();
  if (!targetModel) return [];
  return imageModelCatalog.filter((item) => item.name.toLowerCase() === targetModel);
}

export function findImageModelCatalogItem(model = "", provider?: ImageModelProvider | null): ImageModelCatalogItem | null {
  const catalogItems = findImageModelCatalogItems(model);
  if (!catalogItems.length) return null;
  if (!provider) return catalogItems[0] || null;
  return catalogItems.find((item) => item.providers.some((itemProvider) => itemProvider.provider === provider)) || catalogItems[0] || null;
}

export function findImageModelCatalogProvider(model = "", provider?: ImageModelProvider | null): ImageModelCatalogItem["providers"][number] | null {
  const catalogItem = findImageModelCatalogItem(model, provider);
  if (!catalogItem) return null;
  if (!provider) return catalogItem.providers[0] || null;
  return catalogItem.providers.find((itemProvider) => itemProvider.provider === provider) || catalogItem.providers[0] || null;
}

export const defaultImageModelCapabilities: ImageModelCapabilities = {
  imageInput: false,
  maskInput: false,
};

export const imageDisplayedCapabilityKeys: (keyof ImageModelCapabilities)[] = ["imageInput", "maskInput"];
