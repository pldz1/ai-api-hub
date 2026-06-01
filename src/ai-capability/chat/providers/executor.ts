import { ChatProviderConnectionField, ChatProviderDefinition, ChatProviderKey, chatProviderKeys, chatProviderRegistry } from "../types";
import type { ChatExecutor, ChatMessageFormat, ChatModelCapabilities, ChatModelConfig, ChatProviderModelContext, ChatProviderResolver, ChatProviderRoute } from "../types";

import { AzureOpenAIClient } from "./azure-openai";
import { DashScopeClient } from "./dashscope";
import { DeepSeekClient } from "./deepseek";
import { OpenAIClient } from "./openai";

type BaseURLChatProviderRuntimeConfig = Pick<Extract<ChatModelConfig, { baseURL: string }>, "provider" | "baseURL" | "apiKey" | "model"> & {
  route: Exclude<ChatProviderRoute, "azure-openai">;
};

type AzureOpenAIChatProviderRuntimeConfig = Pick<
  Extract<ChatModelConfig, { provider: "Azure OpenAI" }>,
  "provider" | "endpoint" | "apiKey" | "deployment" | "apiVersion"
> & {
  route: "azure-openai";
};

type ChatProviderRuntimeConfig = BaseURLChatProviderRuntimeConfig | AzureOpenAIChatProviderRuntimeConfig;

function getModelDeployment(model: ChatModelConfig): string {
  return "deployment" in model && model.deployment ? model.deployment : model.model;
}

function resolveProviderValue<T>(value: ChatProviderResolver<T>, model: ChatProviderModelContext = {}): T {
  return typeof value === "function" ? (value as (model: ChatProviderModelContext) => T)(model) : value;
}

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

export function getChatProviderCapabilities(provider: unknown, model: ChatProviderModelContext = {}): ChatModelCapabilities | null {
  const definition = getChatProviderDefinition(provider);
  if (!definition) return null;
  return resolveProviderValue(definition.capabilities, { ...model, provider });
}

export function getChatProviderChatParamKeys(provider: unknown, model: ChatProviderModelContext = {}): readonly string[] {
  const definition = getChatProviderDefinition(provider);
  if (!definition) return [];
  return resolveProviderValue(definition.chatParamKeys, { ...model, provider });
}

export function getChatProviderMessageFormat(provider: unknown, model: ChatProviderModelContext = {}): ChatMessageFormat | null {
  const definition = getChatProviderDefinition(provider);
  if (!definition) return null;
  return resolveProviderValue(definition.messageFormat, { ...model, provider });
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

  if (providerDefinition.route === "azure-openai" && "endpoint" in model) {
    return {
      route: "azure-openai",
      provider: "Azure OpenAI",
      endpoint: model.endpoint,
      apiKey: model.apiKey,
      deployment: getModelDeployment(model),
      apiVersion: model.apiVersion,
    };
  }

  if ("baseURL" in model) {
    return {
      route: providerDefinition.route as Exclude<ChatProviderRoute, "azure-openai">,
      provider: model.provider,
      baseURL: model.baseURL,
      apiKey: model.apiKey,
      model: model.model,
    };
  }

  return null;
}

/**
 * Instantiates the provider executor for already-derived runtime config.
 *
 * Callers should pass only `ChatProviderRuntimeConfig` here, never raw settings
 * payloads from storage/UI.
 */
export function createChatExecutor(config: ChatProviderRuntimeConfig): ChatExecutor {
  if (config.route === "azure-openai") {
    return new AzureOpenAIClient(config.endpoint, config.apiKey, config.deployment, config.apiVersion);
  }

  if (config.route === "deepseek") {
    return new DeepSeekClient(config.baseURL, config.apiKey, config.model);
  }

  if (config.route === "dashscope") {
    return new DashScopeClient(config.baseURL, config.apiKey, config.model);
  }

  return new OpenAIClient(config.baseURL, config.apiKey, config.model);
}
