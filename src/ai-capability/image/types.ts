import type { TokenUsage } from "../common";

// ============================================================================
// Provider runtime config (derived from user-owned model config)
// ============================================================================

export type ImageAdapterId = "openai-images" | "azure-openai-images" | "dashscope-multimodal";
export type ImageProviderConnectionField = "baseURL";

export interface ImageProviderDefinition {
  name: string;
  adapterId: ImageAdapterId;
  connectionFields: readonly ImageProviderConnectionField[];
  defaultBaseURL?: string;
}

const imageProviderRegistryConfig = {
  OpenAI: {
    name: "OpenAI",
    adapterId: "openai-images",
    connectionFields: ["baseURL"],
    defaultBaseURL: "https://api.openai.com/v1",
  },
  "Azure OpenAI": {
    name: "Azure OpenAI",
    adapterId: "azure-openai-images",
    connectionFields: ["baseURL"],
    defaultBaseURL: "https://<YOUR-DEPLOYMENT-NAME>.openai.com/v1",
  },
  DashScope: {
    name: "DashScope",
    adapterId: "dashscope-multimodal",
    connectionFields: ["baseURL"],
    defaultBaseURL: "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
  },
} as const satisfies Record<string, ImageProviderDefinition>;

export type ImageProviderKey = keyof typeof imageProviderRegistryConfig;

export const imageProviderRegistry: Record<ImageProviderKey, ImageProviderDefinition> = imageProviderRegistryConfig;

export const imageProviderKeys = Object.keys(imageProviderRegistry) as ImageProviderKey[];

// ============================================================================
// Core identity
// ============================================================================

export type ImageModelProvider = ImageProviderKey;

export interface ImageModelCapabilities {
  imageInput: boolean;
  maskInput: boolean;
}

// ============================================================================
// User-owned model config consumed by image services
// ============================================================================

export interface ImageModelConfig {
  name: string;
  provider: ImageModelProvider;
  baseURL: string;
  apiKey: string;
  model: string;
}

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
  attachments?: ImageInputFile[];
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
