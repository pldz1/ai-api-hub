import type { CapabilityOverrideMode, ChatMessageRole, ChatModelCapabilities, ChatModelProvider, ModelConfigBase, ModelParamDef, SelectOption } from "./model-shared";

export interface ChatModelOption extends SelectOption {
  isReasonModel: boolean;
  msgTypeVersion: "v1" | "v2";
  capabilities: Pick<ChatModelCapabilities, "webSearch" | "reasoning" | "imageRead">;
}

export interface BaseChatModelDraft extends ModelConfigBase {
  provider: ChatModelProvider;
  enabledCapabilitiesMode?: CapabilityOverrideMode;
  enabledCapabilities?: Partial<ChatModelCapabilities>;
}

export interface OpenAIChatModelDraft extends BaseChatModelDraft {
  provider: "OpenAI";
  baseURL: string;
}

export interface AnthropicChatModelDraft extends BaseChatModelDraft {
  provider: "Anthropic" | "Azure AI Foundry";
  baseURL: string;
}

export interface AzureOpenAIChatModelDraft extends BaseChatModelDraft {
  provider: "Azure OpenAI";
  endpoint: string;
  deployment: string;
  apiVersion: string;
}

export type ChatModelDraft = OpenAIChatModelDraft | AnthropicChatModelDraft | AzureOpenAIChatModelDraft;

export interface ChatModelResolvedFields {
  chatParamDefs: ModelParamDef[];
}

export type ChatModelConfig = ChatModelDraft;
export type ResolvedChatModelConfig = ChatModelConfig & ChatModelResolvedFields;

export interface ConversationModelSnapshot {
  modelConfigId: string;
  catalogModelId: string;
  displayName: string;
  provider: ChatModelProvider;
  request: {
    model?: string;
    baseURL?: string;
    endpoint?: string;
    deployment?: string;
    apiVersion?: string;
  };
  apiKey: string;
  supportedCapabilities: ChatModelCapabilities;
  enabledCapabilities: ChatModelCapabilities;
  chatParamDefs: ModelParamDef[];
  modelConfig: ChatModelConfig;
}

export interface OpenAIProviderConfig {
  provider: "OpenAI";
  baseURL: string;
  apiKey: string;
  model: string;
}

export interface AzureOpenAIProviderConfig {
  provider: "Azure OpenAI";
  endpoint: string;
  apiKey: string;
  deploymentName: string;
  apiVersion: string;
}

export interface AnthropicProviderConfig {
  provider: "Anthropic" | "Azure AI Foundry";
  baseURL: string;
  apiKey: string;
  model: string;
}

export type ChatProviderConfig = OpenAIProviderConfig | AzureOpenAIProviderConfig | AnthropicProviderConfig;

export interface PromptContent {
  type: "text";
  text: string;
}

export interface PromptMessage {
  role: ChatMessageRole;
  content: PromptContent[];
}

export interface ChatModelSettings {
  passedMsgLen: number;
  prompts: PromptMessage[];
  [key: string]: unknown;
}
