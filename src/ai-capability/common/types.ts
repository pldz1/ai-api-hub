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

export type RunKind = "chat" | "image" | "video";
export type RunStatus = "running" | "success" | "error" | "stopped";

export interface RunRouteSnapshot {
  knownModel: boolean;
  bindingKey: string;
  provider: string;
  model: string;
  adapterId: string;
  connectionURL: string;
}

export interface RunRequestSnapshot {
  params: Record<string, unknown>;
  capabilities: Record<string, boolean>;
  inputCount: number;
}

export interface RunResultSnapshot {
  usage: TokenUsage;
  outputCount: number;
  providerStatus?: string;
}

/** Immutable, secret-free execution facts owned by one generated response. */
export interface RunSnapshot {
  id: string;
  kind: RunKind;
  status: RunStatus;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  route: RunRouteSnapshot;
  request: RunRequestSnapshot;
  result: RunResultSnapshot;
  error?: string;
}

export type RequestHeaders = Record<string, string>;
