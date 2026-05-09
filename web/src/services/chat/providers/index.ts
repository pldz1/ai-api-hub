import { getModelDeployment, getModelRequestId, isAnthropicChatModel, isAzureChatModel, isOpenAIChatModel } from "@/constants";
import type { ChatModelConfig, ChatProviderConfig } from "@/types/model";
import type { ChatCallback, PackedChatMessage } from "@/services/types";

import { AzureOpenAIClient } from "./azure-openai";
import { AnthropicClient } from "./anthropic";
import { OpenAIClient } from "./openai";

export { AnthropicClient } from "./anthropic";
export { AzureOpenAIClient } from "./azure-openai";
export { DeepSeekClient } from "./deepseek";
export { OpenAIClient } from "./openai";
export { normalizeUsage } from "./usage";

export interface ChatExecutor {
  chat(messages: PackedChatMessage[], params?: Record<string, unknown>, callback?: ChatCallback | null): Promise<void>;
}

/**
 * Convert a saved chat model configuration into provider constructor params.
 */
export function createChatProviderConfig(model: ChatModelConfig): ChatProviderConfig | null {
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
      model: getModelRequestId(model),
    };
  }

  if (isAnthropicChatModel(model)) {
    return {
      provider: model.provider,
      baseURL: model.baseURL,
      apiKey: model.apiKey,
      model: getModelRequestId(model),
    };
  }

  return null;
}

export function createChatExecutor(config: ChatProviderConfig): ChatExecutor {
  if (config.provider === "Azure OpenAI") {
    return new AzureOpenAIClient(config.endpoint, config.apiKey, config.deploymentName, config.apiVersion);
  }

  if (config.provider === "Anthropic" || config.provider === "Azure AI Foundry") {
    return new AnthropicClient(config.baseURL, config.apiKey, config.model, config.provider);
  }

  return new OpenAIClient(config.baseURL, config.apiKey, config.model);
}
