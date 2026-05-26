import type { ImageModelProvider, ImageModelEditorState, ImageModelParamDef, ImageSelectOption } from "@/types";

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

export const imageModelTypeList: ImageSelectOption[] = [{ value: "gpt-image-2", name: "gpt-image-2" }];

export const imageModelProviderList: ImageSelectOption<ImageModelProvider>[] = [
  { value: "OpenAI", name: "OpenAI" },
  { value: "Azure OpenAI", name: "Azure OpenAI" },
];

export const imageModelSize: ImageSelectOption[] = [
  { name: "1024x1024", value: "1024x1024" },
  { name: "1536x1024", value: "1536x1024" },
  { name: "1024x1536", value: "1024x1536" },
  { name: "2048x2048", value: "2048x2048" },
  { name: "2048x1152", value: "2048x1152" },
  { name: "3840x2160", value: "3840x2160" },
  { name: "2160x3840", value: "2160x3840" },
  { name: "auto ", value: "auto " },
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
