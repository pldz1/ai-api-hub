import { ImageProviderConnectionField, ImageProviderDefinition, ImageProviderKey, imageProviderKeys, imageProviderRegistry } from "../types";
import type { ImageAdapterId, ImageGenerationParams, ImageGenerationResult, ImageModelConfig, ImageModelProvider } from "../types";
import { resolveImageModel } from "../models";

import { AzureOpenAIImageClient } from "./azure-openai";
import { DashScopeImageClient } from "./dashscope";
import { OpenAIImageClient } from "./openai";

// -- runtime config --------------------------------------------------------

type ImageProviderRuntimeConfig = Pick<ImageModelConfig, "provider" | "baseURL" | "apiKey" | "model"> & {
  adapterId: ImageAdapterId;
};

// -- executor interface ----------------------------------------------------

export interface ImageExecutor {
  generate(params: ImageGenerationParams): Promise<ImageGenerationResult>;
}

// -- registry accessors ----------------------------------------------------

export function isImageModelProvider(value: unknown): value is ImageProviderKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(imageProviderRegistry, value);
}

export function getImageProviderDefinition(provider: unknown): ImageProviderDefinition | null {
  return isImageModelProvider(provider) ? imageProviderRegistry[provider] : null;
}

export function getImageProviderConnectionFields(provider: unknown): readonly ImageProviderConnectionField[] {
  return getImageProviderDefinition(provider)?.connectionFields || imageProviderRegistry.OpenAI.connectionFields;
}

export function imageProviderUsesField(provider: unknown, field: ImageProviderConnectionField): boolean {
  return getImageProviderConnectionFields(provider).includes(field);
}

export function getImageProviderDefaultBaseURL(provider: unknown): string {
  return getImageProviderDefinition(provider)?.defaultBaseURL || "";
}

export function getKnownImageProviderDefaultBaseURLs(): string[] {
  return imageProviderKeys.map((provider) => imageProviderRegistry[provider].defaultBaseURL || "").filter(Boolean);
}

// -- config & executor factories -------------------------------------------

/**
 * Converts user-owned image model config into runtime-only provider constructor args.
 *
 * This is the exact boundary where persisted/user-facing configuration stops and
 * request execution configuration begins.
 */
export function createImageProviderConfig(
  model: ImageModelConfig | { provider?: ImageModelProvider; baseURL?: string; apiKey?: string; model?: string },
): ImageProviderRuntimeConfig | null {
  const provider = model.provider || "OpenAI";
  const providerDefinition = getImageProviderDefinition(provider);
  if (!providerDefinition) return null;

  const resolved = resolveImageModel({
    name: "name" in model ? model.name || "" : "",
    provider: provider as ImageModelProvider,
    baseURL: model.baseURL || "",
    apiKey: model.apiKey || "",
    model: model.model || "",
  });
  if (!resolved) return null;

  return {
    adapterId: resolved.binding.adapterId,
    provider: resolved.config.provider,
    baseURL: resolved.config.baseURL,
    apiKey: resolved.config.apiKey,
    model: resolved.config.model,
  };
}

/**
 * Instantiates the provider executor for already-derived runtime config.
 *
 * Callers should pass only `ImageProviderRuntimeConfig` here, never raw settings
 * payloads from storage/UI.
 */
export function createImageExecutor(config: ImageProviderRuntimeConfig): ImageExecutor {
  const factories: Record<ImageAdapterId, () => ImageExecutor> = {
    "openai-images": () => new OpenAIImageClient(config.baseURL, config.apiKey, config.model),
    "azure-openai-images": () => new AzureOpenAIImageClient(config.baseURL, config.apiKey, config.model),
    "dashscope-multimodal": () => new DashScopeImageClient(config.baseURL, config.apiKey, config.model),
  };
  return factories[config.adapterId]();
}
