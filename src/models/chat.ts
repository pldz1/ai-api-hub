import type {
  ChatCompletionParams,
  ChatModelCapabilities,
  ChatModelConfig,
  ModelParamDef,
  ParamDefaultValue,
  ChatModelSettings,
  ConversationModelSnapshot,
  LooseModelConfig,
} from "@/types";
import { tr } from "@/i18n";
import { chatParamPresetList, defaultModelCapabilities, chatModelCatalog, type ChatModelCatalogItem, baseCapabilityProfile } from "@/constants";
import { parseParamValue } from "./settings";

type LooseChatParamDef = Partial<ModelParamDef> & { key?: string };
const chatParamDefMap = new Map(chatParamPresetList.map((item) => [item.key, item] as const));

import {
  chatProviderUsesField,
  getChatProviderDefinition,
  getChatProviderDefaultBaseURL,
  getChatProviderModelFamilies,
  getChatProviderModelFamily,
  getChatProvidersForModel,
  getKnownChatProviderDefaultBaseURLs,
  isChatModelProvider,
  getChatProviderConnectionFields,
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
  const nextProvider = isChatModelProvider(provider) ? provider : "OpenAI";
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

export function findChatModelCatalogItem(model = ""): ChatModelCatalogItem | null {
  const targetModel = model.trim().toLowerCase();

  if (!targetModel) return null;

  return (
    chatModelCatalog.find((item) => {
      const itemModel = item.name.toLowerCase();

      if (itemModel !== targetModel) return false;

      return true;
    }) ?? null
  );
}

/**
 * Returns the capabilities declared by the built-in model catalog for a model id.
 *
 * These are support flags, not user toggles.
 */
export function getChatModelCapabilities(model = ""): ChatModelCapabilities {
  const profile = findChatModelCatalogItem(model)?.capabilityProfile || baseCapabilityProfile;
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
  return (findChatModelCatalogItem(model?.model || "")?.chatParamKeys || []).map((key) => normalizedChatParamDefs.get(key)).filter(Boolean) as ModelParamDef[];
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
  getChatProviderModelFamilies,
  getChatProviderModelFamily,
  getChatProvidersForModel,
  getKnownChatProviderDefaultBaseURLs,
  isChatModelProvider,
  getChatProviderConnectionFields,
};
