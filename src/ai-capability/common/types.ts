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
