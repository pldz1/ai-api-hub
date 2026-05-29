import type { ImageModelProvider, ImageModelEditorState, ImageModelParamDef } from "@/types";

export const imageParamPresetList: Partial<ImageModelParamDef>[] = [
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

export const imageModelTypeList = ["gpt-image-2"];

export const imageModelProviderList: ImageModelProvider[] = ["OpenAI", "Azure OpenAI"];

export const imageModelSize = [
  "1024x1024",
  "1536x1024",
  "1024x1536",
  "2048x2048",
  "2048x1152",
  "3840x2160",
  "2160x3840",
  "auto ",
];

export const defaultImageModelEditorState: ImageModelEditorState = {
  name: "",
  provider: "",
  baseURL: "",
  endpoint: "",
  apiKey: "",
  model: "",
  deployment: "",
  apiVersion: "",
};
