import type {
  ChatModelCapabilities,
  ChatModelCapabilityProfile,
  ChatModelConfig,
  ChatModelProvider,
  ChatParamRecord,
  SelectOption,
} from "@/ai-capability/chat/types";

export type ChatFormProvider = ChatModelProvider | "";
export type CapabilityOverrideMode = "inherit" | "custom";

/**
 * Catalog metadata for a known chat model id.
 *
 * This is not user configuration. It describes built-in capabilities and
 * protocol behavior for model suggestions such as `gpt-5.5`.
 */
export interface ChatModelOption extends SelectOption {
  isReasonModel: boolean;
  msgTypeVersion: "v1" | "v2";
  capabilityProfile: ChatModelCapabilityProfile;
  capabilities: Pick<ChatModelCapabilities, "webSearch" | "imageRead">;
}

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
  enabledCapabilitiesMode: CapabilityOverrideMode;
  enabledCapabilities: Partial<ChatModelCapabilities>;
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
export interface PersistedChatSettingsPayload {
  version?: 2;
  modelSnapshot: ConversationModelSnapshot | null;
  settings: ChatModelSettings;
}

/** Workspace-level export item for one conversation's saved chat settings. */
export interface ExportedChatSessionSettings {
  cid: string;
  cname: string;
  payload: PersistedChatSettingsPayload;
}
