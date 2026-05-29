import type { ChatModelCapabilities, ChatModelCapabilityProfile, ChatModelConfig, ChatModelProvider, ChatParamRecord, TokenUsage } from "@/ai-capability";

export type ChatFormProvider = ChatModelProvider | "";

/**
 * Chat-model editor state used by the settings form.
 *
 * Unlike the old wide model draft, this state is chat-only and keeps only the
 * fields relevant to editing a chat provider config.
 */
export interface ChatModelEditorState {
  name: string;
  provider: ChatFormProvider;
  baseURL: string;
  endpoint: string;
  apiKey: string;
  model: string;
  deployment: string;
  apiVersion: string;
}

/**
 * Conversation-bound model snapshot.
 *
 * This captures which user-configured model a conversation is locked to.
 * Runtime request params and other derived metadata are intentionally excluded;
 * they are recomputed from `modelConfig` when needed.
 */
export interface ConversationModelSnapshot {
  modelConfigId: string;
  catalogModelId: string;
  displayName: string;
  provider: ChatModelProvider;
  apiKey: string;
  modelConfig: ChatModelConfig;
}

/**
 * Per-conversation chat settings merged with a model's parameter definitions.
 *
 * `passedMsgLen` and `prompts` are stable app-level fields; the index signature
 * holds model-specific request parameters such as temperature or max tokens.
 */
export interface ChatModelSettings extends ChatParamRecord {
  passedMsgLen: number;
  prompts: { role: "system" | "user" | "assistant"; content: { type: "text"; text: string }[] }[];
}

/**
 * Persisted per-conversation chat settings payload written to storage.
 *
 * This keeps the normalized settings object and the bound model snapshot
 * together so imported/exported chat parameters round-trip without shape drift.
 */
export interface PersistedChatSettings {
  modelSnapshot: ConversationModelSnapshot | null;
  settings: ChatModelSettings;
}

export interface StoredChatMessage {
  mid: string;
  message: string;
}

export interface ChatListItem {
  cid: string;
  cname: string;
}

export type ChatResponseDelta =
  | { kind: "text"; content: string; reasoning_content: string }
  | { kind: "usage"; usage: TokenUsage }
  | { kind: "error"; message: string };
