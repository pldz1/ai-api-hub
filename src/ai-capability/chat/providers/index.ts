import type { ChatExecutor, ChatModelConfig } from "../types";
import { getChatProviderDefinition, type ChatProviderRoute } from "../provider-registry";

import { AzureOpenAIClient } from "./azure-openai";
import { AnthropicClient } from "./anthropic";
import { DeepSeekClient } from "./deepseek";
import { OpenAIClient } from "./openai";

type BaseURLChatProviderRuntimeConfig = Pick<Extract<ChatModelConfig, { baseURL: string }>, "provider" | "baseURL" | "apiKey" | "model"> & {
  route: Exclude<ChatProviderRoute, "azure-openai">;
};
type AzureOpenAIChatProviderRuntimeConfig = Pick<Extract<ChatModelConfig, { provider: "Azure OpenAI" }>, "provider" | "endpoint" | "apiKey" | "deployment" | "apiVersion"> & {
  route: "azure-openai";
};
type ChatProviderRuntimeConfig = BaseURLChatProviderRuntimeConfig | AzureOpenAIChatProviderRuntimeConfig;

function getModelDeployment(model: ChatModelConfig): string {
  return "deployment" in model && model.deployment ? model.deployment : model.model;
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

  if (config.route === "anthropic") {
    return new AnthropicClient(config.baseURL, config.apiKey, config.model, config.provider as "Anthropic" | "Azure AI Foundry");
  }

  if (config.route === "deepseek") {
    return new DeepSeekClient(config.baseURL, config.apiKey, config.model);
  }

  return new OpenAIClient(config.baseURL, config.apiKey, config.model);
}

export type { ChatExecutor };
