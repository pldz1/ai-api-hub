import {
  ImageProviderConnectionField,
  ImageProviderDefinition,
  ImageProviderKey,
  imageProviderKeys,
  imageProviderRegistry,
} from "../types";
import type { ImageGenerationParams, ImageGenerationResult, ImageModelConfig, ImageModelProvider, ImageProviderRoute } from "../types";

import { AzureOpenAIImageClient } from "./azure-openai";
import { DashScopeImageClient } from "./dashscope";
import { OpenAIImageClient } from "./openai";

// -- runtime config --------------------------------------------------------

type ImageProviderRuntimeConfig = Pick<ImageModelConfig, "provider" | "baseURL" | "apiKey" | "model"> & {
  route: ImageProviderRoute;
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

  return {
    route: providerDefinition.route,
    provider: provider as ImageModelProvider,
    baseURL: model.baseURL || "",
    apiKey: model.apiKey || "",
    model: model.model || "",
  };
}

/**
 * Instantiates the provider executor for already-derived runtime config.
 *
 * Callers should pass only `ImageProviderRuntimeConfig` here, never raw settings
 * payloads from storage/UI.
 */
export function createImageExecutor(config: ImageProviderRuntimeConfig): ImageExecutor {
  if (config.route === "azure-openai") {
    return new AzureOpenAIImageClient(config.baseURL, config.apiKey, config.model);
  }

  if (config.route === "dashscope") {
    return new DashScopeImageClient(config.baseURL, config.apiKey, config.model);
  }

  return new OpenAIImageClient(config.baseURL, config.apiKey, config.model);
}
