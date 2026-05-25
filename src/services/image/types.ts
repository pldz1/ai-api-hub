/**
 * AI-capability types for image generation.
 *
 * These describe what image AI models are, how providers are identified,
 * and how the runtime communicates with image generation APIs. They do NOT
 * depend on app-level types such as settings payloads, editor state, or
 * storage shapes.
 */

import type { TokenUsage } from "@/services/chat/types";

// ============================================================================
// Shared primitives (re-exported for convenience)
// ============================================================================

export type {
  ModelParamDef,
  ModelParamType,
  ParamDefaultValue,
  SelectOption,
} from "@/services/chat/types";

// ============================================================================
// Provider identity
// ============================================================================

export type ImageModelProvider = "OpenAI" | "Azure OpenAI";
export type ImageOperation = "generation" | "edit";

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
  endpoint?: string;
  deployment?: string;
  apiVersion?: string;
  imageOperation?: ImageOperation;
}
