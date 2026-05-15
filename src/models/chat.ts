import type {
  ChatModelCapabilities,
  ChatModelConfig,
  ChatModelOption,
  ChatModelSettings,
  ConversationModelSnapshot,
  ModelFormDraft,
  ModelParamDef,
} from "@/types/model";
import { tr } from "@/i18n";
import { chatDisplayedCapabilityKeys, chatTurnCapabilityKeys, defaultModelCapabilities } from "@/constants/chat-model";
import { chatParamPresetList } from "@/constants/chat-params";
import { chatModelCatalog, type ChatModelCatalogItem } from "@/constants/model-list";
import {
  cloneJson,
  getLegacyProvider,
  getModelDeployment,
  getModelRequestId,
  normalizeModelFormDraft,
  parseParamValue,
  type LooseModelConfig,
  type LooseParamDef,
} from "./common";

export { chatDisplayedCapabilityKeys, chatTurnCapabilityKeys, defaultModelCapabilities };
export { getModelDeployment, getModelRequestId, parseParamValue as parseChatParamValue } from "./common";

/** Returns whether a model config should use Azure OpenAI request routing. */
export function isAzureChatModel(model: LooseModelConfig | null | undefined): model is LooseModelConfig & { provider: "Azure OpenAI" } {
  return getLegacyProvider(model) === "Azure OpenAI";
}

/** Returns whether a model config should use OpenAI-compatible request routing. */
export function isOpenAIChatModel(model: LooseModelConfig | null | undefined): model is LooseModelConfig & { provider: "OpenAI" } {
  return getLegacyProvider(model) === "OpenAI";
}

/** Returns whether a model config should use Anthropic-compatible request routing. */
export function isAnthropicChatModel(model: LooseModelConfig | null | undefined): model is LooseModelConfig & { provider: "Anthropic" | "Azure AI Foundry" } {
  const provider = getLegacyProvider(model);
  return provider === "Anthropic" || provider === "Azure AI Foundry";
}

/** Coerces persisted chat config into the runtime chat model shape. */
export function toRuntimeChatModelConfig(model: LooseModelConfig | null | undefined = {}): ChatModelConfig {
  const draft = normalizeModelFormDraft(model);
  const provider = draft.provider === "Azure OpenAI" || draft.provider === "Anthropic" || draft.provider === "Azure AI Foundry" ? draft.provider : "OpenAI";
  const modelId = getModelRequestId(draft);

  if (provider === "Azure OpenAI") {
    return {
      name: draft.name,
      provider,
      endpoint: draft.endpoint,
      deployment: draft.deployment,
      apiVersion: draft.apiVersion,
      apiKey: draft.apiKey,
      model: modelId,
      enabledCapabilitiesMode: draft.enabledCapabilitiesMode,
      enabledCapabilities: draft.enabledCapabilities,
    };
  }

  return {
    name: draft.name,
    provider,
    baseURL: draft.baseURL,
    apiKey: draft.apiKey,
    model: modelId,
    enabledCapabilitiesMode: draft.enabledCapabilitiesMode,
    enabledCapabilities: draft.enabledCapabilities,
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

/** Returns the chat-facing capabilities declared by the model catalog. */
export function getChatModelCapabilities(model = "", provider = "OpenAI"): ChatModelCapabilities {
  const catalogItem = findChatModelCatalogItem(model, provider);
  return normalizeModelCapabilities(catalogItem?.capabilities || {}, { ...defaultModelCapabilities, ...(catalogItem?.capabilities || {}) });
}

/** Expands partial capability flags into the full capability shape used by the store. */
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

/** Resolves persisted capability override settings into the runtime enabled capability set. */
export function resolveConfiguredModelCapabilities(
  model: Partial<Pick<ModelFormDraft, "enabledCapabilitiesMode" | "enabledCapabilities">> | null | undefined = {},
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

/** Applies per-turn toggles on top of a model's supported and enabled capabilities. */
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

/** Creates the immutable model snapshot stored with a conversation. */
export function createConversationModelSnapshot(
  model: (Partial<ModelFormDraft> & { modelType?: string }) | null | undefined,
): ConversationModelSnapshot | null {
  const runtimeModel = toRuntimeChatModelConfig(model);
  if (!runtimeModel?.name || !runtimeModel?.apiKey) return null;

  const modelId = getModelRequestId(runtimeModel);
  const modelConfigId = `${runtimeModel.provider}:${runtimeModel.name}:${modelId}:${getModelDeployment(runtimeModel) || modelId}`;
  const supportedCapabilities = getChatModelCapabilities(modelId, runtimeModel.provider);
  const enabledCapabilities = resolveConfiguredModelCapabilities(runtimeModel, supportedCapabilities);
  const chatParamDefs = getModelChatParamDefs(runtimeModel);
  const request = isAzureChatModel(runtimeModel)
    ? {
        endpoint: runtimeModel.endpoint,
        deployment: runtimeModel.deployment,
        apiVersion: runtimeModel.apiVersion,
        model: modelId,
      }
    : {
        baseURL: "baseURL" in runtimeModel ? runtimeModel.baseURL : "",
        model: modelId,
      };

  return {
    modelConfigId,
    catalogModelId: modelId,
    displayName: runtimeModel.name || modelId,
    provider: runtimeModel.provider,
    request,
    apiKey: runtimeModel.apiKey,
    supportedCapabilities,
    enabledCapabilities,
    chatParamDefs,
    modelConfig: runtimeModel,
  };
}

/** Restores a normalized chat model config from a saved conversation snapshot. */
export function getModelFromSnapshot(snapshot: ConversationModelSnapshot | null | undefined): ChatModelConfig | null {
  return snapshot?.modelConfig ? toRuntimeChatModelConfig(snapshot.modelConfig) : null;
}

/** Returns display and protocol metadata for a chat model id. */
export function getChatModelInfo(model = "", provider = ""): ChatModelOption {
  const catalogItem = findChatModelCatalogItem(model, provider);
  if (catalogItem) {
    const { value, name, isReasonModel, msgTypeVersion, capabilities } = catalogItem;
    return { value, name, isReasonModel, msgTypeVersion, capabilities };
  }

  return {
    value: model,
    name: model,
    isReasonModel: false,
    msgTypeVersion: "v2",
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

function getChatParamPreset(key = ""): LooseParamDef | null {
  return chatParamPresetList.find((item) => item.key === key) || null;
}

/** Merges a chat parameter definition with its built-in preset defaults. */
export function normalizeChatParamDef(def: LooseParamDef = {}): ModelParamDef {
  const preset = getChatParamPreset(def.key);
  const nextType = def.type || preset?.type || "string";
  const nextDefaultValue = parseParamValue(nextType, def.defaultValue, cloneJson(preset?.defaultValue ?? ""));

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

/** Returns default chat parameter definitions for a catalog model id. */
export function getDefaultChatParamDefs(model = "", provider = ""): ModelParamDef[] {
  return getChatParamKeysForModel(model, provider).map((key) => normalizeChatParamDef({ key }));
}

/** Returns the request parameter keys declared by the chat model catalog. */
export function getChatParamKeysForModel(model = "", provider = ""): string[] {
  return [...(findChatModelCatalogItem(model, provider)?.chatParamKeys || [])];
}

/** Returns normalized chat parameter definitions, honoring explicit custom definitions. */
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

/** Builds default chat settings from a model's parameter definitions. */
export function buildDefaultChatSettings(model: LooseModelConfig | null = null): ChatModelSettings {
  const settings = cloneJson(createDefaultChatSettings());
  const defs = getModelChatParamDefs(model || {});

  defs.forEach((item) => {
    settings[item.key] = cloneJson(item.defaultValue);
  });

  return settings;
}

/** Merges user chat settings with model defaults and migrates old token limit fields. */
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

/** Builds provider request parameters for chat completion calls. */
export function buildChatCompletionParams(model: LooseModelConfig | null = null, settings: Partial<ChatModelSettings> = {}): Record<string, unknown> {
  const defs = getModelChatParamDefs(model || {});
  const mergedSettings = mergeChatSettingsWithModel(model, settings);
  const params: Record<string, unknown> = {};

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
