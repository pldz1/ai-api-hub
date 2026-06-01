import { ChatProviderConnectionField, ChatProviderDefinition, ChatProviderKey, chatProviderKeys, chatProviderRegistry } from "../types";
import type { ChatExecutor, ChatModelConfig, ChatProviderRoute } from "../types";

import { AzureOpenAIClient } from "./azure-openai";
import { DashScopeClient } from "./dashscope";
import { DeepSeekClient } from "./deepseek";
import { OpenAIClient } from "./openai";

type ChatProviderRuntimeConfig = Pick<ChatModelConfig, "provider" | "baseURL" | "apiKey" | "model"> & {
  route: ChatProviderRoute;
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
  const providerDefinition = getChatProviderDefinition(model.provider);
  if (!providerDefinition) return null;

  return {
    route: providerDefinition.route,
    provider: model.provider,
    baseURL: model.baseURL,
    apiKey: model.apiKey,
    model: model.model,
  };
}

/**
 * Instantiates the provider executor for already-derived runtime config.
 *
 * Callers should pass only `ChatProviderRuntimeConfig` here, never raw settings
 * payloads from storage/UI.
 */
export function createChatExecutor(config: ChatProviderRuntimeConfig): ChatExecutor {
  if (config.route === "azure-openai") {
    return new AzureOpenAIClient(config.baseURL, config.apiKey, config.model);
  }

  if (config.route === "deepseek") {
    return new DeepSeekClient(config.baseURL, config.apiKey, config.model);
  }

  if (config.route === "dashscope") {
    return new DashScopeClient(config.baseURL, config.apiKey, config.model);
  }

  return new OpenAIClient(config.baseURL, config.apiKey, config.model);
}
