export type ModelProvider = "OpenAI" | "Azure OpenAI" | "Anthropic" | "Azure AI Foundry" | "";
export type ChatModelProvider = Exclude<ModelProvider, "">;
export type ImageModelProvider = Extract<ModelProvider, "OpenAI" | "Azure OpenAI">;
export type ModelKind = "chat" | "image" | "audio" | "embedding";
export type ImageOperation = "generation" | "edit";
export type CapabilityOverrideMode = "inherit" | "custom";
export type ModelParamType = "number" | "string" | "array" | "boolean" | "object" | "image";
export type ChatMessageRole = "system" | "user" | "assistant";

export interface SelectOption<TValue extends string = string> {
  value: TValue;
  name: string;
}

export interface ChatModelCapabilities {
  imageRead: boolean;
  webSearch: boolean;
  reasoning: boolean;
  functionCalling: boolean;
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
  model: string;
}
