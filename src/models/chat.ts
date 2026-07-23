import type {
  ChatCompletionParams,
  ChatModelCapabilities,
  ChatModelConfig,
  ChatModelProvider,
  ModelParamDef,
  ParamDefaultValue,
  ChatModelSettings,
  ChatModelSnapshot,
  LooseModelConfig,
} from "@/types";
import { tr } from "@/i18n";
import { chatParamList, defaultModelCapabilities } from "@/ai-capability/chat";
import { parseParamValue } from "./settings";

type LooseChatParamDef = Partial<ModelParamDef> & { key?: string };
const chatParamDefMap = new Map(chatParamList.map((item) => [item.key, item] as const));

import {
  chatProviderUsesField,
  findChatModelBinding,
  findChatModelBindings,
  resolveChatModel,
  getChatProviderDefinition,
  getChatProviderDefaultBaseURL,
  getKnownChatProviderDefaultBaseURLs,
  isChatModelProvider,
  getChatProviderConnectionFields,
  chatProviderKeys,
} from "@/ai-capability/chat";

/** Returns whether a user model config should use direct OpenAI-compatible routing. */
export function isOpenAIChatModel(model: ChatModelConfig | null | undefined): model is ChatModelConfig & { provider: "OpenAI" } {
  return model?.provider === "OpenAI";
}

/**
 * Normalizes loose chat model data into the canonical user config shape.
 *
 * This is still user configuration. It does not build provider runtime args.
 * It mainly fills defaults and narrows the provider to the stable
 * `ChatModelConfig` shape.
 */
export function normalizeChatModelConfig(model: LooseModelConfig | null | undefined = {}): ChatModelConfig {
  const provider = model?.provider;
  const nextProvider = isChatModelProvider(provider) ? provider : "OpenAI";
  return {
    name: String(model?.name || "").trim(),
    provider: nextProvider,
    baseURL: String(model?.baseURL || "").trim(),
    apiKey: String(model?.apiKey || "").trim(),
    model: String(model?.model || "").trim(),
  };
}

export function getChatProvidersForModel(model = ""): ChatModelProvider[] {
  const bindings = findChatModelBindings(model);
  if (!bindings.length) return chatProviderKeys;
  return bindings.map((binding) => binding.provider);
}

export function getChatModelCapabilities(model: LooseModelConfig | string | null | undefined = null): ChatModelCapabilities {
  const binding =
    typeof model === "string"
      ? findChatModelBinding(model)
      : resolveChatModel(normalizeChatModelConfig(model || {}))?.binding || null;
  if (!binding) return { ...defaultModelCapabilities };
  return normalizeModelCapabilities(binding.capabilities, { ...defaultModelCapabilities, ...binding.capabilities });
}

export function getChatMessageFormat(model: LooseModelConfig | string | null | undefined = null): "text" | "parts" {
  const binding =
    typeof model === "string"
      ? findChatModelBinding(model)
      : resolveChatModel(normalizeChatModelConfig(model || {}))?.binding || null;
  return binding?.messageFormat || "text";
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
 * Creates the latest-selected chat model snapshot persisted with one conversation.
 *
 * The snapshot stores only the user-selected model identity/config needed to
 * restore the composer when that conversation is reopened. Each Run records its
 * own execution model separately. Derived runtime data is intentionally excluded.
 */
export function createChatModelSnapshot(model: LooseModelConfig | null | undefined): ChatModelSnapshot | null {
  const modelConfig = normalizeChatModelConfig(model);
  if (!modelConfig?.name || !modelConfig?.apiKey) return null;

  const modelId = modelConfig.model;
  const modelConfigId = `${modelConfig.provider}:${modelConfig.name}:${modelId}:${modelConfig.baseURL || modelId}`;

  return {
    modelConfigId,
    catalogModelId: modelId,
    displayName: modelConfig.name || modelId,
    provider: modelConfig.provider,
    apiKey: modelConfig.apiKey,
    modelConfig,
  };
}

/** Restores canonical user model config from a saved chat snapshot. */
export function getModelFromSnapshot(snapshot: ChatModelSnapshot | null | undefined): ChatModelConfig | null {
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

const normalizedChatParamDefs = new Map(chatParamList.map((item) => [item.key, normalizeChatParamDef(item)] as const));

export function resolveChatParamDefs(model: LooseModelConfig | null = null): ModelParamDef[] {
  const paramKeys = resolveChatModel(normalizeChatModelConfig(model || {}))?.binding.paramKeys || [];
  return paramKeys.map((key) => normalizedChatParamDefs.get(key)).filter(Boolean) as ModelParamDef[];
}

function mergeResolvedChatSettings(defs: ModelParamDef[], settings: Partial<ChatModelSettings> = {}): ChatModelSettings {
  const defaultSettings: ChatModelSettings = {
    passedMsgLen: 10,
    prompts: [{ role: "system", content: [{ type: "text", text: tr("chat.defaultSystemPrompt") }] }],
  };

  defs.forEach((item) => {
    defaultSettings[item.key] = structuredClone(item.defaultValue);
  });

  const mergedSettings = structuredClone(defaultSettings);
  const firstPrompt = settings.prompts?.[0];
  if (firstPrompt?.content?.[0]?.type === "text") {
    mergedSettings.prompts = settings.prompts.map((prompt) => ({
      ...prompt,
      content: prompt.content.map((part) => ({ ...part })),
    }));
  }
  if (Number.isFinite(Number(settings.passedMsgLen))) mergedSettings.passedMsgLen = Number(settings.passedMsgLen);

  defs.forEach((item) => {
    mergedSettings[item.key] = parseParamValue(item.type, settings[item.key], structuredClone(item.defaultValue));
  });

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
  isChatModelProvider,
  getChatProviderConnectionFields,
};
