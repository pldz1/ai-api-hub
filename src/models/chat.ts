import type {
  ChatCompletionParams,
  ChatModelCapabilities,
  ChatModelConfig,
  ChatModelProvider,
  ModelParamDef,
  ParamDefaultValue,
  ChatModelSettings,
  ConversationModelSnapshot,
  LooseModelConfig,
} from "@/types";
import { tr } from "@/i18n";
import { chatParamPresetList, defaultModelCapabilities, chatModelCatalog, type ChatModelCatalogItem } from "@/constants";
import { parseParamValue } from "./settings";

type LooseChatParamDef = Partial<ModelParamDef> & { key?: string };
type ChatModelCatalogProvider = ChatModelCatalogItem["providers"][number];
const chatParamDefMap = new Map(chatParamPresetList.map((item) => [item.key, item] as const));

import {
  chatProviderUsesField,
  getChatProviderCapabilities,
  getChatProviderChatParamKeys,
  getChatProviderDefinition,
  getChatProviderDefaultBaseURL,
  getChatProviderMessageFormat,
  getKnownChatProviderDefaultBaseURLs,
  isChatModelProvider,
  getChatProviderConnectionFields,
  chatProviderKeys,
} from "@/ai-capability/chat";

/** Returns whether a user model config should use Azure OpenAI routing. */
export function isAzureChatModel(model: ChatModelConfig | null | undefined): model is ChatModelConfig & { provider: "Azure OpenAI" } {
  return model?.provider === "Azure OpenAI";
}

/** Returns whether a user model config should use direct OpenAI-compatible routing. */
export function isOpenAIChatModel(model: ChatModelConfig | null | undefined): model is ChatModelConfig & { provider: "OpenAI" } {
  return model?.provider === "OpenAI";
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
  const normalizedProvider = String(provider || "") === "Qwen" ? "DashScope" : provider;
  const nextProvider = isChatModelProvider(normalizedProvider) ? normalizedProvider : "OpenAI";
  const modelId = model?.model;
  const basePayload = {
    name: String(model?.name || "").trim(),
    apiKey: String(model?.apiKey || "").trim(),
    model: modelId,
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

export function findChatModelCatalogItems(model = ""): ChatModelCatalogItem[] {
  const targetModel = model.trim().toLowerCase();

  if (!targetModel) return [];

  return chatModelCatalog.filter((item) => item.name.toLowerCase() === targetModel);
}

export function findChatModelCatalogItem(model = "", provider?: ChatModelProvider | null): ChatModelCatalogItem | null {
  const catalogItems = findChatModelCatalogItems(model);
  if (!catalogItems.length) return null;
  if (!provider) return catalogItems[0] || null;
  return catalogItems.find((item) => item.providers.some((itemProvider) => itemProvider.provider === provider)) || catalogItems[0] || null;
}

export function findChatModelCatalogProvider(model = "", provider?: ChatModelProvider | null): ChatModelCatalogProvider | null {
  const catalogItem = findChatModelCatalogItem(model, provider);
  if (!catalogItem) return null;
  if (!provider) return catalogItem.providers[0] || null;
  return catalogItem.providers.find((itemProvider) => itemProvider.provider === provider) || catalogItem.providers[0] || null;
}

export function getChatProvidersForModel(model = ""): ChatModelProvider[] {
  const catalogItem = findChatModelCatalogItem(model);
  if (!catalogItem) return chatProviderKeys.filter((provider) => getChatProviderDefinition(provider)?.supportsCustomModels);
  return catalogItem.providers.map((itemProvider) => itemProvider.provider);
}

function mergeChatCapabilities(capabilitiesList: Partial<ChatModelCapabilities>[]): ChatModelCapabilities {
  return capabilitiesList.reduce<ChatModelCapabilities>(
    (merged, capabilities) => ({
      imageRead: Boolean(merged.imageRead || capabilities.imageRead),
      webSearch: Boolean(merged.webSearch || capabilities.webSearch),
    }),
    { ...defaultModelCapabilities },
  );
}

/**
 * Returns chat capabilities supplied by the selected provider/runtime bridge.
 *
 * These are app support flags, not model parameters or user toggles. Catalog
 * models resolve capability from the selected model/provider pair; unknown
 * custom models fall back to provider defaults.
 */
export function getChatModelCapabilities(model: LooseModelConfig | string | null | undefined = null): ChatModelCapabilities {
  if (typeof model !== "string") {
    const modelProvider = isChatModelProvider(model?.provider) ? model.provider : null;
    const catalogCapabilities = findChatModelCatalogProvider(model?.model || "", modelProvider)?.capabilities;
    if (catalogCapabilities) return normalizeModelCapabilities(catalogCapabilities, { ...defaultModelCapabilities, ...catalogCapabilities });

    const providerCapabilities = getChatProviderCapabilities(model?.provider, model || {});
    if (providerCapabilities) return normalizeModelCapabilities(providerCapabilities, { ...defaultModelCapabilities, ...providerCapabilities });
  }

  const modelId = typeof model === "string" ? model : model?.model || "";
  const modelProvider = typeof model === "string" ? getChatProvidersForModel(modelId)[0] : isChatModelProvider(model?.provider) ? model.provider : null;
  const catalogCapabilities = findChatModelCatalogProvider(modelId, modelProvider)?.capabilities;
  const fallbackCapabilities = modelProvider ? getChatProviderCapabilities(modelProvider, { model: modelId }) : null;
  const catalogProviderCapabilities = [catalogCapabilities || fallbackCapabilities].filter(Boolean) as ChatModelCapabilities[];
  const mergedCapabilities = mergeChatCapabilities(catalogProviderCapabilities);
  return normalizeModelCapabilities(mergedCapabilities, { ...defaultModelCapabilities, ...mergedCapabilities });
}

export function getChatMessageFormat(model: LooseModelConfig | string | null | undefined = null): "text" | "parts" {
  if (typeof model !== "string") {
    const catalogFormat = findChatModelCatalogItem(model?.model || "")?.messageFormat;
    if (catalogFormat) return catalogFormat;
    const providerFormat = getChatProviderMessageFormat(model?.provider, model || {});
    if (providerFormat) return providerFormat;
  }

  const modelId = typeof model === "string" ? model : model?.model || "";
  const provider = typeof model === "string" ? getChatProvidersForModel(modelId)[0] : isChatModelProvider(model?.provider) ? model.provider : null;
  const catalogFormat = findChatModelCatalogItem(modelId, provider)?.messageFormat;
  if (catalogFormat) return catalogFormat;
  return provider ? getChatProviderMessageFormat(provider, { model: modelId }) || "parts" : "parts";
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
    next[key] = Boolean(supportedCaps[key] && enabledCaps[key] && (turnOptions?.[key] ?? enabledCaps[key]));
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

/** Merges a raw chat parameter definition with the built-in preset defaults. */
export function normalizeChatParamDef(def: LooseChatParamDef = {}): ModelParamDef {
  const preset = chatParamDefMap.get(def.key || "") || null;
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

const normalizedChatParamDefs = new Map(chatParamPresetList.map((item) => [item.key, normalizeChatParamDef(item)] as const));

export function resolveChatParamDefs(model: LooseModelConfig | null = null): ModelParamDef[] {
  const catalogParamKeys = findChatModelCatalogItem(model?.model || "")?.chatParamKeys || [];
  const providerParamKeys = getChatProviderChatParamKeys(model?.provider, model || {});
  const modelProvider = isChatModelProvider(model?.provider) ? model.provider : null;
  const fallbackProvider = modelProvider || getChatProvidersForModel(model?.model || "")[0];
  const paramKeys = catalogParamKeys.length
    ? catalogParamKeys
    : providerParamKeys.length
      ? providerParamKeys
      : fallbackProvider
        ? getChatProviderChatParamKeys(fallbackProvider, { model: model?.model || "" })
        : [];
  return paramKeys.map((key) => normalizedChatParamDefs.get(key)).filter(Boolean) as ModelParamDef[];
}

function mergeResolvedChatSettings(defs: ModelParamDef[], settings: Partial<ChatModelSettings> = {}): ChatModelSettings {
  const defaultSettings: ChatModelSettings = {
    passedMsgLen: 10,
    prompts: [{ role: "system", content: [{ type: "text", text: tr("chat.defaultSystemPrompt") }] }],
  };
  const nextSettings = { ...settings };

  defs.forEach((item) => {
    defaultSettings[item.key] = structuredClone(item.defaultValue);
  });

  const coreSettings: Partial<ChatModelSettings> = {
    prompts: Array.isArray(nextSettings.prompts) ? nextSettings.prompts : undefined,
    passedMsgLen: nextSettings.passedMsgLen,
  };
  const mergedSettings = {
    ...structuredClone(defaultSettings),
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
 * Merges saved chat settings with defaults derived from the active model.
 *
 * This is the main normalization step used before rendering settings UI and
 * before building runtime request params.
 */
export function mergeChatSettingsWithModel(model: LooseModelConfig | null = null, settings: Partial<ChatModelSettings> = {}): ChatModelSettings {
  return mergeResolvedChatSettings(resolveChatParamDefs(model), settings);
}

/**
 * Builds provider request params from user chat settings.
 *
 * This is the boundary where user-facing settings are transformed into the
 * runtime request body fields expected by provider clients.
 */
export function buildChatCompletionParams(model: LooseModelConfig | null = null, settings: Partial<ChatModelSettings> = {}): ChatCompletionParams {
  const defs = resolveChatParamDefs(model);
  const mergedSettings = mergeResolvedChatSettings(defs, settings);
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

// export functions from provider registry for convenience in other modules that consume chat models and capabilities.
export {
  chatProviderUsesField,
  getChatProviderDefinition,
  getChatProviderDefaultBaseURL,
  getKnownChatProviderDefaultBaseURLs,
  getChatProviderCapabilities,
  getChatProviderChatParamKeys,
  getChatProviderMessageFormat,
  isChatModelProvider,
  getChatProviderConnectionFields,
};
