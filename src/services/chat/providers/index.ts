import { getModelDeployment, isAnthropicChatModel, isAzureChatModel, isOpenAIChatModel } from "@/models";
import type { ChatCompletionParams, ChatModelConfig } from "@/types";
import type { ChatCallback, ChatRequestOptions, PackedChatMessage } from "@/services/types";

import { ChatModelProviderConfig } from "../types";

import { AzureOpenAIClient } from "./azure-openai";
import { AnthropicClient } from "./anthropic";
import { OpenAIClient } from "./openai";

/**
 * Common executor interface used by chat runtime after a provider has been
 * selected and initialized.
 */
export interface ChatExecutor {
  chat(messages: PackedChatMessage[], params?: ChatCompletionParams, callback?: ChatCallback | null, options?: ChatRequestOptions): Promise<void>;
}

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
