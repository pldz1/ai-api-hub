import type { TokenUsage } from "../common";

// ============================================================================
// Provider identity
// ============================================================================

export type ImageModelProvider = "OpenAI";

// ============================================================================
// User-owned model config consumed by image services
// ============================================================================

export interface ImageModelConfigBase {
  name: string;
  apiKey: string;
  model: string;
}

export interface OpenAIImageModelConfig extends ImageModelConfigBase {
  provider: "OpenAI";
  baseURL: string;
}

export type ImageModelConfig = OpenAIImageModelConfig;

// ============================================================================
// Image file input
// ============================================================================

export interface ImageInputFile {
  filename: string;
  content_type: string;
  data: string;
}

// ============================================================================
// Parameter values (for API calls)
// ============================================================================

export type ImageParamPrimitive = string | number | boolean | null | undefined;
export type ImageParamValue = ImageParamPrimitive | Record<string, unknown> | unknown[];

// ============================================================================
// API request / response
// ============================================================================

export interface ImageGenerationParams {
  prompt: string;
  size?: string;
  n?: number;
  quality?: string;
  outputFormat?: string;
  [key: string]: ImageParamValue;
}

export interface ImageGenerationItem {
  type: "url" | "text";
  data: string;
}

export interface ImageGenerationResult {
  images: ImageGenerationItem[];
  usage: TokenUsage;
  raw?: unknown;
}

export interface ImageRequest {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | FormData;
  isFormData: boolean;
}

// ============================================================================
// Model reference (loose reference used by service providers)
// ============================================================================

export interface ImageProviderModel {
  provider?: ImageModelProvider;
  name?: string;
  apiKey?: string;
  model?: string;
  baseURL?: string;
}

export type ImageModelParamType = "number" | "string" | "array" | "boolean" | "object" | "image";
export type ImageParamDefaultValue = string | number | boolean | unknown[] | Record<string, unknown> | null;

export interface ImageModelParamDef {
  key: string;
  label: string;
  type: ImageModelParamType;
  description: string;
  descriptionKey: string;
  placeholder: string;
  defaultValue: ImageParamDefaultValue;
  min: number;
  max: number;
  step: number;
}
