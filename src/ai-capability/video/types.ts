import type { TokenUsage } from "../common";

// ============================================================================
// Provider runtime config (derived from user-owned model config)
// ============================================================================

export type VideoProviderRoute = "dashscope";
export type VideoProviderConnectionField = "baseURL";

export interface VideoProviderDefinition {
  name: string;
  route: VideoProviderRoute;
  connectionFields: readonly VideoProviderConnectionField[];
  defaultBaseURL?: string;
}

const videoProviderRegistryConfig = {
  DashScope: {
    name: "DashScope",
    route: "dashscope",
    connectionFields: ["baseURL"],
    defaultBaseURL: "https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis",
  },
} as const satisfies Record<string, VideoProviderDefinition>;

export type VideoProviderKey = keyof typeof videoProviderRegistryConfig;

export const videoProviderRegistry: Record<VideoProviderKey, VideoProviderDefinition> = videoProviderRegistryConfig;

export const videoProviderKeys = Object.keys(videoProviderRegistry) as VideoProviderKey[];

// ============================================================================
// Core identity
// ============================================================================

export type VideoModelProvider = VideoProviderKey;

export interface VideoModelCapabilities {
  imageInput: boolean;
  audioInput: boolean;
}

// ============================================================================
// User-owned model config consumed by video services
// ============================================================================

export interface VideoModelConfig {
  name: string;
  provider: VideoModelProvider;
  baseURL: string;
  apiKey: string;
  model: string;
}

// ============================================================================
// Media input for video generation
// ============================================================================

export interface VideoInputFile {
  filename: string;
  content_type: string;
  data: string;
  [key: string]: unknown;
}

// ============================================================================
// Parameter values (for API calls)
// ============================================================================

export type VideoParamPrimitive = string | number | boolean | null | undefined;
export type VideoParamValue = VideoParamPrimitive | Record<string, unknown> | unknown[];

// ============================================================================
// API request / response
// ============================================================================

export interface VideoGenerationParams {
  prompt: string;
  resolution?: string;
  duration?: number;
  promptExtend?: boolean;
  watermark?: boolean;
  media?: VideoInputFile[];
  [key: string]: VideoParamValue;
}

export interface VideoGenerationItem {
  type: "url" | "text";
  data: string;
}

export interface VideoGenerationResult {
  videos: VideoGenerationItem[];
  usage: TokenUsage;
  taskStatus?: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  raw?: unknown;
}

// ============================================================================
// Model reference (loose reference used by service providers)
// ============================================================================

export interface VideoProviderModel {
  provider?: VideoModelProvider;
  name?: string;
  apiKey?: string;
  model?: string;
  baseURL?: string;
}

export type VideoModelParamType = "number" | "string" | "array" | "boolean" | "object" | "image" | "audio";
export type VideoParamDefaultValue = string | number | boolean | unknown[] | Record<string, unknown> | null;

export interface VideoModelParamDef {
  key: string;
  label: string;
  type: VideoModelParamType;
  description: string;
  descriptionKey: string;
  placeholder: string;
  defaultValue: VideoParamDefaultValue;
  min: number;
  max: number;
  step: number;
}
