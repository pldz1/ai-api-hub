import { TokenUsage, ParamDefaultValue, RunSnapshot } from "../common";

// ============================================================================
// Provider runtime config (derived from user-owned model config, with extra fields for execution)
// ============================================================================

/**
 * Wire-protocol implementation used to execute a chat model.
 *
 * Provider identity and protocol identity are deliberately separate: one
 * provider can expose different protocols, while multiple providers can share
 * the same protocol shape.
 */
export type ChatAdapterId = "openai-responses" | "azure-openai-responses" | "anthropic-messages" | "openai-chat-completions";
export type ChatProviderConnectionField = "baseURL";

export interface ChatProviderDefinition {
  name: string;
  adapterId: ChatAdapterId;
  connectionFields: readonly ChatProviderConnectionField[];
  defaultBaseURL?: string;
}

const chatProviderRegistryConfig = {
  OpenAI: {
    name: "OpenAI",
    adapterId: "openai-responses",
    connectionFields: ["baseURL"],
    defaultBaseURL: "https://api.openai.com/v1/responses",
  },
  "Azure OpenAI": {
    name: "Azure OpenAI",
    adapterId: "azure-openai-responses",
    connectionFields: ["baseURL"],
    defaultBaseURL: "https://<YOUR-AZURE-PROJECT>.openai.azure.com/openai/v1/responses",
  },
  DeepSeek: {
    name: "DeepSeek",
    adapterId: "anthropic-messages",
    connectionFields: ["baseURL"],
    defaultBaseURL: "https://api.deepseek.com/anthropic",
  },
  DashScope: {
    name: "DashScope",
    adapterId: "openai-chat-completions",
    connectionFields: ["baseURL"],
    defaultBaseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
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

export interface ChatModelCapabilities {
  imageRead: boolean;
  webSearch: boolean;
}

// ============================================================================
// User-owned model config consumed by chat services
// ============================================================================

export interface ChatModelConfig {
  name: string;
  provider: ChatModelProvider;
  baseURL: string;
  apiKey: string;
  model: string;
}

export type ChatMessageAttachmentKind = "text" | "pdf" | "docx" | "xlsx";

export interface ChatMessageAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  text: string;
  truncated: boolean;
  kind: ChatMessageAttachmentKind;
  kindLabel: string;
}

// ============================================================================
// Parameter definitions (model-level, not app-level)
// ============================================================================

interface ChatTextContent {
  type: "text";
  text: string;
}

interface ChatPartsContent {
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

export type ChatPromptContent = ChatTextContent | ChatPartsContent;

export interface ChatPromptMessage {
  role: ChatMessageRole;
  content: ChatPromptContent[];
  mid?: string;
  reasoning_content?: string;
  attachments?: ChatMessageAttachment[];
  meta?: {
    isContextBlocked?: boolean;
    usedCapabilities?: Partial<ChatModelCapabilities>;
    run?: RunSnapshot;
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
  reasoningBoost?: boolean;
}

// ============================================================================
// Executor interface (provider-agnostic chat entry point)
// ============================================================================

export interface ChatExecutor {
  chat(messages: PackedChatMessage[], params?: ChatCompletionParams, callback?: ChatCallback | null, options?: ChatRequestOptions): Promise<void>;
}
