export type ApiType = "OpenAI" | "Azure OpenAI" | "";
export type ChatApiType = Exclude<ApiType, "">;
export type ModelKind = "chat" | "image";
export type ImageOperation = "generation" | "edit";
export type ChatMessageRole = "system" | "user" | "assistant";
export type ModelParamType = "number" | "string" | "array" | "boolean" | "object" | "image";

export interface SelectOption<TValue extends string = string> {
  value: TValue;
  name: string;
}

export interface ChatModelOption extends SelectOption {
  isReasonModel: boolean;
  msgTypeVersion: "v1" | "v2";
  capabilities: Pick<ModelCapabilities, "webSearch" | "reasoning" | "imageRead">;
}

export interface ModelCapabilities {
  textInput: boolean;
  imageRead: boolean;
  imageInput: boolean;
  fileInput: boolean;
  webSearch: boolean;
  reasoning: boolean;
  functionCalling: boolean;
  structuredOutput: boolean;
  imageGeneration: boolean;
}

export interface ImageParamValue {
  filename: string;
  content_type: string;
  data: string;
}

export type ParamDefaultValue = string | number | boolean | unknown[] | Record<string, unknown> | ImageParamValue | null;

export interface ModelParamDef {
  key: string;
  label: string;
  type: ModelParamType;
  description: string;
  descriptionKey: string;
  placeholder: string;
  defaultValue: ParamDefaultValue;
  min: number;
  max: number;
  step: number;
}

export interface BaseModelConfig {
  name: string;
  apiKey: string;
  modelType: string;
  chatParamDefs: ModelParamDef[];
  imageParamDefs: ModelParamDef[];
  imageOperation: ImageOperation | "";
  enabledCapabilities?: Partial<ModelCapabilities>;
}

export interface OpenAIChatModelConfig extends BaseModelConfig {
  apiType: "OpenAI";
  baseURL: string;
  model: string;
  endpoint?: "";
  deployment?: "";
  apiVersion?: "";
}

export interface AzureChatModelConfig extends BaseModelConfig {
  apiType: "Azure OpenAI";
  endpoint: string;
  deployment: string;
  apiVersion: string;
  baseURL?: "";
  model?: "";
}

export interface OpenAIImageModelConfig extends BaseModelConfig {
  apiType: "OpenAI";
  baseURL: string;
  model: string;
  endpoint?: "";
  deployment?: "";
  apiVersion?: "";
  imageOperation: ImageOperation;
}

export interface AzureImageModelConfig extends BaseModelConfig {
  apiType: "Azure OpenAI";
  endpoint: string;
  deployment: string;
  apiVersion: string;
  baseURL?: "";
  model?: "";
  imageOperation: ImageOperation;
}

export type ChatModelConfig = OpenAIChatModelConfig | AzureChatModelConfig;
export type ImageModelConfig = OpenAIImageModelConfig | AzureImageModelConfig;
export type ModelConfig = ChatModelConfig | ImageModelConfig;

export interface ConversationModelSnapshot {
  modelConfigId: string;
  catalogModelId: string;
  displayName: string;
  provider: ChatApiType;
  request: {
    model?: string;
    baseURL?: string;
    endpoint?: string;
    deployment?: string;
    apiVersion?: string;
  };
  apiKey: string;
  supportedCapabilities: ModelCapabilities;
  enabledCapabilities: ModelCapabilities;
  chatParamDefs: ModelParamDef[];
  modelConfig: ChatModelConfig;
}

export interface OpenAIProviderConfig {
  provider: "OpenAI";
  baseURL: string;
  apiKey: string;
  model: string;
}

export interface AzureOpenAIProviderConfig {
  provider: "Azure OpenAI";
  endpoint: string;
  apiKey: string;
  deploymentName: string;
  apiVersion: string;
}

export type ChatProviderConfig = OpenAIProviderConfig | AzureOpenAIProviderConfig;

export interface ModelDraftConfig extends BaseModelConfig {
  apiType: ApiType;
  baseURL: string;
  endpoint: string;
  model: string;
  deployment: string;
  apiVersion: string;
}

export interface ModelSettings {
  chat: ChatModelConfig[];
  imageGeneration: ImageModelConfig[];
  imageEdit: ImageModelConfig[];
  image: ImageModelConfig[];
  rtaudio: ModelDraftConfig[];
}

export interface PromptContent {
  type: "text";
  text: string;
}

export interface PromptMessage {
  role: ChatMessageRole;
  content: PromptContent[];
}

export interface ChatModelSettings {
  passedMsgLen: number;
  prompts: PromptMessage[];
  [key: string]: unknown;
}

export interface ImageModelSettings {
  model: ImageModelConfig | null;
  prompt: string;
  size: string;
  quality: string;
  image: ImageParamValue | null;
  mask: ImageParamValue | null;
  n: number;
  [key: string]: unknown;
}
