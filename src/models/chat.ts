import type {
  ChatCompletionParams,
  ChatModelCapabilities,
  ChatModelCapabilityProfile,
  ChatModelConfig,
  ChatModelOption,
  ChatModelSettings,
  ConversationModelSnapshot,
  ModelParamDef,
  ParamDefaultValue,
} from "@/types/chat";
import { tr } from "@/i18n";
import { chatDisplayedCapabilityKeys, chatTurnCapabilityKeys, defaultModelCapabilities } from "@/constants/chat-model";
import { chatParamPresetList } from "@/constants/chat-params";
import { chatModelCatalog, type ChatModelCatalogItem } from "@/constants/model-list";
import {
  cloneJson,
  getLegacyProvider,
  getModelDeployment,
  getModelRequestId,
  parseParamValue,
  type LooseModelConfig,
} from "./common";

type LooseChatParamDef = Partial<ModelParamDef> & { key?: string };

export { chatDisplayedCapabilityKeys, chatTurnCapabilityKeys, defaultModelCapabilities };
export { getModelDeployment, getModelRequestId, parseParamValue as parseChatParamValue } from "./common";

/** Returns whether a user model config should use Azure OpenAI routing. */
export function isAzureChatModel(model: LooseModelConfig | null | undefined): model is LooseModelConfig & { provider: "Azure OpenAI" } {
  return getLegacyProvider(model) === "Azure OpenAI";
}

/** Returns whether a user model config should use direct OpenAI-compatible routing. */
export function isOpenAIChatModel(model: LooseModelConfig | null | undefined): model is LooseModelConfig & { provider: "OpenAI" } {
  return getLegacyProvider(model) === "OpenAI";
}

/** Returns whether a user model config should use Anthropic-compatible routing. */
export function isAnthropicChatModel(model: LooseModelConfig | null | undefined): model is LooseModelConfig & { provider: "Anthropic" | "Azure AI Foundry" } {
  const provider = getLegacyProvider(model);
  return provider === "Anthropic" || provider === "Azure AI Foundry";
}

/**
 * Normalizes loose/legacy chat model data into the canonical user config shape.
 *
 * This is still user configuration. It does not build provider runtime args.
 * It mainly fills defaults, migrates legacy field names, and narrows the
 * provider-specific fields to the stable `ChatModelConfig` union.
 */
export function normalizeChatModelConfig(model: LooseModelConfig | null | undefined = {}): ChatModelConfig {
  const data = model || {};
  const provider = getLegacyProvider(data);
  const nextProvider = provider === "Azure OpenAI" || provider === "Anthropic" || provider === "Azure AI Foundry" ? provider : "OpenAI";
  const modelId = getModelRequestId(data);
  const basePayload = {
    name: String(data.name || "").trim(),
    apiKey: String(data.apiKey || "").trim(),
    model: modelId,
    enabledCapabilitiesMode: data.enabledCapabilitiesMode === "custom" ? "custom" as const : "inherit" as const,
    enabledCapabilities: data.enabledCapabilities,
  };

  if (nextProvider === "Azure OpenAI") {
    return {
      ...basePayload,
      provider: "Azure OpenAI",
      endpoint: String(data.endpoint || "").trim(),
      deployment: String(data.deployment || "").trim(),
      apiVersion: String(data.apiVersion || "").trim(),
    };
  }

  return {
    ...basePayload,
    provider: nextProvider,
    baseURL: String(data.baseURL || "").trim(),
  };
}

function findChatModelCatalogItem(model = "", provider = ""): ChatModelCatalogItem | null {
  const normalizedModel = (model || "").trim().toLowerCase();
  const normalizedProvider = (provider || "").trim().toLowerCase();
  return (
    chatModelCatalog.find((item) => {
      const itemProvider = (item.provider || "").trim().toLowerCase();
      return item.value.toLowerCase() === normalizedModel && (!itemProvider || !normalizedProvider || itemProvider === normalizedProvider);
    }) || null
  );
}

/** Returns the full capability profile declared by the model catalog. */
export function getChatModelCapabilityProfile(model = "", provider = ""): ChatModelCapabilityProfile {
  const catalogItem = findChatModelCatalogItem(model, provider);
  return (
    catalogItem?.capabilityProfile || {
      modalities: {
        textInput: true,
        textOutput: true,
        imageInput: false,
        imageOutput: false,
        audioInput: false,
        audioOutput: false,
        videoInput: false,
        videoOutput: false,
      },
      features: {
        reasoning: false,
        streaming: true,
        functionCalling: false,
        structuredOutputs: false,
        fineTuning: false,
      },
      tools: {
        webSearch: false,
        imageGeneration: false,
        fileSearch: false,
        codeInterpreter: false,
        hostedShell: false,
        skills: false,
        mcp: false,
        applyPatch: false,
        computerUse: false,
        toolSearch: false,
      },
    }
  );
}

/**
 * Returns the capabilities declared by the built-in model catalog for a model id.
 *
 * These are support flags, not user toggles.
 */
export function getChatModelCapabilities(model = "", provider = "OpenAI"): ChatModelCapabilities {
  const profile = getChatModelCapabilityProfile(model, provider);
  const uiCapabilities: ChatModelCapabilities = {
    imageRead: profile.modalities.imageInput,
    webSearch: profile.tools.webSearch,
    reasoning: profile.features.reasoning,
    functionCalling: profile.features.functionCalling,
  };
  return normalizeModelCapabilities(uiCapabilities, { ...defaultModelCapabilities, ...uiCapabilities });
}

/**
 * Expands partial capability flags into the full capability object used by UI
 * and runtime helpers.
 */
export function normalizeModelCapabilities(
  capabilities: Partial<ChatModelCapabilities> | null | undefined = {},
  supported: ChatModelCapabilities = defaultModelCapabilities,
): ChatModelCapabilities {
  const next = { ...defaultModelCapabilities };
  (Object.keys(next) as (keyof ChatModelCapabilities)[]).forEach((key) => {
    next[key] = Boolean(supported[key] && (capabilities?.[key] ?? supported[key]));
  });
  return next;
}

/**
 * Resolves the user's capability override settings against the catalog support
 * flags for a model.
 *
 * In other words:
 * - `supported` answers "can this model do it?"
 * - the returned value answers "did the user leave it enabled?"
 */
export function resolveConfiguredModelCapabilities(
  model: Partial<Pick<LooseModelConfig, "enabledCapabilitiesMode" | "enabledCapabilities">> | null | undefined = {},
  supported: ChatModelCapabilities = defaultModelCapabilities,
): ChatModelCapabilities {
  if (model?.enabledCapabilitiesMode !== "custom") {
    return normalizeModelCapabilities(undefined, supported);
  }

  const next = { ...defaultModelCapabilities };
  (Object.keys(next) as (keyof ChatModelCapabilities)[]).forEach((key) => {
    next[key] = Boolean(supported[key] && model?.enabledCapabilities?.[key]);
  });
  return next;
}

/**
 * Applies per-turn toggles on top of a model's supported and user-enabled
 * capabilities to get the effective capability set for one send action.
 */
export function getEffectiveCapabilities(
  supported: Partial<ChatModelCapabilities> | null | undefined,
  enabled: Partial<ChatModelCapabilities> | null | undefined,
  turnOptions: Partial<ChatModelCapabilities> | null | undefined = {},
): ChatModelCapabilities {
  const supportedCaps = normalizeModelCapabilities(supported, { ...defaultModelCapabilities, ...supported });
  const enabledCaps = normalizeModelCapabilities(enabled, supportedCaps);
  const next = { ...defaultModelCapabilities };
  (Object.keys(next) as (keyof ChatModelCapabilities)[]).forEach((key) => {
    if (chatTurnCapabilityKeys.includes(key)) {
      next[key] = Boolean(supportedCaps[key] && enabledCaps[key] && turnOptions?.[key]);
    } else {
      next[key] = Boolean(supportedCaps[key] && enabledCaps[key]);
    }
  });
  return next;
}

/**
 * Creates the conversation model snapshot persisted with one chat session.
 *
 * The snapshot stores only the user-selected model identity/config needed to
 * lock the conversation to a stable model. Derived runtime data is intentionally
 * excluded and recomputed later from `modelConfig`.
 */
export function createConversationModelSnapshot(
  model: LooseModelConfig | null | undefined,
): ConversationModelSnapshot | null {
  const modelConfig = normalizeChatModelConfig(model);
  if (!modelConfig?.name || !modelConfig?.apiKey) return null;

  const modelId = getModelRequestId(modelConfig);
  const modelConfigId = `${modelConfig.provider}:${modelConfig.name}:${modelId}:${getModelDeployment(modelConfig) || modelId}`;

  return {
    modelConfigId,
    catalogModelId: modelId,
    displayName: modelConfig.name || modelId,
    provider: modelConfig.provider,
    apiKey: modelConfig.apiKey,
    modelConfig,
  };
}

/** Restores canonical user model config from a saved conversation snapshot. */
export function getModelFromSnapshot(snapshot: ConversationModelSnapshot | null | undefined): ChatModelConfig | null {
  return snapshot?.modelConfig ? normalizeChatModelConfig(snapshot.modelConfig) : null;
}

/**
 * Returns catalog-supported capabilities for the model bound to a conversation.
 *
 * This is derived on demand from the snapshot's `modelConfig`.
 */
export function getSnapshotSupportedCapabilities(snapshot: ConversationModelSnapshot | null | undefined): ChatModelCapabilities {
  const model = getModelFromSnapshot(snapshot);
  if (!model) return { ...defaultModelCapabilities };
  return getChatModelCapabilities(model.model, model.provider);
}

/**
 * Returns user-enabled capabilities for the model bound to a conversation.
 *
 * This combines the snapshot model config with catalog support flags.
 */
export function getSnapshotEnabledCapabilities(snapshot: ConversationModelSnapshot | null | undefined): ChatModelCapabilities {
  const model = getModelFromSnapshot(snapshot);
  if (!model) return { ...defaultModelCapabilities };
  return resolveConfiguredModelCapabilities(model, getSnapshotSupportedCapabilities(snapshot));
}

/**
 * Returns the request parameter definitions for the model bound to a conversation.
 *
 * This is derived from the snapshot model config and current model catalog.
 */
export function getSnapshotChatParamDefs(snapshot: ConversationModelSnapshot | null | undefined): ModelParamDef[] {
  const model = getModelFromSnapshot(snapshot);
  return model ? getModelChatParamDefs(model) : [];
}

/** Returns display/protocol metadata for a chat model id from the built-in catalog. */
export function getChatModelInfo(model = "", provider = ""): ChatModelOption {
  const catalogItem = findChatModelCatalogItem(model, provider);
  if (catalogItem) {
    const { value, name, isReasonModel, msgTypeVersion, capabilityProfile, capabilities } = catalogItem;
    return { value, name, isReasonModel, msgTypeVersion, capabilityProfile, capabilities };
  }

  return {
    value: model,
    name: model,
    isReasonModel: false,
    msgTypeVersion: "v2",
    capabilityProfile: getChatModelCapabilityProfile(model, provider),
    capabilities: { webSearch: false, reasoning: false, imageRead: false },
  };
}

function createDefaultChatPrompts(): ChatModelSettings["prompts"] {
  return [{ role: "system", content: [{ type: "text", text: tr("chat.defaultSystemPrompt") }] }];
}

function createDefaultChatSettings(): ChatModelSettings {
  return {
    passedMsgLen: 10,
    prompts: createDefaultChatPrompts(),
  };
}

function getChatParamPreset(key = ""): LooseChatParamDef | null {
  return chatParamPresetList.find((item) => item.key === key) || null;
}

/** Merges a raw chat parameter definition with the built-in preset defaults. */
export function normalizeChatParamDef(def: LooseChatParamDef = {}): ModelParamDef {
  const preset = getChatParamPreset(def.key);
  const nextType = def.type || preset?.type || "string";
  const nextDefaultValue = parseParamValue<ParamDefaultValue>(nextType, def.defaultValue, cloneJson(preset?.defaultValue ?? ""));

  return {
    key: String(def.key || preset?.key || "").trim(),
    label: String(def.label || preset?.label || def.key || "").trim(),
    type: nextType,
    description: String(def.description || preset?.description || "").trim(),
    descriptionKey: String(def.descriptionKey || preset?.descriptionKey || "").trim(),
    placeholder: String(def.placeholder || preset?.placeholder || "").trim(),
    defaultValue: nextDefaultValue,
    min: parseParamValue("number", def.min, preset?.min ?? 0),
    max: parseParamValue("number", def.max, preset?.max ?? 1),
    step: parseParamValue("number", def.step, preset?.step ?? 1),
  };
}

/** Returns default parameter definitions declared for a catalog model id. */
export function getDefaultChatParamDefs(model = "", provider = ""): ModelParamDef[] {
  return getChatParamKeysForModel(model, provider).map((key) => normalizeChatParamDef({ key }));
}

/** Returns request parameter keys declared for a catalog model id. */
export function getChatParamKeysForModel(model = "", provider = ""): string[] {
  return [...(findChatModelCatalogItem(model, provider)?.chatParamKeys || [])];
}

/**
 * Returns normalized parameter definitions for a configured chat model.
 *
 * If the model carries custom parameter definitions they win; otherwise the
 * built-in catalog definitions are used.
 */
export function getModelChatParamDefs(model: LooseModelConfig = {}): ModelParamDef[] {
  const provider = getLegacyProvider(model);
  const modelId = getModelRequestId(model);
  const hasCustomDefs = Array.isArray(model?.chatParamDefs) && model.chatParamDefs.length > 0;
  const defs = hasCustomDefs ? model.chatParamDefs : getDefaultChatParamDefs(modelId, provider);
  const seen = new Set();
  const supportedKeys = new Set(hasCustomDefs ? model.chatParamDefs.map((item) => item.key).filter(Boolean) : getChatParamKeysForModel(modelId, provider));

  return defs
    .map((item) => normalizeChatParamDef(item))
    .filter((item) => item.key && supportedKeys.has(item.key) && !seen.has(item.key) && (seen.add(item.key), true));
}

/**
 * Builds the initial settings object for a chat model.
 *
 * The result contains app-level defaults plus one entry for each resolved model
 * request parameter definition.
 */
export function buildDefaultChatSettings(model: LooseModelConfig | null = null): ChatModelSettings {
  const settings = cloneJson(createDefaultChatSettings());
  const defs = getModelChatParamDefs(model || {});

  defs.forEach((item) => {
    settings[item.key] = cloneJson(item.defaultValue);
  });

  return settings;
}

/**
 * Merges saved chat settings with defaults derived from the active model.
 *
 * This is the main normalization step used before rendering settings UI and
 * before building runtime request params.
 */
export function mergeChatSettingsWithModel(model: LooseModelConfig | null = null, settings: Partial<ChatModelSettings> = {}): ChatModelSettings {
  const defaultSettings = createDefaultChatSettings();
  const defs = getModelChatParamDefs(model || {});
  const nextSettings = { ...settings };
  if (defs.some((item) => item.key === "max_completion_tokens") && !("max_completion_tokens" in nextSettings) && "max_tokens" in nextSettings) {
    nextSettings.max_completion_tokens = nextSettings.max_tokens;
  }

  const coreSettings: Partial<ChatModelSettings> = {
    prompts: Array.isArray(nextSettings.prompts) ? nextSettings.prompts : undefined,
    passedMsgLen: nextSettings.passedMsgLen,
  };
  const mergedSettings = {
    ...cloneJson(defaultSettings),
    ...buildDefaultChatSettings(model),
    ...nextSettings,
    ...coreSettings,
  };

  defs.forEach((item) => {
    mergedSettings[item.key] = parseParamValue(item.type, mergedSettings[item.key], cloneJson(item.defaultValue));
  });

  if (!Array.isArray(mergedSettings.prompts)) {
    mergedSettings.prompts = cloneJson(defaultSettings.prompts);
  }

  if (!Number.isFinite(Number(mergedSettings.passedMsgLen))) {
    mergedSettings.passedMsgLen = defaultSettings.passedMsgLen;
  } else {
    mergedSettings.passedMsgLen = Number(mergedSettings.passedMsgLen);
  }

  return mergedSettings;
}

/**
 * Builds provider request params from user chat settings.
 *
 * This is the boundary where user-facing settings are transformed into the
 * runtime request body fields expected by provider clients.
 */
export function buildChatCompletionParams(model: LooseModelConfig | null = null, settings: Partial<ChatModelSettings> = {}): ChatCompletionParams {
  const defs = getModelChatParamDefs(model || {});
  const mergedSettings = mergeChatSettingsWithModel(model, settings);
  const params: ChatCompletionParams = {};

  defs.forEach((item) => {
    const value = parseParamValue(item.type, mergedSettings[item.key], cloneJson(item.defaultValue));

    if (value === undefined || value === null) return;
    if (item.type === "string" && value === "") return;
    if (item.type === "array" && !Array.isArray(value)) return;

    params[item.key] = value;
  });

  return {
    ...params,
    stream: true,
    stream_options: { include_usage: true },
  };
}
