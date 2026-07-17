import { ChatProviderConnectionField, ChatProviderDefinition, ChatProviderKey, chatProviderKeys, chatProviderRegistry } from "../types";
import type { ChatAdapterId, ChatExecutor, ChatModelConfig } from "../types";
import { resolveChatModel } from "../models";

import { AzureOpenAIClient } from "./azure-openai";
import { DashScopeClient } from "./dashscope";
import { DeepSeekClient } from "./deepseek";
import { OpenAIClient } from "./openai";

export type ChatProviderRuntimeConfig = Pick<ChatModelConfig, "provider" | "baseURL" | "apiKey" | "model"> & {
  adapterId: ChatAdapterId;
  adapterOptions: Record<string, unknown>;
};

type ChatAdapterFactory = (config: ChatProviderRuntimeConfig) => ChatExecutor;

const chatAdapterRegistry: Record<ChatAdapterId, ChatAdapterFactory> = {
  "openai-responses": (config) => new OpenAIClient(config.baseURL, config.apiKey, config.model, config.adapterOptions),
  "azure-openai-responses": (config) => new AzureOpenAIClient(config.baseURL, config.apiKey, config.model, config.adapterOptions),
  "anthropic-messages": (config) => new DeepSeekClient(config.baseURL, config.apiKey, config.model, config.adapterOptions),
  "openai-chat-completions": (config) => new DashScopeClient(config.baseURL, config.apiKey, config.model, config.adapterOptions),
};

export function isChatModelProvider(value: unknown): value is ChatProviderKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(chatProviderRegistry, value);
}

export function getChatProviderDefinition(provider: unknown): ChatProviderDefinition | null {
  return isChatModelProvider(provider) ? chatProviderRegistry[provider] : null;
}

export function getChatProviderConnectionFields(provider: unknown): readonly ChatProviderConnectionField[] {
  return getChatProviderDefinition(provider)?.connectionFields || chatProviderRegistry.OpenAI.connectionFields;
}

export function chatProviderUsesField(provider: unknown, field: ChatProviderConnectionField): boolean {
  return getChatProviderConnectionFields(provider).includes(field);
}

export function getChatProviderDefaultBaseURL(provider: unknown): string {
  return getChatProviderDefinition(provider)?.defaultBaseURL || "";
}

export function getKnownChatProviderDefaultBaseURLs(): string[] {
  return chatProviderKeys.map((provider) => chatProviderRegistry[provider].defaultBaseURL || "").filter(Boolean);
}

/**
 * Converts user-owned chat model config into runtime-only provider constructor args.
 *
 * This is the exact boundary where persisted/user-facing configuration stops and
 * request execution configuration begins.
 */
export function createChatProviderConfig(model: ChatModelConfig): ChatProviderRuntimeConfig | null {
  const resolved = resolveChatModel(model);
  if (!resolved) return null;

  return {
    adapterId: resolved.binding.adapterId,
    adapterOptions: { ...(resolved.binding.adapterOptions || {}) },
    provider: resolved.config.provider,
    baseURL: resolved.config.baseURL,
    apiKey: resolved.config.apiKey,
    model: resolved.config.model,
  };
}

/**
 * Instantiates the provider executor for already-derived runtime config.
 *
 * Callers should pass only `ChatProviderRuntimeConfig` here, never raw settings
 * payloads from storage/UI.
 */
export function createChatExecutor(config: ChatProviderRuntimeConfig): ChatExecutor {
  return chatAdapterRegistry[config.adapterId](config);
}
