import type { ImageModelProvider, ImageModelParamDef, ImageSelectOption } from "@/types";

type LooseParamDef = Partial<ImageModelParamDef> & { key?: string };

export const imageParamPresetList: LooseParamDef[] = [
  {
    key: "quality",
    label: "quality",
    type: "string",
    descriptionKey: "image.qualityTip",
    defaultValue: "auto",
    placeholder: "auto",
  },
  {
    key: "output_format",
    label: "output_format",
    type: "string",
    descriptionKey: "image.outputFormatTip",
    defaultValue: "png",
    placeholder: "png",
  },
  {
    key: "background",
    label: "background",
    type: "string",
    descriptionKey: "image.backgroundTip",
    defaultValue: "",
    placeholder: "auto",
  },
  {
    key: "moderation",
    label: "moderation",
    type: "string",
    descriptionKey: "image.moderationTip",
    defaultValue: "",
    placeholder: "auto",
  },
  {
    key: "image",
    label: "image",
    type: "image",
    descriptionKey: "image.inputImageTip",
    defaultValue: null,
    placeholder: "image/png",
  },
  {
    key: "mask",
    label: "mask",
    type: "image",
    descriptionKey: "image.maskTip",
    defaultValue: null,
    placeholder: "image/png",
  },
];

export const imageModelTypeList: ImageSelectOption[] = [
  { value: "gpt-image-1.5", name: "gpt-image-1.5" },
  { value: "gpt-image-1", name: "gpt-image-1" },
  { value: "gpt-image-1-mini", name: "gpt-image-1-mini" },
  { value: "chatgpt-image-latest", name: "chatgpt-image-latest" },
  { value: "dall-e-2", name: "dall-e-2" },
  { value: "dall-e-3", name: "dall-e-3" },
];

export const imageModelProviderList: ImageSelectOption<ImageModelProvider>[] = [
  { value: "OpenAI", name: "OpenAI" },
  { value: "Azure OpenAI", name: "Azure OpenAI" },
];

export const imageModelSize: ImageSelectOption[] = [
  { name: "1024x1024", value: "1024x1024" },
  { name: "1024x1792", value: "1024x1792" },
  { name: "1792x1024", value: "1792x1024" },
];
