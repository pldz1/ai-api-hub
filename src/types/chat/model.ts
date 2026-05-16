import type {
  CapabilityOverrideMode,
  ChatMessageRole,
  ChatModelCapabilities,
  ChatModelCapabilityProfile,
  ChatModelProvider,
  ChatFormProvider,
  ModelParamDef,
  ParamDefaultValue,
  SelectOption,
} from "./shared";
import type { ChatProviderPayload } from "./provider";

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
  capabilities: Pick<ChatModelCapabilities, "webSearch" | "reasoning" | "imageRead">;
}

/** Chat model plus resolved parameter definitions used by runtime/settings UI. */
export interface ChatModelResolvedFields {
  chatParamDefs: ModelParamDef[];
}

/**
 * Canonical chat model configuration owned by the user.
 *
 * This intentionally aliases the persisted provider payload rather than a
 * separate draft/runtime-only type.
 */
export type ChatModelConfig = ChatProviderPayload;
export type ResolvedChatModelConfig = ChatModelConfig & ChatModelResolvedFields;

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

/** Text-only prompt content used in stored system prompts. */
export interface PromptContent {
  type: "text";
  text: string;
}

/** Stored prompt message used by chat settings. */
export interface PromptMessage {
  role: ChatMessageRole;
  content: PromptContent[];
}

/**
 * Canonical value type for one user-configurable chat parameter.
 *
 * This is shared by settings state and the normalized request-param bag built
 * from those settings.
 */
export type ChatParamValue = ParamDefaultValue | undefined;
export type ChatParamRecord = Record<string, ChatParamValue>;

/** Stream options appended by runtime when building provider request params. */
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

/**
 * Per-conversation chat settings merged with a model's parameter definitions.
 *
 * `passedMsgLen` and `prompts` are stable app-level fields; the index signature
 * holds model-specific request parameters such as temperature or max tokens.
 */
export interface ChatModelSettings extends ChatParamRecord {
  passedMsgLen: number;
  prompts: PromptMessage[];
}
