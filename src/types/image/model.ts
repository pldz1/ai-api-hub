import type { ImageInputFile, ImageModelProvider, ImageOperation, ModelParamDef, SelectOption } from "@/services/image/types";
import type { ImageProviderPayload } from "./provider";

export interface ImageModelResolvedFields {
  imageParamDefs: ModelParamDef[];
}

export type ImageModelConfig = ImageProviderPayload;
export type ResolvedImageModelConfig = ImageModelConfig & ImageModelResolvedFields;

/**
 * Image-model editor state used by the settings form.
 *
 * This state is image-only and avoids mixing chat-specific capability fields
 * into image model editing.
 */
export interface ImageModelEditorState {
  name: string;
  provider: ImageModelProvider | "";
  baseURL: string;
  endpoint: string;
  apiKey: string;
  model: string;
  deployment: string;
  apiVersion: string;
  imageOperation: ImageOperation;
}

export interface ImageModelSettings {
  model: ImageModelConfig | null;
  prompt: string;
  size: string;
  quality: string;
  image: ImageInputFile | null;
  mask: ImageInputFile | null;
  n: number;
  [key: string]: unknown;
}

export interface ImageModelOption extends SelectOption {}
