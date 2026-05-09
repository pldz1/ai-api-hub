export type ModelProvider = "OpenAI" | "Azure OpenAI" | "Anthropic" | "Azure AI Foundry" | "";
export type ChatModelProvider = Exclude<ModelProvider, "">;
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

export interface ModelConfigBase {
  name: string;
  apiKey: string;
  modelType: string;
  enabledCapabilities?: Partial<ModelCapabilities>;
}

export interface ChatModelBase extends ModelConfigBase {
  chatParamDefs: ModelParamDef[];
  imageParamDefs?: [];
  imageOperation?: "";
}

export interface ImageModelBase extends ModelConfigBase {
  chatParamDefs?: [];
  imageParamDefs: ModelParamDef[];
  imageOperation: ImageOperation;
}

export interface OpenAIModelProviderConfig {
  provider: "OpenAI";
  baseURL: string;
  model: string;
  endpoint?: "";
  deployment?: "";
  apiVersion?: "";
}

export interface AzureOpenAIModelProviderConfig {
  provider: "Azure OpenAI";
  endpoint: string;
  deployment: string;
  apiVersion: string;
  baseURL?: "";
  model?: "";
}

export interface AnthropicModelProviderConfig {
  provider: "Anthropic" | "Azure AI Foundry";
  baseURL: string;
  model: string;
  endpoint?: "";
  deployment?: "";
  apiVersion?: "";
}

export type ChatModelConfig =
  | (ChatModelBase & OpenAIModelProviderConfig)
  | (ChatModelBase & AzureOpenAIModelProviderConfig)
  | (ChatModelBase & AnthropicModelProviderConfig);
export type ImageModelConfig = (ImageModelBase & OpenAIModelProviderConfig) | (ImageModelBase & AzureOpenAIModelProviderConfig);
export type ModelConfig = ChatModelConfig | ImageModelConfig;

export interface ConversationModelSnapshot {
  modelConfigId: string;
  catalogModelId: string;
  displayName: string;
  provider: ChatModelProvider;
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

export interface AnthropicProviderConfig {
  provider: "Anthropic" | "Azure AI Foundry";
  baseURL: string;
  apiKey: string;
  model: string;
}

export type ChatProviderConfig = OpenAIProviderConfig | AzureOpenAIProviderConfig | AnthropicProviderConfig;

export interface ModelFormDraft {
  name: string;
  provider: ModelProvider;
  baseURL: string;
  endpoint: string;
  apiKey: string;
  modelType: string;
  model: string;
  deployment: string;
  apiVersion: string;
  imageOperation: ImageOperation | "";
  enabledCapabilities?: Partial<ModelCapabilities>;
}

export interface ModelSettings {
  chat: ChatModelConfig[];
  imageGeneration: ImageModelConfig[];
  imageEdit: ImageModelConfig[];
  image: ImageModelConfig[];
  rtaudio: ModelFormDraft[];
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
