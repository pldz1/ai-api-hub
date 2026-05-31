import { TokenUsage, ParamDefaultValue } from "../common";

// ============================================================================
// Provider runtime config (derived from user-owned model config, with extra fields for execution)
// ============================================================================

export type ChatProviderRoute = "openai" | "azure-openai" | "deepseek" | "dashscope";
export type ChatProviderConnectionField = "baseURL" | "endpoint" | "deployment" | "apiVersion";

export interface ChatModelFamilyDefinition {
  key: string;
  label?: string;
  labelKey?: string;
}

export interface ChatProviderModelContext {
  provider?: unknown;
  model?: string;
  baseURL?: string;
  endpoint?: string;
  deployment?: string;
}

export type ChatProviderResolver<T> = T | ((model: ChatProviderModelContext) => T);

export interface ChatProviderDefinition {
  name: string;
  route: ChatProviderRoute;
  connectionFields: readonly ChatProviderConnectionField[];
  defaultBaseURL?: string;
  modelFamilies: readonly ChatModelFamilyDefinition[];
  supportsCustomModels: boolean;
  messageFormat: ChatProviderResolver<ChatMessageFormat>;
  chatParamKeys: ChatProviderResolver<readonly string[]>;
  capabilities: ChatProviderResolver<ChatModelCapabilities>;
}

const openAIModelFamily = { key: "openai", labelKey: "user.modelCard.suggestionGroups.openai" } as const;
const deepSeekModelFamily = { key: "deepseek", label: "DeepSeek" } as const;
const qwenModelFamily = { key: "qwen", labelKey: "user.modelCard.suggestionGroups.qwen" } as const;

const gpt5ChatParamKeys = ["max_completion_tokens", "reasoning_effort", "verbosity"] as const;
const openAIChatParamKeys = ["max_completion_tokens", "temperature", "top_p", "frequency_penalty", "presence_penalty"] as const;
const deepSeekChatParamKeys = ["thinking", "reasoning_effort", "temperature", "top_p"] as const;
const dashScopeChatParamKeys = ["max_tokens", "temperature", "top_p"] as const;

function isOfficialOpenAIBaseURL(baseURL = ""): boolean {
  return !baseURL || /^https:\/\/api\.openai\.com(?:\/|$)/i.test(baseURL.trim());
}

function resolveOpenAIChatParamKeys(model: ChatProviderModelContext): readonly string[] {
  return /^gpt-5\./i.test(String(model.model || "")) ? gpt5ChatParamKeys : openAIChatParamKeys;
}

function resolveOpenAICapabilities(model: ChatProviderModelContext): ChatModelCapabilities {
  if (!isOfficialOpenAIBaseURL(model.baseURL)) return { webSearch: false, imageRead: false };
  return { webSearch: true, imageRead: true };
}

const chatProviderRegistryConfig = {
  OpenAI: {
    name: "OpenAI",
    route: "openai",
    connectionFields: ["baseURL"],
    defaultBaseURL: "https://api.openai.com/v1",
    modelFamilies: [openAIModelFamily],
    supportsCustomModels: true,
    messageFormat: "parts",
    chatParamKeys: resolveOpenAIChatParamKeys,
    capabilities: resolveOpenAICapabilities,
  },
  "Azure OpenAI": {
    name: "Azure OpenAI",
    route: "azure-openai",
    connectionFields: ["endpoint", "deployment", "apiVersion"],
    modelFamilies: [openAIModelFamily],
    supportsCustomModels: true,
    messageFormat: "parts",
    chatParamKeys: resolveOpenAIChatParamKeys,
    capabilities: { webSearch: false, imageRead: true },
  },
  DeepSeek: {
    name: "DeepSeek",
    route: "deepseek",
    connectionFields: ["baseURL"],
    defaultBaseURL: "https://api.deepseek.com",
    modelFamilies: [deepSeekModelFamily],
    supportsCustomModels: true,
    messageFormat: "text",
    chatParamKeys: deepSeekChatParamKeys,
    capabilities: { webSearch: false, imageRead: false },
  },
  DashScope: {
    name: "DashScope",
    route: "dashscope",
    connectionFields: ["baseURL"],
    defaultBaseURL: "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
    modelFamilies: [qwenModelFamily, deepSeekModelFamily],
    supportsCustomModels: true,
    messageFormat: "text",
    chatParamKeys: dashScopeChatParamKeys,
    capabilities: { webSearch: true, imageRead: false },
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
