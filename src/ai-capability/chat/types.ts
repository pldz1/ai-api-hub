/**
 * AI-capability types — the pure model layer.
 *
 * These describe what AI models are, what they can do, and how the runtime
 * communicates with providers. They do NOT depend on app-level types such as
 * settings payloads, editor state, or storage shapes.
 */

import { TokenUsage } from "../common";

// ============================================================================
// Core identity
// ============================================================================

export type ChatModelProvider = "OpenAI" | "Azure OpenAI" | "Anthropic" | "Azure AI Foundry";
export type ChatMessageRole = "system" | "user" | "assistant";

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

export interface OpenAIChatModelConfig extends ChatModelConfigBase {
  provider: "OpenAI";
  baseURL: string;
}

export interface AzureOpenAIChatModelConfig extends ChatModelConfigBase {
  provider: "Azure OpenAI";
  endpoint: string;
  deployment: string;
  apiVersion: string;
}

export interface AnthropicChatModelConfig extends ChatModelConfigBase {
  provider: "Anthropic";
  baseURL: string;
}

export interface AzureAIFoundryChatModelConfig extends ChatModelConfigBase {
  provider: "Azure AI Foundry";
  baseURL: string;
}

export type ChatModelConfig = OpenAIChatModelConfig | AzureOpenAIChatModelConfig | AnthropicChatModelConfig | AzureAIFoundryChatModelConfig;

// ============================================================================
// Parameter definitions (model-level, not app-level)
// ============================================================================

export type ModelParamType = "number" | "string" | "array" | "boolean" | "object" | "image";
export type ParamDefaultValue = string | number | boolean | unknown[] | Record<string, unknown> | null;

export interface ModelParamDef {
  key: string;
  label: string;
  type: ModelParamType;
  description: string;
  descriptionKey: string;
  placeholder: string;
  defaultValue: ParamDefaultValue;
  min: number;
  max: number;
  step: number;
}

export interface SelectOption<TValue extends string = string> {
  value: TValue;
  name: string;
}

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

export type ChatPromptContent = ChatTextContent | ChatImageContent;

export interface ChatPromptMessage {
  role: ChatMessageRole;
  content: ChatPromptContent[];
  mid?: string;
  reasoning_content?: string;
  token_usage?: TokenUsage | null;
  meta?: {
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
