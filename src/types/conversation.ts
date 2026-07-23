import type { ChatModelConfig, ChatModelProvider, ChatParamRecord } from "@/ai-capability";

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
  apiKey: string;
  model: string;
}

/**
 * Last-selected conversation model snapshot.
 *
 * This captures the user-configured model most recently selected for a conversation
 * so reopening it restores the composer. Individual responses keep their exact
 * execution model in their RunSnapshot.
 * Runtime request params and other derived metadata are intentionally excluded;
 * they are recomputed from `modelConfig` when needed.
 */
export interface ChatModelSnapshot {
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
 * This keeps the normalized settings object and the latest model snapshot
 * together so imported/exported chat parameters round-trip without shape drift.
 */
export interface PersistedChatSettings {
  modelSnapshot: ChatModelSnapshot;
  settings: ChatModelSettings;
}

export interface ChatListItem {
  cid: string;
  cname: string;
}
