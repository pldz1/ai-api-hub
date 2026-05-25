export interface OpenAIChatModelProviderConfig {
  provider: "OpenAI";
  baseURL: string;
  apiKey: string;
  model: string;
}

export interface AzureOpenAIChatModelProviderConfig {
  provider: "Azure OpenAI";
  endpoint: string;
  apiKey: string;
  deploymentName: string;
  apiVersion: string;
}

export interface AnthropicChatModelProviderConfig {
  provider: "Anthropic" | "Azure AI Foundry";
  baseURL: string;
  apiKey: string;
  model: string;
}

export type ChatModelProviderConfig = OpenAIChatModelProviderConfig | AzureOpenAIChatModelProviderConfig | AnthropicChatModelProviderConfig;
