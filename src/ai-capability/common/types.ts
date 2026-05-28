export type ModelParamType = "number" | "string" | "array" | "boolean" | "object" | "image";
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

export interface SelectOption<TValue extends string = string> {
  value: TValue;
  name: string;
}

// ============================================================================
// SSE transport types
// ============================================================================

export type JsonObject = Record<string, unknown>;

export interface StreamJsonMessage {
  data: string;
  event?: string;
  id?: string;
  retry?: number;
}

export interface JsonRequestOptions {
  headers?: Record<string, string>;
  body?: JsonObject;
  signal?: AbortSignal;
}

export interface StreamJsonOptions extends JsonRequestOptions {
  onEvent: (data: JsonObject, message: StreamJsonMessage) => void | Promise<void>;
}

// ============================================================================
// Message shapes
// ============================================================================

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  [key: string]: unknown;
}

export type ApiMethod = "get" | "post" | "put" | "patch" | "delete";
export type RequestBody = Record<string, unknown>;
export type RequestHeaders = Record<string, string>;

export interface ApiResponse<TData = unknown> {
  flag: boolean;
  log: string;
  data: TData;
}
