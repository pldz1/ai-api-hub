import { VideoProviderConnectionField, VideoProviderDefinition, VideoProviderKey, videoProviderKeys, videoProviderRegistry } from "../types";
import type { VideoAdapterId, VideoGenerationParams, VideoGenerationResult, VideoModelConfig, VideoModelProvider } from "../types";
import { resolveVideoModel } from "../models";

import { DashScopeVideoClient } from "./dashscope";

// -- runtime config --------------------------------------------------------

type VideoProviderRuntimeConfig = Pick<VideoModelConfig, "provider" | "baseURL" | "apiKey" | "model" | "useProxy"> & {
  adapterId: VideoAdapterId;
};

// -- executor interface ----------------------------------------------------

export interface VideoExecutor {
  generate(params: VideoGenerationParams, onStatusUpdate?: (status: string) => void): Promise<VideoGenerationResult>;
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
  model: VideoModelConfig | { provider?: VideoModelProvider; baseURL?: string; apiKey?: string; model?: string; useProxy?: boolean },
): VideoProviderRuntimeConfig | null {
  const provider = model.provider || "DashScope";
  const providerDefinition = getVideoProviderDefinition(provider);
  if (!providerDefinition) return null;

  const resolved = resolveVideoModel({
    name: "name" in model ? model.name || "" : "",
    provider: provider as VideoModelProvider,
    baseURL: model.baseURL || "",
    apiKey: model.apiKey || "",
    model: model.model || "",
    useProxy: model.useProxy ?? false,
  });
  if (!resolved) return null;

  return {
    adapterId: resolved.binding.adapterId,
    provider: resolved.config.provider,
    baseURL: resolved.config.baseURL,
    apiKey: resolved.config.apiKey,
    model: resolved.config.model,
    useProxy: resolved.config.useProxy,
  };
}

/**
 * Instantiates the provider executor for already-derived runtime config.
 */
export function createVideoExecutor(config: VideoProviderRuntimeConfig): VideoExecutor {
  const factories: Record<VideoAdapterId, () => VideoExecutor> = {
    "dashscope-video-task": () => new DashScopeVideoClient(config.baseURL, config.apiKey, config.model, config.useProxy ?? false),
  };
  return factories[config.adapterId]();
}
