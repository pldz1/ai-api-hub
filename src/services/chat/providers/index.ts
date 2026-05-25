import { getModelDeployment, isAnthropicChatModel, isAzureChatModel, isOpenAIChatModel } from "@/models";
import type { ChatModelConfig } from "@/types";
import type { ChatCompletionParams, ChatModelProviderConfig, ChatExecutor } from "../types";

import { AzureOpenAIClient } from "./azure-openai";
import { AnthropicClient } from "./anthropic";
import { OpenAIClient } from "./openai";

/**
 * Converts user-owned chat model config into runtime-only provider constructor args.
 *
 * This is the exact boundary where persisted/user-facing configuration stops and
 * request execution configuration begins.
 */
export function createChatProviderConfig(model: ChatModelConfig): ChatModelProviderConfig | null {
  if (isAzureChatModel(model)) {
    return {
      provider: "Azure OpenAI",
      endpoint: model.endpoint,
      apiKey: model.apiKey,
      deploymentName: getModelDeployment(model),
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
 * Callers should pass only `ChatModelProviderConfig` here, never raw settings
 * payloads from storage/UI.
 */
export function createChatExecutor(config: ChatModelProviderConfig): ChatExecutor {
  if (config.provider === "Azure OpenAI") {
    return new AzureOpenAIClient(config.endpoint, config.apiKey, config.deploymentName, config.apiVersion);
  }

  if (config.provider === "Anthropic" || config.provider === "Azure AI Foundry") {
    return new AnthropicClient(config.baseURL, config.apiKey, config.model, config.provider);
  }

  return new OpenAIClient(config.baseURL, config.apiKey, config.model);
}

export type { ChatExecutor };
