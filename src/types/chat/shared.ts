export type ChatModelProvider = "OpenAI" | "Azure OpenAI" | "Anthropic" | "Azure AI Foundry";
export type ChatFormProvider = ChatModelProvider | "";
export type CapabilityOverrideMode = "inherit" | "custom";
export type ModelParamType = "number" | "string" | "array" | "boolean" | "object" | "image";
export type ChatMessageRole = "system" | "user" | "assistant";

export interface SelectOption<TValue extends string = string> {
  value: TValue;
  name: string;
}
export interface ChatModelModalities {
  textInput: boolean;
  textOutput: boolean;
  imageInput: boolean;
  imageOutput: boolean;
  audioInput: boolean;
  audioOutput: boolean;
  videoInput: boolean;
  videoOutput: boolean;
}

export interface ChatModelFeatures {
  streaming: boolean;
  structuredOutputs: boolean;
  fineTuning: boolean;
  reasoning: boolean;
}

export interface ChatModelTools {
  webSearch: boolean;
  imageGeneration: boolean;
  fileSearch: boolean;
  codeInterpreter: boolean;
  hostedShell: boolean;
  skills: boolean;
  mcp: boolean;
  applyPatch: boolean;
  computerUse: boolean;
  toolSearch: boolean;
  functionCalling: boolean;
}

export interface ChatModelCapabilityProfile {
  modalities: ChatModelModalities;
  features: ChatModelFeatures;
  tools: ChatModelTools;
}

export interface ChatModelCapabilities {
  imageRead: boolean;
  webSearch: boolean;
}

export type ParamDefaultValue = string | number | boolean | unknown[] | Record<string, unknown> | null;

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
