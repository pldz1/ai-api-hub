import { TokenUsage, ParamDefaultValue } from "../common";

// ============================================================================
// Provider runtime config (derived from user-owned model config, with extra fields for execution)
// ============================================================================

export type ChatProviderRoute = "openai" | "azure-openai" | "deepseek";
export type ChatProviderConnectionField = "baseURL" | "endpoint" | "deployment" | "apiVersion";

export interface ChatProviderDefinition {
  name: string;
  route: ChatProviderRoute;
  connectionFields: readonly ChatProviderConnectionField[];
  defaultBaseURL?: string;
  modelFamily: string;
  modelFamilyLabel?: string;
  modelFamilyLabelKey?: string;
  modelPatterns?: readonly RegExp[];
}

const chatProviderRegistryConfig = {
  OpenAI: {
    name: "OpenAI",
    route: "openai",
    connectionFields: ["baseURL"],
    defaultBaseURL: "https://api.openai.com/v1",
    modelFamily: "openai",
    modelFamilyLabelKey: "user.modelCard.suggestionGroups.openai",
    modelPatterns: [/^(gpt-|o\d)/],
  },
  "Azure OpenAI": {
    name: "Azure OpenAI",
    route: "azure-openai",
    connectionFields: ["endpoint", "deployment", "apiVersion"],
    modelFamily: "openai",
    modelFamilyLabelKey: "user.modelCard.suggestionGroups.openai",
    modelPatterns: [/^(gpt-|o\d)/],
  },
  DeepSeek: {
    name: "DeepSeek",
    route: "deepseek",
    connectionFields: ["baseURL"],
    defaultBaseURL: "https://api.deepseek.com",
    modelFamily: "deepseek",
    modelFamilyLabel: "DeepSeek",
    modelPatterns: [/^deepseek-/],
  },
} as const satisfies Record<string, ChatProviderDefinition>;

export type ChatProviderKey = keyof typeof chatProviderRegistryConfig;

export const chatProviderRegistry: Record<ChatProviderKey, ChatProviderDefinition> = chatProviderRegistryConfig;

export const chatProviderKeys = Object.keys(chatProviderRegistry) as ChatProviderKey[];

// ============================================================================
// Core identity
// ============================================================================

export type ChatModelProvider = ChatProviderKey;
export type ChatMessageRole = "system" | "user" | "assistant";
export type ChatMessageFormat = "text" | "parts";

// ============================================================================
// Model capabilities
// ============================================================================

export interface ChatModelModalities {
  textInput: boolean;
  textOutput: boolean;
  imageInput: boolean;
  imageOutput: boolean;
  audioInput: boolean;
  audioOutput: boolean;
  videoInput: boolean;
  videoOutput: boolean;
}

export interface ChatModelFeatures {
  streaming: boolean;
  structuredOutputs: boolean;
  fineTuning: boolean;
  reasoning: boolean;
}

export interface ChatModelTools {
  webSearch: boolean;
  imageGeneration: boolean;
  fileSearch: boolean;
  codeInterpreter: boolean;
  hostedShell: boolean;
  skills: boolean;
  mcp: boolean;
  applyPatch: boolean;
  computerUse: boolean;
  toolSearch: boolean;
  functionCalling: boolean;
}

export interface ChatModelCapabilityProfile {
  modalities: ChatModelModalities;
  features: ChatModelFeatures;
  tools: ChatModelTools;
}

export interface ChatModelCapabilities {
  imageRead: boolean;
  webSearch: boolean;
}

// ============================================================================
// User-owned model config consumed by chat services
// ============================================================================

export interface ChatModelConfigBase {
  name: string;
  apiKey: string;
  model: string;
}

export interface AzureOpenAIChatModelConfig extends ChatModelConfigBase {
  provider: "Azure OpenAI";
  endpoint: string;
  deployment: string;
  apiVersion: string;
}

export interface BaseURLChatModelConfig extends ChatModelConfigBase {
  provider: Exclude<ChatModelProvider, "Azure OpenAI">;
  baseURL: string;
}

export type ChatModelConfig = BaseURLChatModelConfig | AzureOpenAIChatModelConfig;

// ============================================================================
// Parameter definitions (model-level, not app-level)
// ============================================================================

export interface ChatTextContent {
  type: "text";
  text: string;
}

export interface ChatImageContent {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "low" | "high" | "auto" | string;
  };
}

export interface ChatRequest {
  model?: ChatModelConfig | null;
  params?: ChatCompletionParams;
  capabilities?: Partial<ChatModelCapabilities>;
}

export type ChatPromptContent = ChatTextContent | ChatImageContent;

export interface ChatPromptMessage {
  role: ChatMessageRole;
  content: ChatPromptContent[];
  mid?: string;
  reasoning_content?: string;
  token_usage?: TokenUsage | null;
  meta?: {
    isContextBlocked?: boolean;
    usedCapabilities?: Partial<ChatModelCapabilities>;
  };
}

// ============================================================================
// Packed message shapes used when serializing normalized chat content
// ============================================================================

export interface PackedTextChatMessage {
  role: ChatMessageRole;
  content: string;
}

export interface PackedPartChatMessage {
  role: ChatMessageRole;
  content: ChatPromptContent[];
}

export type PackedChatMessage = PackedTextChatMessage | PackedPartChatMessage;

// ============================================================================
// Provider communication
// ============================================================================

export interface ChatProviderResponse {
  flag?: boolean;
  content: string;
  reasoning_content: string;
  usage?: TokenUsage | null;
}

export type ChatCallback = (response: ChatProviderResponse) => void | Promise<void>;

export type ChatResponseDelta =
  | { kind: "text"; content: string; reasoning_content: string }
  | { kind: "usage"; usage: TokenUsage }
  | { kind: "error"; message: string };

export interface ChatRequestOptions {
  signal?: AbortSignal;
}

// ============================================================================
// Request parameters (sent to provider APIs)
// ============================================================================

export type ChatParamValue = ParamDefaultValue | undefined;
export type ChatParamRecord = Record<string, ChatParamValue>;

export interface ChatStreamOptions {
  [key: string]: unknown;
  include_usage?: boolean;
}

/**
 * Normalized request-param bag derived from chat settings.
 *
 * All model-specific keys keep the same names as the settings form. Runtime-only
 * control flags such as `stream` and turn toggles are added explicitly here.
 */
export interface ChatCompletionParams extends ChatParamRecord {
  stream?: boolean;
  stream_options?: ChatStreamOptions;
  webSearch?: boolean;
}

// ============================================================================
// Executor interface (provider-agnostic chat entry point)
// ============================================================================

export interface ChatExecutor {
  chat(messages: PackedChatMessage[], params?: ChatCompletionParams, callback?: ChatCallback | null, options?: ChatRequestOptions): Promise<void>;
}
