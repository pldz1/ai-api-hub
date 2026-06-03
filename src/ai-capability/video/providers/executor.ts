import {
  VideoProviderConnectionField,
  VideoProviderDefinition,
  VideoProviderKey,
  videoProviderKeys,
  videoProviderRegistry,
} from "../types";
import type { VideoGenerationParams, VideoGenerationResult, VideoModelConfig, VideoModelProvider, VideoProviderRoute } from "../types";

import { DashScopeVideoClient } from "./dashscope";

// -- runtime config --------------------------------------------------------

type VideoProviderRuntimeConfig = Pick<VideoModelConfig, "provider" | "baseURL" | "apiKey" | "model"> & {
  route: VideoProviderRoute;
};

// -- executor interface ----------------------------------------------------

export interface VideoExecutor {
  generate(params: VideoGenerationParams): Promise<VideoGenerationResult>;
}

// -- registry accessors ----------------------------------------------------

export function isVideoModelProvider(value: unknown): value is VideoProviderKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(videoProviderRegistry, value);
}

export function getVideoProviderDefinition(provider: unknown): VideoProviderDefinition | null {
  return isVideoModelProvider(provider) ? videoProviderRegistry[provider] : null;
}

export function getVideoProviderConnectionFields(provider: unknown): readonly VideoProviderConnectionField[] {
  return getVideoProviderDefinition(provider)?.connectionFields || videoProviderRegistry.DashScope.connectionFields;
}

export function videoProviderUsesField(provider: unknown, field: VideoProviderConnectionField): boolean {
  return getVideoProviderConnectionFields(provider).includes(field);
}

export function getVideoProviderDefaultBaseURL(provider: unknown): string {
  return getVideoProviderDefinition(provider)?.defaultBaseURL || "";
}

export function getKnownVideoProviderDefaultBaseURLs(): string[] {
  return videoProviderKeys.map((provider) => videoProviderRegistry[provider].defaultBaseURL || "").filter(Boolean);
}

// -- config & executor factories -------------------------------------------

/**
 * Converts user-owned video model config into runtime-only provider constructor args.
 */
export function createVideoProviderConfig(
  model: VideoModelConfig | { provider?: VideoModelProvider; baseURL?: string; apiKey?: string; model?: string },
): VideoProviderRuntimeConfig | null {
  const provider = model.provider || "DashScope";
  const providerDefinition = getVideoProviderDefinition(provider);
  if (!providerDefinition) return null;

  return {
    route: providerDefinition.route,
    provider: provider as VideoModelProvider,
    baseURL: model.baseURL || "",
    apiKey: model.apiKey || "",
    model: model.model || "",
  };
}

/**
 * Instantiates the provider executor for already-derived runtime config.
 */
export function createVideoExecutor(config: VideoProviderRuntimeConfig): VideoExecutor {
  // DashScope is the only provider for now; structured for future additions.
  return new DashScopeVideoClient(config.baseURL, config.apiKey, config.model);
}
