import type {
  ModelProvider,
  ChatModelConfig,
  ChatModelOption,
  ChatModelSettings,
  ConversationModelSnapshot,
  ImageModelConfig,
  ImageModelSettings,
  ImageOperation,
  ModelCapabilities,
  ModelFormDraft,
  ModelParamDef,
  ModelParamType,
  ModelSettings,
  ParamDefaultValue,
  SelectOption,
} from "@/types/model";
import { tr } from "@/i18n";

function cloneJson<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

type LooseParamDef = Partial<ModelParamDef> & { key?: string };
type LegacyModelProviderConfig = { apiType?: ModelProvider; provider?: ModelProvider };
type LooseModelConfig = Partial<ModelFormDraft> &
  LegacyModelProviderConfig & {
    chatParamDefs?: ModelParamDef[];
    imageParamDefs?: ModelParamDef[];
  };
type LooseModelSettings = Partial<ModelSettings> & {
  image?: unknown[];
  rtaudio?: unknown[];
};

export const defaultModelFormDraft: ModelFormDraft = {
  name: "",
  provider: "",
  baseURL: "",
  endpoint: "",
  apiKey: "",
  modelType: "",
  model: "",
  deployment: "",
  apiVersion: "",
  imageOperation: "",
  enabledCapabilities: {},
};

export function isAzureChatModel(model: LooseModelConfig | null | undefined): model is LooseModelConfig & { provider: "Azure OpenAI" } {
  return getLegacyProvider(model) === "Azure OpenAI";
}

export function isOpenAIChatModel(model: LooseModelConfig | null | undefined): model is LooseModelConfig & { provider: "OpenAI" } {
  return getLegacyProvider(model) === "OpenAI";
}

export function isAnthropicChatModel(model: LooseModelConfig | null | undefined): model is LooseModelConfig & { provider: "Anthropic" | "Azure AI Foundry" } {
  const provider = getLegacyProvider(model);
  return provider === "Anthropic" || provider === "Azure AI Foundry";
}

export function getModelRequestId(model: Partial<ModelFormDraft> | null | undefined): string {
  return String(model?.model || model?.modelType || "").trim();
}

export function getModelDeployment(model: Partial<ModelFormDraft> | null | undefined): string {
  return String(model?.deployment || "").trim();
}

function getLegacyProvider(model: LooseModelConfig | null | undefined = {}): ModelProvider {
  return (model?.provider || model?.apiType || "") as ModelProvider;
}

function normalizeModelFormDraft(model: LooseModelConfig | null | undefined = {}): ModelFormDraft {
  return {
    ...cloneJson(defaultModelFormDraft),
    ...(model || {}),
    provider: getLegacyProvider(model),
  };
}

export function normalizeChatModelConfig(model: LooseModelConfig | null | undefined = {}): ChatModelConfig {
  const draft = normalizeModelFormDraft(model);
  const provider = draft.provider === "Azure OpenAI" || draft.provider === "Anthropic" || draft.provider === "Azure AI Foundry" ? draft.provider : "OpenAI";
  const modelType = String(draft.modelType || draft.model || "").trim();
  const chatParamDefs = getModelChatParamDefs({ ...(model || {}), provider, modelType });

  if (provider === "Azure OpenAI") {
    return {
      name: draft.name,
      provider,
      endpoint: draft.endpoint,
      deployment: draft.deployment,
      apiVersion: draft.apiVersion,
      apiKey: draft.apiKey,
      modelType,
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
    modelType,
    model: getModelRequestId({ ...draft, modelType }),
    chatParamDefs,
    imageParamDefs: [],
    imageOperation: "",
    enabledCapabilities: draft.enabledCapabilities,
  };
}

export function normalizeImageModelConfig(model: LooseModelConfig | null | undefined = {}, imageOperation: ImageOperation = "generation"): ImageModelConfig {
  const draft = normalizeModelFormDraft(model);
  const provider = draft.provider === "Azure OpenAI" ? draft.provider : "OpenAI";
  const modelType = String(draft.modelType || draft.model || "").trim();
  const imageParamDefs = getModelImageParamDefs({ ...(model || {}), provider, modelType, imageOperation }).filter(
    (item) => imageOperation === "edit" || item.type !== "image",
  );

  if (provider === "Azure OpenAI") {
    return {
      name: draft.name,
      provider,
      endpoint: draft.endpoint,
      deployment: draft.deployment,
      apiVersion: draft.apiVersion,
      apiKey: draft.apiKey,
      modelType,
      chatParamDefs: [],
      imageParamDefs,
      imageOperation,
      enabledCapabilities: draft.enabledCapabilities,
    };
  }

  return {
    name: draft.name,
    provider,
    baseURL: draft.baseURL,
    apiKey: draft.apiKey,
    modelType,
    model: getModelRequestId({ ...draft, modelType }),
    chatParamDefs: [],
    imageParamDefs,
    imageOperation,
    enabledCapabilities: draft.enabledCapabilities,
  };
}

export function normalizeModelSettings(data: LooseModelSettings | null | undefined = {}): ModelSettings {
  const normalizeModels = (items: unknown[] = [], kind = "", imageOperation: ImageOperation | "" = "") =>
    (Array.isArray(items) ? items : []).map((item) => {
      if (kind === "chat") return normalizeChatModelConfig(item as LooseModelConfig);
      if (kind === "image") return normalizeImageModelConfig(item as LooseModelConfig, imageOperation || (item as LooseModelConfig)?.imageOperation || "generation");
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
  const defaultDefs = getDefaultChatParamDefs(model.modelType, model.provider);
  return JSON.stringify(currentDefs) !== JSON.stringify(defaultDefs);
}

function hasCustomImageParamDefs(model: ImageModelConfig): boolean {
  const currentDefs = getModelImageParamDefs(model);
  const defaultDefs = getModelImageParamDefs({
    provider: model.provider,
    modelType: model.modelType,
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
    modelType: normalizedModel.modelType,
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
    modelType: normalizedModel.modelType,
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

export const chatModelTypeList: ChatModelOption[] = [
  chatOption("gpt-5.5", { webSearch: true, reasoning: true, imageRead: true }),
  chatOption("gpt-5.5-pro", { webSearch: true, reasoning: true, imageRead: true }),
  chatOption("gpt-5.4", { webSearch: true, reasoning: true, imageRead: true }),
  chatOption("gpt-5.4-pro", { webSearch: true, reasoning: true, imageRead: true }),
  chatOption("gpt-5.4-mini", { webSearch: false, reasoning: true, imageRead: true }),
  chatOption("gpt-5.4-nano", { webSearch: false, reasoning: true, imageRead: false }),
  chatOption("gpt-5.2", { webSearch: true, reasoning: true, imageRead: true }),
  chatOption("gpt-5", { webSearch: true, reasoning: true, imageRead: true }),
  chatOption("gpt-5-mini", { webSearch: false, reasoning: true, imageRead: true }),
  chatOption("gpt-5-nano", { webSearch: false, reasoning: true, imageRead: false }),
  chatOption("gpt-4.1", { webSearch: true, reasoning: false, imageRead: true }),
  chatOption("gpt-4.1-mini", { webSearch: false, reasoning: false, imageRead: true }),
  chatOption("gpt-4.1-nano", { webSearch: false, reasoning: false, imageRead: false }),
  chatOption("gpt-4o", { webSearch: true, reasoning: false, imageRead: true }),
  chatOption("gpt-4o-mini", { webSearch: false, reasoning: false, imageRead: true }),
  chatOption("claude-opus-4-7", { webSearch: false, reasoning: false, imageRead: true }),
  chatOption("claude-sonnet-4-6", { webSearch: false, reasoning: false, imageRead: true }),
  chatOption("claude-haiku-4-5", { webSearch: false, reasoning: false, imageRead: true }),
];

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

export const capabilityLabels: Record<keyof ModelCapabilities, string> = {
  textInput: "Text",
  imageRead: "Image",
  imageInput: "Image",
  fileInput: "Files",
  webSearch: "Web",
  reasoning: "Thinking",
  functionCalling: "Tools",
  structuredOutput: "JSON",
  imageGeneration: "Image Gen",
};

export const chatTurnCapabilityKeys: (keyof ModelCapabilities)[] = ["webSearch", "reasoning"];
export const chatDisplayedCapabilityKeys: (keyof ModelCapabilities)[] = ["reasoning", "webSearch", "imageRead"];

export function getChatModelCapabilities(modelType = "", provider = "OpenAI"): ModelCapabilities {
  const normalizedType = (modelType || "").trim().toLowerCase();
  const normalizedModelProvider = (provider || "").trim().toLowerCase();
  const isAzure = normalizedModelProvider === "azure openai";
  const isClaude = normalizedModelProvider === "anthropic" || normalizedModelProvider === "azure ai foundry" || /^claude-/.test(normalizedType);
  const isGpt5 = /^gpt-5(\.|-|$)/.test(normalizedType);
  const isGpt4 = /^gpt-4/.test(normalizedType);
  const isModernGpt = isGpt5 || isGpt4;
  const isMiniNano = /(-mini|-nano)$/.test(normalizedType);
  const isNano = /-nano$/.test(normalizedType);
  const isReasoning = getChatModelInfo(modelType, provider).isReasonModel;

  return {
    ...defaultModelCapabilities,
    imageRead: isClaude || (isModernGpt && !isNano),
    imageInput: isClaude || (isModernGpt && !isNano),
    fileInput: !isClaude && (isGpt5 || /^gpt-4\.1/.test(normalizedType)),
    webSearch: !isClaude && isModernGpt && !isMiniNano,
    reasoning: !isClaude && (isGpt5 || isReasoning),
    functionCalling: isClaude || isModernGpt || isReasoning,
    structuredOutput: isClaude || isModernGpt || isReasoning,
    imageGeneration: false,
  };
}

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

export function createConversationModelSnapshot(model: Partial<ModelFormDraft> | null | undefined): ConversationModelSnapshot | null {
  const normalizedModel = normalizeChatModelConfig(model);
  if (!normalizedModel?.name || !normalizedModel?.apiKey) return null;

  const modelConfigId = `${normalizedModel.provider}:${normalizedModel.name}:${normalizedModel.modelType}:${getModelDeployment(normalizedModel) || getModelRequestId(normalizedModel)}`;
  const supportedCapabilities = getChatModelCapabilities(normalizedModel.modelType, normalizedModel.provider);
  const enabledCapabilities = normalizeModelCapabilities((normalizedModel as any).enabledCapabilities, supportedCapabilities);

  return {
    modelConfigId,
    catalogModelId: normalizedModel.modelType,
    displayName: normalizedModel.name || normalizedModel.modelType,
    provider: normalizedModel.provider,
    request: isAzureChatModel(normalizedModel)
      ? {
          endpoint: normalizedModel.endpoint,
          deployment: normalizedModel.deployment,
          apiVersion: normalizedModel.apiVersion,
        }
      : {
          baseURL: normalizedModel.baseURL,
          model: normalizedModel.model,
        },
    apiKey: normalizedModel.apiKey,
    supportedCapabilities,
    enabledCapabilities,
    chatParamDefs: normalizedModel.chatParamDefs,
    modelConfig: normalizedModel,
  };
}

export function getModelFromSnapshot(snapshot: ConversationModelSnapshot | null | undefined): ChatModelConfig | null {
  return snapshot?.modelConfig ? normalizeChatModelConfig(snapshot.modelConfig) : null;
}

export function getChatModelInfo(modelType = "", provider = ""): ChatModelOption {
  const normalizedType = (modelType || "").trim().toLowerCase();
  const normalizedModelProvider = (provider || "").trim().toLowerCase();

  const exactMatch = chatModelTypeList.find((item) => item.value === normalizedType);
  if (exactMatch) return exactMatch;

  if (/^(o1|o3|o4)(-|$)/.test(normalizedType)) {
    return chatOption(modelType, { webSearch: false, reasoning: true, imageRead: false });
  }

  if (/^gpt-3\.5/.test(normalizedType)) {
    return chatOption(modelType, { webSearch: false, reasoning: false, imageRead: false }, "v1");
  }

  return chatOption(modelType, {
    webSearch: /^gpt-4|^gpt-5/.test(normalizedType) && !/(-mini|-nano)$/.test(normalizedType),
    reasoning: /^gpt-5/.test(normalizedType),
    imageRead: /^gpt-4|^gpt-5/.test(normalizedType) && !/-nano$/.test(normalizedType),
  });
}

export const chatParamTypeList: SelectOption<ModelParamType>[] = [
  { value: "number", name: "Number" },
  { value: "string", name: "String" },
  { value: "array", name: "Array" },
  { value: "boolean", name: "Boolean" },
];

export const imageParamTypeList: SelectOption<ModelParamType>[] = [
  ...chatParamTypeList,
  { value: "object", name: "Object" },
  { value: "image", name: "Image" },
];

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

export const imageParamPresetList: LooseParamDef[] = [
  {
    key: "quality",
    label: "quality",
    type: "string",
    descriptionKey: "image.qualityTip",
    defaultValue: "auto",
    placeholder: "auto",
  },
  {
    key: "output_format",
    label: "output_format",
    type: "string",
    descriptionKey: "image.outputFormatTip",
    defaultValue: "png",
    placeholder: "png",
  },
  {
    key: "background",
    label: "background",
    type: "string",
    descriptionKey: "image.backgroundTip",
    defaultValue: "",
    placeholder: "auto",
  },
  {
    key: "moderation",
    label: "moderation",
    type: "string",
    descriptionKey: "image.moderationTip",
    defaultValue: "",
    placeholder: "auto",
  },
  {
    key: "image",
    label: "image",
    type: "image",
    descriptionKey: "image.inputImageTip",
    defaultValue: null,
    placeholder: "image/png",
  },
  {
    key: "mask",
    label: "mask",
    type: "image",
    descriptionKey: "image.maskTip",
    defaultValue: null,
    placeholder: "image/png",
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

export const defChatModelSettings: ChatModelSettings = createDefaultChatSettings();

function getChatParamPreset(key = ""): LooseParamDef | null {
  return chatParamPresetList.find((item) => item.key === key) || null;
}

function getImageParamPreset(key = ""): LooseParamDef | null {
  return imageParamPresetList.find((item) => item.key === key) || null;
}

export function parseChatParamValue<T = ParamDefaultValue>(
  type: ModelParamType | string = "string",
  value: unknown = undefined,
  fallback: T = undefined as T,
): T {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (type === "number") {
    const nextValue = Number(value);
    return (Number.isFinite(nextValue) ? nextValue : fallback) as T;
  }

  if (type === "boolean") {
    if (typeof value === "boolean") return value as T;
    if (value === "true") return true as T;
    if (value === "false") return false as T;
    return fallback;
  }

  if (type === "array") {
    if (Array.isArray(value)) return value as T;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return (Array.isArray(parsed) ? parsed : fallback) as T;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }

  if (type === "object") {
    if (value && typeof value === "object" && !Array.isArray(value)) return value as T;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return (parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback) as T;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }

  if (type === "image") {
    if (value && typeof value === "object" && !Array.isArray(value) && "filename" in value && "content_type" in value && "data" in value) return value as T;
    return fallback;
  }

  return String(value) as T;
}

function hasMeaningfulParamValue(type: ModelParamType | string = "string", value: unknown = undefined): boolean {
  if (value === undefined || value === null) return false;
  if (type === "string" && value === "") return false;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;
  if (type === "image") return Boolean(value && typeof value === "object" && "filename" in value && "content_type" in value && "data" in value);
  return true;
}

export function normalizeChatParamDef(def: LooseParamDef = {}): ModelParamDef {
  const preset = getChatParamPreset(def.key);
  const nextType = def.type || preset?.type || "string";
  const nextDefaultValue = parseChatParamValue(nextType, def.defaultValue, cloneJson(preset?.defaultValue ?? ""));

  return {
    key: String(def.key || preset?.key || "").trim(),
    label: String(def.label || preset?.label || def.key || "").trim(),
    type: nextType,
    description: String(def.description || preset?.description || "").trim(),
    descriptionKey: String(def.descriptionKey || preset?.descriptionKey || "").trim(),
    placeholder: String(def.placeholder || preset?.placeholder || "").trim(),
    defaultValue: nextDefaultValue,
    min: parseChatParamValue("number", def.min, preset?.min ?? 0),
    max: parseChatParamValue("number", def.max, preset?.max ?? 1),
    step: parseChatParamValue("number", def.step, preset?.step ?? 1),
  };
}

export function normalizeImageParamDef(def: LooseParamDef = {}): ModelParamDef {
  const preset = getImageParamPreset(def.key);
  const nextType = def.type || preset?.type || "string";
  const fallbackDefaultValue = Object.prototype.hasOwnProperty.call(preset || {}, "defaultValue") ? cloneJson(preset.defaultValue) : "";
  const nextDefaultValue = parseChatParamValue(nextType, def.defaultValue, fallbackDefaultValue);

  return {
    key: String(def.key || preset?.key || "").trim(),
    label: String(def.label || preset?.label || def.key || "").trim(),
    type: nextType,
    description: String(def.description || preset?.description || "").trim(),
    descriptionKey: String(def.descriptionKey || preset?.descriptionKey || "").trim(),
    placeholder: String(def.placeholder || preset?.placeholder || "").trim(),
    defaultValue: nextDefaultValue,
    min: parseChatParamValue("number", def.min, preset?.min ?? 0),
    max: parseChatParamValue("number", def.max, preset?.max ?? 1),
    step: parseChatParamValue("number", def.step, preset?.step ?? 1),
  };
}

export function getDefaultChatParamDefs(modelType = "", provider = ""): ModelParamDef[] {
  return getChatParamKeysForModel(modelType, provider).map((key) => normalizeChatParamDef({ key }));
}

export function getChatParamKeysForModel(modelType = "", provider = ""): string[] {
  const normalizedType = (modelType || "").trim().toLowerCase();
  const normalizedModelProvider = (provider || "").trim().toLowerCase();
  const modelInfo = getChatModelInfo(modelType, provider);

  if (normalizedModelProvider === "anthropic" || normalizedModelProvider === "azure ai foundry" || /^claude-/.test(normalizedType)) {
    return ["max_tokens", "temperature", "top_p", "stop"];
  }

  if (/^gpt-5(\.|-|$)/.test(normalizedType)) {
    return ["max_completion_tokens", "reasoning_effort", "verbosity"];
  }

  if (modelInfo.isReasonModel) {
    return ["max_completion_tokens", "reasoning_effort"];
  }

  if (/^gpt-4\.1/.test(normalizedType) || /^gpt-4o/.test(normalizedType) || /^gpt-3\.5/.test(normalizedType)) {
    return ["max_tokens", "temperature", "top_p", "frequency_penalty", "presence_penalty", "stop"];
  }

  return ["temperature", "top_p", "frequency_penalty", "presence_penalty", "stop"];
}

export function isChatParamSupportedForModel(key = "", modelType = "", provider = ""): boolean {
  return getChatParamKeysForModel(modelType, provider).includes(key);
}

export function getModelChatParamDefs(model: LooseModelConfig = {}): ModelParamDef[] {
  const provider = getLegacyProvider(model);
  const defs =
    Array.isArray(model?.chatParamDefs) && model.chatParamDefs.length > 0 ? model.chatParamDefs : getDefaultChatParamDefs(model?.modelType, provider);
  const seen = new Set();
  const supportedKeys = new Set(getChatParamKeysForModel(model?.modelType, provider));

  return defs
    .map((item) => normalizeChatParamDef(item))
    .filter((item) => item.key && supportedKeys.has(item.key) && !seen.has(item.key) && (seen.add(item.key), true));
}

export function getDefaultImageParamDefs(): ModelParamDef[] {
  return ["quality", "output_format"].map((key) => normalizeImageParamDef({ key }));
}

export function getDefaultImageEditParamDefs(): ModelParamDef[] {
  return ["quality", "output_format", "image", "mask"].map((key) => normalizeImageParamDef({ key }));
}

export function getModelImageParamDefs(model: LooseModelConfig = {}): ModelParamDef[] {
  const defaultDefs = model?.imageOperation === "edit" ? getDefaultImageEditParamDefs() : getDefaultImageParamDefs();
  const supportedKeys = new Set(imageParamPresetList.map((item) => item.key).filter(Boolean));
  const configuredDefs =
    Array.isArray(model?.imageParamDefs) && model.imageParamDefs.length > 0
      ? model.imageParamDefs.filter((item) => item.key && supportedKeys.has(item.key))
      : defaultDefs;
  const defs =
    model?.imageOperation === "edit"
      ? [...configuredDefs, ...getDefaultImageEditParamDefs().filter((defaultDef) => !configuredDefs.some((item) => item.key === defaultDef.key))]
      : configuredDefs;
  const seen = new Set();

  return defs.map((item) => normalizeImageParamDef(item)).filter((item) => item.key && !seen.has(item.key) && (seen.add(item.key), true));
}

export function buildDefaultImageSettings(model: LooseModelConfig | null = null): ImageModelSettings {
  const settings = cloneJson(defImageModelSeting);
  const defs = getModelImageParamDefs(model || {});

  defs.forEach((item) => {
    settings[item.key] = cloneJson(item.defaultValue);
  });

  return settings;
}

export function mergeImageSettingsWithModel(model: LooseModelConfig | null = null, settings: Partial<ImageModelSettings> = {}): ImageModelSettings {
  const coreSettings: Partial<ImageModelSettings> = {
    model: settings.model ?? null,
    prompt: typeof settings.prompt === "string" ? settings.prompt : defImageModelSeting.prompt,
    size: typeof settings.size === "string" && settings.size ? settings.size : defImageModelSeting.size,
    image: settings.image ?? null,
    mask: settings.mask ?? null,
    n: settings.n ?? defImageModelSeting.n,
  };
  const mergedSettings = {
    ...buildDefaultImageSettings(model),
    ...coreSettings,
  };

  const defs = getModelImageParamDefs(model || {});
  defs.forEach((item) => {
    mergedSettings[item.key] = parseChatParamValue(item.type, mergedSettings[item.key], cloneJson(item.defaultValue));
  });

  if (!Number.isFinite(Number(mergedSettings.n)) || Number(mergedSettings.n) < 1) {
    mergedSettings.n = defImageModelSeting.n;
  } else {
    mergedSettings.n = Number(mergedSettings.n);
  }

  return mergedSettings;
}

export function buildImageGenerationParams(model: LooseModelConfig | null = null, settings: Partial<ImageModelSettings> = {}): Record<string, unknown> {
  const defs = getModelImageParamDefs(model || {});
  const mergedSettings = mergeImageSettingsWithModel(model, settings);
  const params: Record<string, unknown> = {};

  defs.forEach((item) => {
    const value = parseChatParamValue(item.type, mergedSettings[item.key], cloneJson(item.defaultValue));

    if (!hasMeaningfulParamValue(item.type, value)) return;

    params[item.key] = value;
  });

  return params;
}

export function buildDefaultChatSettings(model: LooseModelConfig | null = null): ChatModelSettings {
  const settings = cloneJson(createDefaultChatSettings());
  const defs = getModelChatParamDefs(model || {});

  defs.forEach((item) => {
    settings[item.key] = cloneJson(item.defaultValue);
  });

  return settings;
}

export function mergeChatSettingsWithModel(model: LooseModelConfig | null = null, settings: Partial<ChatModelSettings> = {}): ChatModelSettings {
  const defaultSettings = createDefaultChatSettings();
  const coreSettings: Partial<ChatModelSettings> = {
    prompts: Array.isArray(settings.prompts) ? settings.prompts : undefined,
    passedMsgLen: settings.passedMsgLen,
  };
  const mergedSettings = {
    ...cloneJson(defaultSettings),
    ...buildDefaultChatSettings(model),
    ...coreSettings,
  };

  const defs = getModelChatParamDefs(model || {});
  defs.forEach((item) => {
    mergedSettings[item.key] = parseChatParamValue(item.type, mergedSettings[item.key], cloneJson(item.defaultValue));
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

export function buildChatCompletionParams(model: LooseModelConfig | null = null, settings: Partial<ChatModelSettings> = {}): Record<string, unknown> {
  const defs = getModelChatParamDefs(model || {});
  const mergedSettings = mergeChatSettingsWithModel(model, settings);
  const params: Record<string, unknown> = {};

  defs.forEach((item) => {
    const value = parseChatParamValue(item.type, mergedSettings[item.key], cloneJson(item.defaultValue));

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

export const imageModelTypeList: SelectOption[] = [
  { value: "gpt-image-1.5", name: "gpt-image-1.5" },
  { value: "gpt-image-1", name: "gpt-image-1" },
  { value: "gpt-image-1-mini", name: "gpt-image-1-mini" },
  { value: "chatgpt-image-latest", name: "chatgpt-image-latest" },
  { value: "dall-e-2", name: "dall-e-2" },
  { value: "dall-e-3", name: "dall-e-3" },
];

export const defImageModelSeting = {
  model: null,
  prompt: "",
  size: "1024x1024",
  quality: "",
  mask: null,
  image: null,
  n: 1,
} satisfies ImageModelSettings;

export const imageModelSize: SelectOption[] = [
  { name: "1024x1024", value: "1024x1024" },
  { name: "1024x1792", value: "1024x1792" },
  { name: "1792x1024", value: "1792x1024" },
];

export const rtaudioModelTypeList: SelectOption[] = [
  { value: "gpt-4o-realtime-preview", name: "gpt-4o-realtime-preview" },
  { value: "gpt-4o-mini-realtime-preview", name: "gpt-4o-mini-realtime-preview" },
];
