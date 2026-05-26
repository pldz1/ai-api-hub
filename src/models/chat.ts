import type { ChatCompletionParams, ChatModelCapabilities, ChatModelCapabilityProfile, ChatModelConfig, ModelParamDef, ParamDefaultValue } from "@/ai-capability/chat/types";
import type { ChatModelOption, ChatModelSettings, ConversationModelSnapshot } from "@/types";
import { tr } from "@/i18n";
import { chatParamPresetList, defaultModelCapabilities, chatModelCatalog, type ChatModelCatalogItem, baseCapabilityProfile } from "@/constants";
import { LooseModelConfig, parseParamValue } from "./common";

type LooseChatParamDef = Partial<ModelParamDef> & { key?: string };

/** Returns whether a user model config should use Azure OpenAI routing. */
export function isAzureChatModel(model: ChatModelConfig | null | undefined): model is ChatModelConfig & { provider: "Azure OpenAI" } {
  return model?.provider === "Azure OpenAI";
}

/** Returns whether a user model config should use direct OpenAI-compatible routing. */
export function isOpenAIChatModel(model: ChatModelConfig | null | undefined): model is ChatModelConfig & { provider: "OpenAI" } {
  return model?.provider === "OpenAI";
}

/** Returns whether a user model config should use Anthropic-compatible routing. */
export function isAnthropicChatModel(model: LooseModelConfig | null | undefined): model is LooseModelConfig & { provider: "Anthropic" | "Azure AI Foundry" } {
  const provider = model?.provider;
  return provider === "Anthropic" || provider === "Azure AI Foundry";
}

/** Returns the Azure deployment name used when building Azure runtime config. */
export function getModelDeployment(model: { deployment?: string; model?: string; provider?: string } | null | undefined): string {
  return String(model?.deployment || "").trim();
}

/**
 * Normalizes loose/legacy chat model data into the canonical user config shape.
 *
 * This is still user configuration. It does not build provider runtime args.
 * It mainly fills defaults, migrates legacy field names, and narrows the
 * provider-specific fields to the stable `ChatModelConfig` union.
 */
export function normalizeChatModelConfig(model: LooseModelConfig | null | undefined = {}): ChatModelConfig {
  const provider = model?.provider;
  const nextProvider = provider === "Azure OpenAI" || provider === "Anthropic" || provider === "Azure AI Foundry" ? provider : "OpenAI";
  const modelId = model?.model;
  const basePayload = {
    name: String(model?.name || "").trim(),
    apiKey: String(model?.apiKey || "").trim(),
    model: modelId,
    enabledCapabilitiesMode: model?.enabledCapabilitiesMode === "custom" ? ("custom" as const) : ("inherit" as const),
    enabledCapabilities: model?.enabledCapabilities,
  };

  if (nextProvider === "Azure OpenAI") {
    return {
      ...basePayload,
      provider: "Azure OpenAI",
      endpoint: String(model?.endpoint || "").trim(),
      deployment: String(model?.deployment || "").trim(),
      apiVersion: String(model?.apiVersion || "").trim(),
    };
  }

  return {
    ...basePayload,
    provider: nextProvider,
    baseURL: String(model?.baseURL || "").trim(),
  };
}

function findChatModelCatalogItem(model = "", provider = ""): ChatModelCatalogItem | null {
  const targetModel = model.trim().toLowerCase();
  const targetProvider = provider.trim().toLowerCase();

  if (!targetModel) return null;

  return (
    chatModelCatalog.find((item) => {
      const itemModel = item.value.toLowerCase();
      const itemProvider = item.provider?.trim().toLowerCase() ?? "";

      if (itemModel !== targetModel) return false;

      if (targetProvider && itemProvider !== targetProvider) return false;

      return true;
    }) ?? null
  );
}

/** Returns the full capability profile declared by the model catalog. */
export function getChatModelCapabilityProfile(model = "", provider = ""): ChatModelCapabilityProfile {
  const catalogItem = findChatModelCatalogItem(model, provider);
  return catalogItem?.capabilityProfile || baseCapabilityProfile;
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
    next[key] = Boolean(supportedCaps[key] && enabledCaps[key]);
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
export function createConversationModelSnapshot(model: LooseModelConfig | null | undefined): ConversationModelSnapshot | null {
  const modelConfig = normalizeChatModelConfig(model);
  if (!modelConfig?.name || !modelConfig?.apiKey) return null;

  const modelId = modelConfig.model;
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
    capabilities: { webSearch: false, imageRead: false },
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
  const nextDefaultValue = parseParamValue<ParamDefaultValue>(nextType, def.defaultValue, structuredClone(preset?.defaultValue ?? ""));

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
  const provider = model?.provider;
  const modelId = model?.model;
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
  const settings = structuredClone(createDefaultChatSettings());
  const defs = getModelChatParamDefs(model || {});

  defs.forEach((item) => {
    settings[item.key] = structuredClone(item.defaultValue);
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

  const coreSettings: Partial<ChatModelSettings> = {
    prompts: Array.isArray(nextSettings.prompts) ? nextSettings.prompts : undefined,
    passedMsgLen: nextSettings.passedMsgLen,
  };
  const mergedSettings = {
    ...structuredClone(defaultSettings),
    ...buildDefaultChatSettings(model),
    ...nextSettings,
    ...coreSettings,
  };

  defs.forEach((item) => {
    mergedSettings[item.key] = parseParamValue(item.type, mergedSettings[item.key], structuredClone(item.defaultValue));
  });

  if (!Array.isArray(mergedSettings.prompts)) {
    mergedSettings.prompts = structuredClone(defaultSettings.prompts);
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
    const value = parseParamValue(item.type, mergedSettings[item.key], structuredClone(item.defaultValue));

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
