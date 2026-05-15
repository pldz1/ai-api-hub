import type { ImageModelProvider, ImageOperation, ImageParamValue, ModelConfigBase, ModelParamDef, SelectOption } from "./model-shared";

export interface BaseImageModelDraft extends ModelConfigBase {
  provider: ImageModelProvider;
  imageOperation: ImageOperation;
}

export interface OpenAIImageModelDraft extends BaseImageModelDraft {
  provider: "OpenAI";
  baseURL: string;
}

export interface AzureOpenAIImageModelDraft extends BaseImageModelDraft {
  provider: "Azure OpenAI";
  endpoint: string;
  deployment: string;
  apiVersion: string;
}

export type ImageModelDraft = OpenAIImageModelDraft | AzureOpenAIImageModelDraft;

export interface ImageModelResolvedFields {
  imageParamDefs: ModelParamDef[];
}

export type ImageModelConfig = ImageModelDraft;
export type ResolvedImageModelConfig = ImageModelConfig & ImageModelResolvedFields;

export interface ImageModelSettings {
  model: ImageModelConfig | null;
  prompt: string;
  size: string;
  quality: string;
  image: ImageParamValue | null;
  mask: ImageParamValue | null;
  n: number;
  [key: string]: unknown;
}

export interface ImageModelOption extends SelectOption {}
