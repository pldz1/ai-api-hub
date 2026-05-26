import { getModelDeployment, isAnthropicChatModel, isAzureChatModel, isOpenAIChatModel } from "@/models";
import type { ChatExecutor, ChatModelConfig } from "../types";

import { AzureOpenAIClient } from "./azure-openai";
import { AnthropicClient } from "./anthropic";
import { OpenAIClient } from "./openai";

type OpenAIChatProviderRuntimeConfig = Pick<Extract<ChatModelConfig, { provider: "OpenAI" }>, "provider" | "baseURL" | "apiKey" | "model">;
type AzureOpenAIChatProviderRuntimeConfig = Pick<
  Extract<ChatModelConfig, { provider: "Azure OpenAI" }>,
  "provider" | "endpoint" | "apiKey" | "deployment" | "apiVersion"
>;
type AnthropicChatProviderRuntimeConfig = Pick<
  Extract<ChatModelConfig, { provider: "Anthropic" | "Azure AI Foundry" }>,
  "provider" | "baseURL" | "apiKey" | "model"
>;
type ChatProviderRuntimeConfig = OpenAIChatProviderRuntimeConfig | AzureOpenAIChatProviderRuntimeConfig | AnthropicChatProviderRuntimeConfig;

/**
 * Converts user-owned chat model config into runtime-only provider constructor args.
 *
 * This is the exact boundary where persisted/user-facing configuration stops and
 * request execution configuration begins.
 */
export function createChatProviderConfig(model: ChatModelConfig): ChatProviderRuntimeConfig | null {
  if (isAzureChatModel(model)) {
    return {
      provider: "Azure OpenAI",
      endpoint: model.endpoint,
      apiKey: model.apiKey,
      deployment: getModelDeployment(model),
      apiVersion: model.apiVersion,
    };
  }

  if (isOpenAIChatModel(model)) {
    return {
      provider: "OpenAI",
      baseURL: model.baseURL,
      apiKey: model.apiKey,
      model: model.model,
    };
  }

  if (isAnthropicChatModel(model)) {
    return {
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
  if (config.provider === "Azure OpenAI") {
    return new AzureOpenAIClient(config.endpoint, config.apiKey, config.deployment, config.apiVersion);
  }

  if (config.provider === "Anthropic" || config.provider === "Azure AI Foundry") {
    return new AnthropicClient(config.baseURL, config.apiKey, config.model, config.provider);
  }

  return new OpenAIClient(config.baseURL, config.apiKey, config.model);
}

export type { ChatExecutor };
