export type ApiType = "OpenAI" | "Azure OpenAI" | "DeepSeek" | "";
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
}

export interface OpenAIChatModelConfig extends BaseModelConfig {
  apiType: "OpenAI" | "DeepSeek";
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

export type ChatModelConfig = OpenAIChatModelConfig | AzureChatModelConfig;
export type ImageModelConfig = OpenAIImageModelConfig;
export type ModelConfig = ChatModelConfig | ImageModelConfig;

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
