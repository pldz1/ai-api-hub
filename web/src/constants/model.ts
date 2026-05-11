import type {
  ModelProvider,
  ChatModelConfig,
  ChatModelOption,
  ChatModelSettings,
  ConversationModelSnapshot,
  ImageModelConfig,
  ImageOperation,
  ModelCapabilities,
  ModelFormDraft,
  ModelParamDef,
  ModelSettings,
  SelectOption,
} from "@/types/model";
import { tr } from "@/i18n";
import {
  cloneJson,
  defaultModelFormDraft,
  getLegacyProvider,
  getModelDeployment,
  getModelRequestId,
  normalizeModelFormDraft,
  parseParamValue,
  type LooseModelConfig,
  type LooseModelSettings,
  type LooseParamDef,
} from "./model-common";
import { getModelImageParamDefs, normalizeImageModelConfig } from "./image-model";

export { defaultModelFormDraft, getModelDeployment, getModelRequestId, parseParamValue as parseChatParamValue } from "./model-common";

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

/** Normalizes user chat model config and migrates old `modelType` data to `model`. */
export function normalizeChatModelConfig(model: LooseModelConfig | null | undefined = {}): ChatModelConfig {
  const draft = normalizeModelFormDraft(model);
  const provider = draft.provider === "Azure OpenAI" || draft.provider === "Anthropic" || draft.provider === "Azure AI Foundry" ? draft.provider : "OpenAI";
  const modelId = getModelRequestId(draft);
  const chatParamDefs = getModelChatParamDefs({ ...(model || {}), provider, model: modelId });

  if (provider === "Azure OpenAI") {
    return {
      name: draft.name,
      provider,
      endpoint: draft.endpoint,
      deployment: draft.deployment,
      apiVersion: draft.apiVersion,
      apiKey: draft.apiKey,
      model: modelId,
      chatParamDefs,
      imageParamDefs: [],
      imageOperation: "",
      enabledCapabilities: draft.enabledCapabilities,
    };
  }

  return {
    name: draft.name,
    provider,
    baseURL: draft.baseURL,
    apiKey: draft.apiKey,
    model: modelId,
    chatParamDefs,
    imageParamDefs: [],
    imageOperation: "",
    enabledCapabilities: draft.enabledCapabilities,
  };
}

/** Normalizes the complete model settings object loaded from storage. */
export function normalizeModelSettings(data: LooseModelSettings | null | undefined = {}): ModelSettings {
  const normalizeModels = (items: unknown[] = [], kind = "", imageOperation: ImageOperation | "" = "") =>
    (Array.isArray(items) ? items : []).map((item) => {
      if (kind === "chat") return normalizeChatModelConfig(item as LooseModelConfig);
      if (kind === "image")
        return normalizeImageModelConfig(item as LooseModelConfig, imageOperation || (item as LooseModelConfig)?.imageOperation || "generation");
      const plainItem = item && typeof item === "object" ? item : {};
      return {
        ...cloneJson(defaultModelFormDraft),
        ...plainItem,
      };
    });

  const legacyImageModels = Array.isArray(data?.image) ? data.image : [];
  const imageGenerationModels = Array.isArray(data?.imageGeneration) ? data.imageGeneration : legacyImageModels;
  const imageEditModels = Array.isArray(data?.imageEdit) ? data.imageEdit : legacyImageModels;

  return {
    chat: normalizeModels(data?.chat, "chat") as ChatModelConfig[],
    imageGeneration: normalizeModels(imageGenerationModels, "image", "generation") as ImageModelConfig[],
    imageEdit: normalizeModels(imageEditModels, "image", "edit") as ImageModelConfig[],
    image: normalizeModels(imageGenerationModels, "image", "generation") as ImageModelConfig[],
    rtaudio: normalizeModels(data?.rtaudio) as ModelFormDraft[],
  };
}

function hasCapabilityOverrides(model: Partial<ModelFormDraft> | null | undefined = {}): boolean {
  return Boolean(model?.enabledCapabilities && Object.keys(model.enabledCapabilities).length > 0);
}

function hasCustomChatParamDefs(model: ChatModelConfig): boolean {
  const currentDefs = getModelChatParamDefs(model);
  const defaultDefs = getDefaultChatParamDefs(model.model, model.provider);
  return JSON.stringify(currentDefs) !== JSON.stringify(defaultDefs);
}

function hasCustomImageParamDefs(model: ImageModelConfig): boolean {
  const currentDefs = getModelImageParamDefs(model);
  const defaultDefs = getModelImageParamDefs({
    provider: model.provider,
    model: model.model,
    imageOperation: model.imageOperation,
    imageParamDefs: [],
  });
  return JSON.stringify(currentDefs) !== JSON.stringify(defaultDefs);
}

function serializeChatModel(model: Partial<ModelFormDraft> | ChatModelConfig): Record<string, unknown> {
  const normalizedModel = normalizeChatModelConfig(model as LooseModelConfig);
  const payload: Record<string, unknown> = {
    name: normalizedModel.name,
    provider: normalizedModel.provider,
    apiKey: normalizedModel.apiKey,
    model: getModelRequestId(normalizedModel),
  };

  if (isAzureChatModel(normalizedModel)) {
    payload.endpoint = normalizedModel.endpoint;
    payload.deployment = normalizedModel.deployment;
    payload.apiVersion = normalizedModel.apiVersion;
  } else {
    payload.baseURL = normalizedModel.baseURL;
  }

  if (hasCapabilityOverrides(normalizedModel)) {
    payload.enabledCapabilities = cloneJson(normalizedModel.enabledCapabilities);
  }

  if (hasCustomChatParamDefs(normalizedModel)) {
    payload.chatParamDefs = cloneJson(getModelChatParamDefs(normalizedModel));
  }

  return payload;
}

function serializeImageModel(model: Partial<ModelFormDraft> | ImageModelConfig, imageOperation: ImageOperation): Record<string, unknown> {
  const normalizedModel = normalizeImageModelConfig(model as LooseModelConfig, imageOperation);
  const payload: Record<string, unknown> = {
    name: normalizedModel.name,
    provider: normalizedModel.provider,
    apiKey: normalizedModel.apiKey,
    model: getModelRequestId(normalizedModel),
  };

  if (normalizedModel.provider === "Azure OpenAI") {
    payload.endpoint = normalizedModel.endpoint;
    payload.deployment = normalizedModel.deployment;
    payload.apiVersion = normalizedModel.apiVersion;
  } else {
    payload.baseURL = normalizedModel.baseURL;
  }

  if (hasCapabilityOverrides(normalizedModel)) {
    payload.enabledCapabilities = cloneJson(normalizedModel.enabledCapabilities);
  }

  if (hasCustomImageParamDefs(normalizedModel)) {
    payload.imageParamDefs = cloneJson(getModelImageParamDefs(normalizedModel));
  }

  return payload;
}

/** Serializes normalized model settings for storage, omitting derived defaults. */
export function serializeModelSettings(data: LooseModelSettings | null | undefined = {}): Record<string, unknown> {
  const normalized = normalizeModelSettings(data);
  const payload: Record<string, unknown> = {
    chat: normalized.chat.map((item) => serializeChatModel(item)),
    imageGeneration: normalized.imageGeneration.map((item) => serializeImageModel(item, "generation")),
    imageEdit: normalized.imageEdit.map((item) => serializeImageModel(item, "edit")),
  };

  if (Array.isArray(normalized.rtaudio) && normalized.rtaudio.length > 0) {
    payload.rtaudio = cloneJson(normalized.rtaudio);
  }

  return payload;
}

export const providerList: SelectOption<ModelProvider>[] = [
  { value: "OpenAI", name: "OpenAI" },
  { value: "Azure OpenAI", name: "Azure OpenAI" },
  { value: "Anthropic", name: "Anthropic Direct" },
  { value: "Azure AI Foundry", name: "Azure AI Foundry" },
];

export const imageModelProviderList: SelectOption<ModelProvider>[] = [
  { value: "OpenAI", name: "OpenAI" },
  { value: "Azure OpenAI", name: "Azure OpenAI" },
];

const chatOption = (
  value: string,
  capabilities: Pick<ModelCapabilities, "webSearch" | "reasoning" | "imageRead">,
  msgTypeVersion: "v1" | "v2" = "v2",
): ChatModelOption => ({
  value,
  name: value,
  isReasonModel: capabilities.reasoning,
  msgTypeVersion,
  capabilities,
});

export const defaultModelCapabilities: ModelCapabilities = {
  textInput: true,
  imageRead: false,
  imageInput: false,
  fileInput: false,
  webSearch: false,
  reasoning: false,
  functionCalling: false,
  structuredOutput: false,
  imageGeneration: false,
};

export const chatTurnCapabilityKeys: (keyof ModelCapabilities)[] = ["webSearch", "reasoning"];
export const chatDisplayedCapabilityKeys: (keyof ModelCapabilities)[] = ["reasoning", "webSearch", "imageRead"];

type ChatModelCatalogItem = ChatModelOption & {
  provider?: ModelProvider;
  chatParamKeys: string[];
};
type ChatModelCatalogInput = {
  value: string;
  provider?: ModelProvider;
  capabilities: Pick<ModelCapabilities, "webSearch" | "reasoning" | "imageRead">;
  chatParamKeys: string[];
  msgTypeVersion?: "v1" | "v2";
};

function catalogItem(input: ChatModelCatalogInput): ChatModelCatalogItem {
  const option = chatOption(input.value, input.capabilities, input.msgTypeVersion || "v2");
  return {
    ...option,
    provider: input.provider,
    chatParamKeys: input.chatParamKeys,
  };
}

const chatModelCatalog: ChatModelCatalogItem[] = [
  catalogItem({
    value: "gpt-5.5",
    capabilities: { webSearch: true, reasoning: true, imageRead: true },
    chatParamKeys: ["max_completion_tokens", "reasoning_effort", "verbosity"],
  }),
  catalogItem({
    value: "gpt-5.5-pro",
    capabilities: { webSearch: true, reasoning: true, imageRead: true },
    chatParamKeys: ["max_completion_tokens", "reasoning_effort", "verbosity"],
  }),
  catalogItem({
    value: "gpt-5.4",
    capabilities: { webSearch: true, reasoning: true, imageRead: true },
    chatParamKeys: ["max_completion_tokens", "reasoning_effort", "verbosity"],
  }),
  catalogItem({
    value: "gpt-5.4-pro",
    capabilities: { webSearch: true, reasoning: true, imageRead: true },
    chatParamKeys: ["max_completion_tokens", "reasoning_effort", "verbosity"],
  }),
  catalogItem({
    value: "gpt-5.4-mini",
    capabilities: { webSearch: false, reasoning: true, imageRead: true },
    chatParamKeys: ["max_completion_tokens", "reasoning_effort", "verbosity"],
  }),
  catalogItem({
    value: "gpt-5.4-nano",
    capabilities: { webSearch: false, reasoning: true, imageRead: false },
    chatParamKeys: ["max_completion_tokens", "reasoning_effort", "verbosity"],
  }),
  catalogItem({
    value: "gpt-5.2",
    capabilities: { webSearch: true, reasoning: true, imageRead: true },
    chatParamKeys: ["max_completion_tokens", "reasoning_effort", "verbosity"],
  }),
  catalogItem({
    value: "gpt-5",
    capabilities: { webSearch: true, reasoning: true, imageRead: true },
    chatParamKeys: ["max_completion_tokens", "reasoning_effort", "verbosity"],
  }),
  catalogItem({
    value: "gpt-5-mini",
    capabilities: { webSearch: false, reasoning: true, imageRead: true },
    chatParamKeys: ["max_completion_tokens", "reasoning_effort", "verbosity"],
  }),
  catalogItem({
    value: "gpt-5-nano",
    capabilities: { webSearch: false, reasoning: true, imageRead: false },
    chatParamKeys: ["max_completion_tokens", "reasoning_effort", "verbosity"],
  }),
  catalogItem({
    value: "gpt-4.1",
    capabilities: { webSearch: true, reasoning: false, imageRead: true },
    chatParamKeys: ["max_completion_tokens", "temperature", "top_p", "frequency_penalty", "presence_penalty", "stop"],
  }),
  catalogItem({
    value: "gpt-4.1-mini",
    capabilities: { webSearch: false, reasoning: false, imageRead: true },
    chatParamKeys: ["max_completion_tokens", "temperature", "top_p", "frequency_penalty", "presence_penalty", "stop"],
  }),
  catalogItem({
    value: "gpt-4.1-nano",
    capabilities: { webSearch: false, reasoning: false, imageRead: false },
    chatParamKeys: ["max_completion_tokens", "temperature", "top_p", "frequency_penalty", "presence_penalty", "stop"],
  }),
  catalogItem({
    value: "gpt-4o",
    capabilities: { webSearch: true, reasoning: false, imageRead: true },
    chatParamKeys: ["max_completion_tokens", "temperature", "top_p", "frequency_penalty", "presence_penalty"],
  }),
  catalogItem({
    value: "gpt-4o-mini",
    capabilities: { webSearch: false, reasoning: false, imageRead: true },
    chatParamKeys: ["max_completion_tokens", "temperature", "top_p", "frequency_penalty", "presence_penalty"],
  }),
  catalogItem({
    value: "gpt-4-turbo",
    capabilities: { webSearch: false, reasoning: false, imageRead: true },
    chatParamKeys: ["max_tokens", "temperature", "top_p", "frequency_penalty", "presence_penalty"],
  }),
  catalogItem({
    value: "gpt-3.5-turbo",
    capabilities: { webSearch: false, reasoning: false, imageRead: false },
    chatParamKeys: ["max_tokens", "temperature", "top_p", "frequency_penalty", "presence_penalty", "stop"],
    msgTypeVersion: "v1",
  }),
  catalogItem({
    value: "o1",
    capabilities: { webSearch: false, reasoning: true, imageRead: false },
    chatParamKeys: ["max_completion_tokens", "reasoning_effort"],
  }),
  catalogItem({
    value: "o3",
    capabilities: { webSearch: false, reasoning: true, imageRead: false },
    chatParamKeys: ["max_completion_tokens", "reasoning_effort"],
  }),
  catalogItem({
    value: "o4-mini",
    capabilities: { webSearch: false, reasoning: true, imageRead: false },
    chatParamKeys: ["max_completion_tokens", "reasoning_effort"],
  }),
  catalogItem({
    value: "claude-opus-4-7",
    capabilities: { webSearch: false, reasoning: false, imageRead: true },
    chatParamKeys: ["max_tokens", "temperature", "top_p", "stop"],
  }),
  catalogItem({
    value: "claude-sonnet-4-6",
    capabilities: { webSearch: false, reasoning: false, imageRead: true },
    chatParamKeys: ["max_tokens", "temperature", "top_p", "stop"],
  }),
  catalogItem({
    value: "claude-haiku-4-5",
    capabilities: { webSearch: false, reasoning: false, imageRead: true },
    chatParamKeys: ["max_tokens", "temperature", "top_p", "stop"],
  }),
];

export const chatModelTypeList: ChatModelOption[] = chatModelCatalog.map(({ value, name, isReasonModel, msgTypeVersion, capabilities }) => ({
  value,
  name,
  isReasonModel,
  msgTypeVersion,
  capabilities,
}));

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
export function getChatModelCapabilities(model = "", provider = "OpenAI"): ModelCapabilities {
  const catalogItem = findChatModelCatalogItem(model, provider);
  return normalizeModelCapabilities(catalogItem?.capabilities || {}, { ...defaultModelCapabilities, ...(catalogItem?.capabilities || {}) });
}

/** Expands partial capability flags into the full capability shape used by the store. */
export function normalizeModelCapabilities(
  capabilities: Partial<ModelCapabilities> | null | undefined = {},
  supported: ModelCapabilities = defaultModelCapabilities,
): ModelCapabilities {
  const next = { ...defaultModelCapabilities };
  const normalizedSupported = {
    ...supported,
    imageRead: supported.imageRead || supported.imageInput,
    imageInput: supported.imageInput || supported.imageRead,
  };
  const normalizedCapabilities = {
    ...(capabilities || {}),
    imageRead: capabilities?.imageRead ?? capabilities?.imageInput,
    imageInput: capabilities?.imageInput ?? capabilities?.imageRead,
  };
  (Object.keys(next) as (keyof ModelCapabilities)[]).forEach((key) => {
    next[key] = Boolean(normalizedSupported[key] && (normalizedCapabilities?.[key] ?? normalizedSupported[key]));
  });
  next.textInput = true;
  next.imageInput = next.imageRead;
  return next;
}

/** Applies per-turn toggles on top of a model's supported and enabled capabilities. */
export function getEffectiveCapabilities(
  supported: Partial<ModelCapabilities> | null | undefined,
  enabled: Partial<ModelCapabilities> | null | undefined,
  turnOptions: Partial<ModelCapabilities> | null | undefined = {},
): ModelCapabilities {
  const supportedCaps = normalizeModelCapabilities(supported, { ...defaultModelCapabilities, ...supported, textInput: true });
  const enabledCaps = normalizeModelCapabilities(enabled, supportedCaps);
  const next = { ...defaultModelCapabilities };
  (Object.keys(next) as (keyof ModelCapabilities)[]).forEach((key) => {
    if (key === "textInput") {
      next[key] = true;
    } else if (chatTurnCapabilityKeys.includes(key)) {
      next[key] = Boolean(supportedCaps[key] && enabledCaps[key] && turnOptions?.[key]);
    } else {
      next[key] = Boolean(supportedCaps[key] && enabledCaps[key]);
    }
  });
  return next;
}

/** Creates the immutable model snapshot stored with a conversation. */
export function createConversationModelSnapshot(model: (Partial<ModelFormDraft> & { modelType?: string }) | null | undefined): ConversationModelSnapshot | null {
  const normalizedModel = normalizeChatModelConfig(model);
  if (!normalizedModel?.name || !normalizedModel?.apiKey) return null;

  const modelId = getModelRequestId(normalizedModel);
  const modelConfigId = `${normalizedModel.provider}:${normalizedModel.name}:${modelId}:${getModelDeployment(normalizedModel) || modelId}`;
  const supportedCapabilities = getChatModelCapabilities(modelId, normalizedModel.provider);
  const enabledCapabilities = normalizeModelCapabilities((normalizedModel as any).enabledCapabilities, supportedCapabilities);

  return {
    modelConfigId,
    catalogModelId: modelId,
    displayName: normalizedModel.name || modelId,
    provider: normalizedModel.provider,
    request: isAzureChatModel(normalizedModel)
      ? {
          endpoint: normalizedModel.endpoint,
          deployment: normalizedModel.deployment,
          apiVersion: normalizedModel.apiVersion,
          model: modelId,
        }
      : {
          baseURL: normalizedModel.baseURL,
          model: modelId,
        },
    apiKey: normalizedModel.apiKey,
    supportedCapabilities,
    enabledCapabilities,
    chatParamDefs: normalizedModel.chatParamDefs,
    modelConfig: normalizedModel,
  };
}

/** Restores a normalized chat model config from a saved conversation snapshot. */
export function getModelFromSnapshot(snapshot: ConversationModelSnapshot | null | undefined): ChatModelConfig | null {
  return snapshot?.modelConfig ? normalizeChatModelConfig(snapshot.modelConfig) : null;
}

/** Returns display and protocol metadata for a chat model id. */
export function getChatModelInfo(model = "", provider = ""): ChatModelOption {
  const catalogItem = findChatModelCatalogItem(model, provider);
  if (catalogItem) {
    const { value, name, isReasonModel, msgTypeVersion, capabilities } = catalogItem;
    return { value, name, isReasonModel, msgTypeVersion, capabilities };
  }

  return chatOption(model, { webSearch: false, reasoning: false, imageRead: false });
}

export const chatParamPresetList: LooseParamDef[] = [
  {
    key: "max_tokens",
    label: "max_tokens",
    type: "number",
    descriptionKey: "chat.maxTokensTip",
    defaultValue: 2000,
    min: 0,
    max: 12800,
    step: 1,
  },
  {
    key: "max_completion_tokens",
    label: "max_completion_tokens",
    type: "number",
    descriptionKey: "chat.maxCompletionTokensTip",
    defaultValue: 2000,
    min: 0,
    max: 128000,
    step: 1,
  },
  {
    key: "temperature",
    label: "temperature",
    type: "number",
    descriptionKey: "chat.temperatureTip",
    defaultValue: 0.7,
    min: 0,
    max: 2,
    step: 0.01,
  },
  {
    key: "top_p",
    label: "top_p",
    type: "number",
    descriptionKey: "chat.topPTip",
    defaultValue: 0.95,
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    key: "frequency_penalty",
    label: "frequency_penalty",
    type: "number",
    descriptionKey: "chat.frequencyPenaltyTip",
    defaultValue: 0,
    min: -2,
    max: 2,
    step: 0.01,
  },
  {
    key: "presence_penalty",
    label: "presence_penalty",
    type: "number",
    descriptionKey: "chat.presencePenaltyTip",
    defaultValue: 0,
    min: -2,
    max: 2,
    step: 0.01,
  },
  {
    key: "stop",
    label: "stop",
    type: "array",
    descriptionKey: "chat.stopTip",
    defaultValue: [],
    placeholder: '["END", "STOP"]',
  },
  {
    key: "reasoning_effort",
    label: "reasoning_effort",
    type: "string",
    descriptionKey: "chat.reasoningEffortTip",
    defaultValue: "medium",
    placeholder: "none / low / medium / high / xhigh",
  },
  {
    key: "verbosity",
    label: "verbosity",
    type: "string",
    descriptionKey: "chat.verbosityTip",
    defaultValue: "medium",
    placeholder: "low / medium / high",
  },
];

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
  const supportedKeys = new Set(
    hasCustomDefs ? model.chatParamDefs.map((item) => item.key).filter(Boolean) : getChatParamKeysForModel(modelId, provider),
  );

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

export const rtaudioModelTypeList: SelectOption[] = [
  { value: "gpt-4o-realtime-preview", name: "gpt-4o-realtime-preview" },
  { value: "gpt-4o-mini-realtime-preview", name: "gpt-4o-mini-realtime-preview" },
];
