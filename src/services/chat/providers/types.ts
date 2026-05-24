/**
 * OpenAI runtime config passed to the chat provider client factory.
 *
 * This shape is derived just-in-time from user-owned model payloads and is
 * meant only for executing requests.
 */
export interface OpenAIChatProviderRuntimeConfig {
  provider: "OpenAI";
  baseURL: string;
  apiKey: string;
  model: string;
}

/** Runtime config for Azure OpenAI chat execution. */
export interface AzureOpenAIChatProviderRuntimeConfig {
  provider: "Azure OpenAI";
  endpoint: string;
  apiKey: string;
  deploymentName: string;
  apiVersion: string;
}

/** Runtime config for Anthropic-compatible chat execution. */
export interface AnthropicChatProviderRuntimeConfig {
  provider: "Anthropic" | "Azure AI Foundry";
  baseURL: string;
  apiKey: string;
  model: string;
}

/** All runtime-only chat provider configs consumed by provider executors. */
export type ChatProviderRuntimeConfig =
  | OpenAIChatProviderRuntimeConfig
  | AzureOpenAIChatProviderRuntimeConfig
  | AnthropicChatProviderRuntimeConfig;
