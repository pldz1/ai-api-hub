export type ImageModelProvider = "OpenAI" | "Azure OpenAI";
export type ImageOperation = "generation" | "edit";
export type ModelParamType = "number" | "string" | "array" | "boolean" | "object" | "image";

export interface SelectOption<TValue extends string = string> {
  value: TValue;
  name: string;
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
