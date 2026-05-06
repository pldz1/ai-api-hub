import type {
  ApiType,
  ChatModelConfig,
  ChatModelOption,
  ChatModelSettings,
  ConversationModelSnapshot,
  ImageModelConfig,
  ImageModelSettings,
  ImageOperation,
  ModelConfig,
  ModelCapabilities,
  ModelDraftConfig,
  ModelParamDef,
  ModelParamType,
  ParamDefaultValue,
  SelectOption,
} from "@/types/model";

function cloneJson<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

type LooseParamDef = Partial<ModelParamDef> & { key?: string };
type LooseModelConfig = Partial<ModelDraftConfig>;

export const defModelType: ModelDraftConfig = {
  name: "",
  apiType: "",
  baseURL: "",
  endpoint: "",
  apiKey: "",
  modelType: "",
  model: "",
  deployment: "",
  apiVersion: "",
  chatParamDefs: [],
  imageParamDefs: [],
  imageOperation: "",
  enabledCapabilities: {},
};

export function isAzureChatModel(model: Partial<ModelDraftConfig> | null | undefined): model is Partial<ModelDraftConfig> & { apiType: "Azure OpenAI" } {
  return model?.apiType === "Azure OpenAI";
}

export function isOpenAIChatModel(model: Partial<ModelDraftConfig> | null | undefined): model is Partial<ModelDraftConfig> & { apiType: "OpenAI" } {
  return model?.apiType === "OpenAI";
}

export function getModelRequestId(model: Partial<ModelDraftConfig> | null | undefined): string {
  return String(model?.model || model?.modelType || "").trim();
}

export function getModelDeployment(model: Partial<ModelDraftConfig> | null | undefined): string {
  return String(model?.deployment || "").trim();
}

function normalizeModelDraft(model: Partial<ModelDraftConfig> | null | undefined = {}): ModelDraftConfig {
  return {
    ...cloneJson(defModelType),
    ...(model || {}),
    chatParamDefs: Array.isArray(model?.chatParamDefs) ? model.chatParamDefs : [],
    imageParamDefs: Array.isArray(model?.imageParamDefs) ? model.imageParamDefs : [],
  };
}

export function normalizeChatModelConfig(model: Partial<ModelDraftConfig> | null | undefined = {}): ChatModelConfig {
  const draft = normalizeModelDraft(model);
  const apiType = draft.apiType === "Azure OpenAI" ? draft.apiType : "OpenAI";
  const modelType = String(draft.modelType || draft.model || "").trim();
  const chatParamDefs = getModelChatParamDefs({ ...draft, apiType, modelType });

  if (apiType === "Azure OpenAI") {
    return {
      name: draft.name,
      apiType,
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
    apiType,
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

export function normalizeImageModelConfig(model: Partial<ModelDraftConfig> | null | undefined = {}, imageOperation: ImageOperation = "generation"): ImageModelConfig {
  const draft = normalizeModelDraft(model);
  const modelType = String(draft.modelType || draft.model || "").trim();
  const imageParamDefs = getModelImageParamDefs({ ...draft, apiType: "OpenAI", modelType, imageOperation }).filter(
    (item) => imageOperation === "edit" || item.type !== "image",
  );

  return {
    name: draft.name,
    apiType: "OpenAI",
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

export const apiTypeList: SelectOption<ApiType>[] = [
  { value: "OpenAI", name: "OpenAI" },
  { value: "Azure OpenAI", name: "Azure OpenAI" },
];

export const imageApiTypeList: SelectOption<"OpenAI">[] = [
  { value: "OpenAI", name: "OpenAI" },
];

export const chatModelTypeList: ChatModelOption[] = [
  { value: "gpt-5.5", name: "gpt-5.5", isReasonModel: false, msgTypeVersion: "v2" },
  { value: "gpt-5.5-pro", name: "gpt-5.5-pro", isReasonModel: false, msgTypeVersion: "v2" },
  { value: "gpt-5.4", name: "gpt-5.4", isReasonModel: false, msgTypeVersion: "v2" },
  { value: "gpt-5.4-pro", name: "gpt-5.4-pro", isReasonModel: false, msgTypeVersion: "v2" },
  { value: "gpt-5.4-mini", name: "gpt-5.4-mini", isReasonModel: false, msgTypeVersion: "v2" },
  { value: "gpt-5.4-nano", name: "gpt-5.4-nano", isReasonModel: false, msgTypeVersion: "v2" },
  { value: "gpt-5.2", name: "gpt-5.2", isReasonModel: false, msgTypeVersion: "v2" },
  { value: "gpt-5", name: "gpt-5", isReasonModel: false, msgTypeVersion: "v2" },
  { value: "gpt-5-mini", name: "gpt-5-mini", isReasonModel: false, msgTypeVersion: "v2" },
  { value: "gpt-5-nano", name: "gpt-5-nano", isReasonModel: false, msgTypeVersion: "v2" },
  { value: "gpt-4.1", name: "gpt-4.1", isReasonModel: false, msgTypeVersion: "v2" },
  { value: "gpt-4.1-mini", name: "gpt-4.1-mini", isReasonModel: false, msgTypeVersion: "v2" },
  { value: "gpt-4.1-nano", name: "gpt-4.1-nano", isReasonModel: false, msgTypeVersion: "v2" },
  { value: "gpt-4o", name: "gpt-4o", isReasonModel: false, msgTypeVersion: "v2" },
  { value: "gpt-4o-mini", name: "gpt-4o-mini", isReasonModel: false, msgTypeVersion: "v2" },
  { value: "o1", name: "o1", isReasonModel: true, msgTypeVersion: "v1" },
  { value: "o3", name: "o3", isReasonModel: true, msgTypeVersion: "v1" },
  { value: "o3-mini", name: "o3-mini", isReasonModel: true, msgTypeVersion: "v1" },
  { value: "o4-mini", name: "o4-mini", isReasonModel: true, msgTypeVersion: "v1" },
];

export const defaultModelCapabilities: ModelCapabilities = {
  textInput: true,
  imageInput: false,
  fileInput: false,
  webSearch: false,
  functionCalling: false,
  structuredOutput: false,
  imageGeneration: false,
};

export const capabilityLabels: Record<keyof ModelCapabilities, string> = {
  textInput: "Text",
  imageInput: "Image",
  fileInput: "Files",
  webSearch: "Web",
  functionCalling: "Tools",
  structuredOutput: "JSON",
  imageGeneration: "Image Gen",
};

export const chatConfigurableCapabilityKeys: (keyof ModelCapabilities)[] = ["imageInput", "webSearch", "functionCalling", "structuredOutput"];
export const chatTurnCapabilityKeys: (keyof ModelCapabilities)[] = ["webSearch", "functionCalling", "structuredOutput"];

export function getChatModelCapabilities(modelType = "", apiType = "OpenAI"): ModelCapabilities {
  const normalizedType = (modelType || "").trim().toLowerCase();
  const normalizedApiType = (apiType || "").trim().toLowerCase();
  const isAzure = normalizedApiType === "azure openai";
  const isGpt5 = /^gpt-5(\.|-|$)/.test(normalizedType);
  const isGpt4 = /^gpt-4/.test(normalizedType);
  const isModernGpt = isGpt5 || isGpt4;
  const isMiniNano = /(-mini|-nano)$/.test(normalizedType);
  const isReasoning = getChatModelInfo(modelType, apiType).isReasonModel;

  return {
    ...defaultModelCapabilities,
    imageInput: isModernGpt && !/^gpt-4\.1-nano$/.test(normalizedType),
    fileInput: isGpt5 || /^gpt-4\.1/.test(normalizedType),
    webSearch: isModernGpt && !isMiniNano,
    functionCalling: isModernGpt || isReasoning,
    structuredOutput: isModernGpt || isReasoning,
    imageGeneration: false,
  };
}

export function normalizeModelCapabilities(
  capabilities: Partial<ModelCapabilities> | null | undefined = {},
  supported: ModelCapabilities = defaultModelCapabilities,
): ModelCapabilities {
  const next = { ...defaultModelCapabilities };
  (Object.keys(next) as (keyof ModelCapabilities)[]).forEach((key) => {
    next[key] = Boolean(supported[key] && (capabilities?.[key] ?? supported[key]));
  });
  next.textInput = true;
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

export function createConversationModelSnapshot(model: Partial<ModelDraftConfig> | null | undefined): ConversationModelSnapshot | null {
  const normalizedModel = normalizeChatModelConfig(model);
  if (!normalizedModel?.name || !normalizedModel?.apiKey) return null;

  const modelConfigId = `${normalizedModel.apiType}:${normalizedModel.name}:${normalizedModel.modelType}:${getModelDeployment(normalizedModel) || getModelRequestId(normalizedModel)}`;
  const supportedCapabilities = getChatModelCapabilities(normalizedModel.modelType, normalizedModel.apiType);
  const enabledCapabilities = normalizeModelCapabilities((normalizedModel as any).enabledCapabilities, supportedCapabilities);

  return {
    modelConfigId,
    catalogModelId: normalizedModel.modelType,
    displayName: normalizedModel.name || normalizedModel.modelType,
    provider: normalizedModel.apiType,
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

export function getChatModelInfo(modelType = "", apiType = ""): ChatModelOption {
  const normalizedType = (modelType || "").trim().toLowerCase();
  const normalizedApiType = (apiType || "").trim().toLowerCase();

  const exactMatch = chatModelTypeList.find((item) => item.value === normalizedType);
  if (exactMatch) return exactMatch;

  if (/^(o1|o3|o4)(-|$)/.test(normalizedType)) {
    return { value: modelType, name: modelType, isReasonModel: true, msgTypeVersion: "v2" };
  }

  if (/^gpt-3\.5/.test(normalizedType)) {
    return { value: modelType, name: modelType, isReasonModel: false, msgTypeVersion: "v1" };
  }

  return { value: modelType, name: modelType, isReasonModel: false, msgTypeVersion: "v2" };
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
    description: "限制单次补全文本的输出长度，包含可见输出和推理 token。",
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
    description: "推理力度，例如 none / low / medium / high / xhigh。",
    defaultValue: "medium",
    placeholder: "none / low / medium / high / xhigh",
  },
  {
    key: "verbosity",
    label: "verbosity",
    type: "string",
    description: "控制输出详略程度，例如 low / medium / high。",
    defaultValue: "medium",
    placeholder: "low / medium / high",
  },
];

export const imageParamPresetList: LooseParamDef[] = [
  {
    key: "quality",
    label: "quality",
    type: "string",
    description: "图像质量参数，例如 auto、low、medium、high、standard、hd。",
    defaultValue: "auto",
    placeholder: "auto",
  },
  {
    key: "output_format",
    label: "output_format",
    type: "string",
    description: "返回图片格式，例如 png、jpeg、webp。",
    defaultValue: "png",
    placeholder: "png",
  },
  {
    key: "background",
    label: "background",
    type: "string",
    description: "背景设置，例如 auto、transparent、opaque。",
    defaultValue: "",
    placeholder: "auto",
  },
  {
    key: "moderation",
    label: "moderation",
    type: "string",
    description: "内容审核强度，例如 auto、low。",
    defaultValue: "",
    placeholder: "auto",
  },
  {
    key: "image",
    label: "image",
    type: "image",
    description: "随请求携带的输入图像，发送为 { filename, content_type, data }。",
    defaultValue: null,
    placeholder: "image/png",
  },
  {
    key: "mask",
    label: "mask",
    type: "image",
    description: "图像编辑蒙版，PNG 透明区域表示需要编辑的位置。",
    defaultValue: null,
    placeholder: "image/png",
  },
];

export const defChatModelSettings: ChatModelSettings = {
  passedMsgLen: 10,
  prompts: [{ role: "system", content: [{ type: "text", text: "As an AI assistant, please make your responses more engaging by including lively emojis." }] }],
};

function getChatParamPreset(key = ""): LooseParamDef | null {
  return chatParamPresetList.find((item) => item.key === key) || null;
}

function getImageParamPreset(key = ""): LooseParamDef | null {
  return imageParamPresetList.find((item) => item.key === key) || null;
}

export function parseChatParamValue<T = ParamDefaultValue>(type: ModelParamType | string = "string", value: unknown = undefined, fallback: T = undefined as T): T {
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

export function getDefaultChatParamDefs(modelType = "", apiType = ""): ModelParamDef[] {
  return getChatParamKeysForModel(modelType, apiType).map((key) => normalizeChatParamDef({ key }));
}

export function getChatParamKeysForModel(modelType = "", apiType = ""): string[] {
  const normalizedType = (modelType || "").trim().toLowerCase();
  const modelInfo = getChatModelInfo(modelType, apiType);

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

export function isChatParamSupportedForModel(key = "", modelType = "", apiType = ""): boolean {
  return getChatParamKeysForModel(modelType, apiType).includes(key);
}

export function getModelChatParamDefs(model: LooseModelConfig = {}): ModelParamDef[] {
  const defs =
    Array.isArray(model?.chatParamDefs) && model.chatParamDefs.length > 0 ? model.chatParamDefs : getDefaultChatParamDefs(model?.modelType, model?.apiType);
  const seen = new Set();
  const supportedKeys = new Set(getChatParamKeysForModel(model?.modelType, model?.apiType));

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
  const configuredDefs = Array.isArray(model?.imageParamDefs) && model.imageParamDefs.length > 0 ? model.imageParamDefs : defaultDefs;
  const defs =
    model?.imageOperation === "edit"
      ? [
          ...configuredDefs,
          ...getDefaultImageEditParamDefs().filter((defaultDef) => !configuredDefs.some((item) => item.key === defaultDef.key)),
        ]
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
  const mergedSettings = {
    ...buildDefaultImageSettings(model),
    ...(settings || {}),
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
  const settings = cloneJson(defChatModelSettings);
  const defs = getModelChatParamDefs(model || {});

  defs.forEach((item) => {
    settings[item.key] = cloneJson(item.defaultValue);
  });

  return settings;
}

export function mergeChatSettingsWithModel(model: LooseModelConfig | null = null, settings: Partial<ChatModelSettings> = {}): ChatModelSettings {
  const mergedSettings = {
    ...buildDefaultChatSettings(model),
    ...(settings || {}),
  };

  const defs = getModelChatParamDefs(model || {});
  defs.forEach((item) => {
    mergedSettings[item.key] = parseChatParamValue(item.type, mergedSettings[item.key], cloneJson(item.defaultValue));
  });

  if (!Array.isArray(mergedSettings.prompts)) {
    mergedSettings.prompts = cloneJson(defChatModelSettings.prompts);
  }

  if (!Number.isFinite(Number(mergedSettings.passedMsgLen))) {
    mergedSettings.passedMsgLen = defChatModelSettings.passedMsgLen;
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
