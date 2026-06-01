import type { ChatCallback, ChatCompletionParams, ChatProviderResponse, ChatRequestOptions, PackedChatMessage } from "../types";
import { normalizeUsage, requestJson, streamJsonEvents, type JsonObject } from "../../common";

const PROVIDER_NOT_READY_MESSAGE = "Chat provider is not configured.";

/**
 * Keeps only fields accepted by OpenAI-compatible chat completions endpoints.
 *
 * UI/runtime capability flags such as `webSearch` are app-level controls, not
 * provider request body fields. `stream_options` is sent only for streaming
 * requests because some compatible providers reject it for sync calls.
 */
function normalizeOpenAIParams(params: ChatCompletionParams = {}, stream = true): JsonObject {
  const { stream: _stream, stream_options, webSearch, reasoningBoost, ...requestParams } = params || {};
  if (reasoningBoost && "reasoning_effort" in requestParams) requestParams.reasoning_effort = "high";
  if (stream && stream_options) requestParams.stream_options = stream_options;
  return requestParams;
}

/** Converts one Server-Sent Events chat completion chunk into the app delta shape. */
function responseFromChatChunk(chunk: JsonObject): ChatProviderResponse {
  const choice = Array.isArray(chunk.choices) ? (chunk.choices[0] as JsonObject | undefined) : undefined;
  const delta = (choice?.delta || {}) as JsonObject;

  return {
    flag: true,
    content: String(delta.content || ""),
    reasoning_content: String(delta.reasoning_content || ""),
    usage: normalizeUsage(chunk.usage as JsonObject | null | undefined),
  };
}

/** Converts a non-streaming chat completion response into the app response shape. */
function responseFromChatCompletion(data: JsonObject): ChatProviderResponse {
  const choice = Array.isArray(data.choices) ? (data.choices[0] as JsonObject | undefined) : undefined;
  const message = (choice?.message || {}) as JsonObject;

  return {
    flag: true,
    content: String(message.content || ""),
    reasoning_content: String(message.reasoning_content || ""),
    usage: normalizeUsage(data.usage as JsonObject | null | undefined),
  };
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

export class OpenAIClient {
  baseURL = "";
  apiKey = "";
  model = "";

  constructor(baseURL: string, apiKey: string, model: string) {
    this.init(baseURL, apiKey, model);
  }

  init(baseURL: string, apiKey: string, model: string): void {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
    this.model = model;
  }

  update(baseURL: string, apiKey: string, model: string): void {
    if (baseURL !== this.baseURL || apiKey !== this.apiKey || model !== this.model) {
      this.init(baseURL, apiKey, model);
    }
  }

  destroy(): void {
    this.baseURL = "";
    this.apiKey = "";
    this.model = "";
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.model);
  }

  getHeaders(): Record<string, string> {
    return {
      authorization: `Bearer ${this.apiKey}`,
    };
  }

  /**
   * `baseURL` is stored as the full chat completions endpoint.
   *
   * Provider defaults live in `chatProviderRegistryConfig`; do not append paths
   * here or Azure/OpenAI-compatible custom endpoints will drift.
   */
  getChatCompletionsUrl(): string {
    return this.baseURL || "https://api.openai.com/v1/chat/completions";
  }

  getChatCompletionParams(params: ChatCompletionParams = {}, stream = true): JsonObject {
    return normalizeOpenAIParams(params, stream);
  }

  getChatCompletionsBody(messages: PackedChatMessage[], params: ChatCompletionParams = {}, stream = true): JsonObject {
    return {
      model: this.model,
      messages,
      ...this.getChatCompletionParams(params, stream),
      stream,
    };
  }

  async chatStream(
    messages: PackedChatMessage[],
    params: ChatCompletionParams,
    callback: ChatCallback | null = null,
    options: ChatRequestOptions = {},
  ): Promise<void> {
    if (!this.isConfigured()) {
      if (callback) await callback({ flag: false, content: PROVIDER_NOT_READY_MESSAGE, reasoning_content: "" });
      return;
    }

    try {
      await streamJsonEvents(this.getChatCompletionsUrl(), {
        headers: this.getHeaders(),
        body: this.getChatCompletionsBody(messages, params, true),
        async onEvent(chunk) {
          if (callback) await callback(responseFromChatChunk(chunk));
        },
        signal: options.signal,
      });
    } catch (err) {
      if (isAbortError(err)) return;
      if (callback) await callback({ flag: false, content: String(err), reasoning_content: "" });
    }
  }

  async chatSync(messages: PackedChatMessage[], params: ChatCompletionParams, options: ChatRequestOptions = {}): Promise<ChatProviderResponse> {
    if (!this.isConfigured()) return { flag: false, content: PROVIDER_NOT_READY_MESSAGE, reasoning_content: "" };

    try {
      const response = await requestJson<JsonObject>(this.getChatCompletionsUrl(), {
        headers: this.getHeaders(),
        body: this.getChatCompletionsBody(messages, params, false),
        signal: options.signal,
      });
      return responseFromChatCompletion(response);
    } catch (err) {
      if (isAbortError(err)) return { flag: false, content: "", reasoning_content: "" };
      return { flag: false, content: String(err), reasoning_content: "" };
    }
  }

  async chat(
    messages: PackedChatMessage[],
    params: ChatCompletionParams = {},
    callback: ChatCallback | null = null,
    options: ChatRequestOptions = {},
  ): Promise<void> {
    // Capability flags are consumed before provider dispatch; do not leak them into the request body.
    const { webSearch: _webSearch, ...nextParams } = params || {};

    if (nextParams.stream !== false) {
      await this.chatStream(messages, nextParams, callback, options);
      return;
    }

    const response = await this.chatSync(messages, nextParams, options);
    if (callback) await callback(response);
  }
}
