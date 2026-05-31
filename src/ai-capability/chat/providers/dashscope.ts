import type { ChatCallback, ChatCompletionParams, ChatProviderResponse, ChatRequestOptions, PackedChatMessage } from "../types";
import { normalizeUsage, requestJson, streamJsonEvents, type JsonObject } from "../../common";

const PROVIDER_NOT_READY_MESSAGE = "Chat provider is not configured.";

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

function responseFromDashScopeChunk(chunk: JsonObject): ChatProviderResponse {
  const output = (chunk.output || {}) as JsonObject;
  const choice = Array.isArray(output.choices) ? (output.choices[0] as JsonObject | undefined) : undefined;
  const message = (choice?.message || {}) as JsonObject;

  return {
    flag: true,
    content: String(message.content || ""),
    reasoning_content: String(message.reasoning_content || ""),
    usage: normalizeUsage(chunk.usage as JsonObject | null | undefined),
  };
}

function responseFromDashScopeCompletion(data: JsonObject): ChatProviderResponse {
  const output = (data.output || {}) as JsonObject;
  const choice = Array.isArray(output.choices) ? (output.choices[0] as JsonObject | undefined) : undefined;
  const message = (choice?.message || {}) as JsonObject;

  return {
    flag: true,
    content: String(message.content || ""),
    reasoning_content: String(message.reasoning_content || ""),
    usage: normalizeUsage(data.usage as JsonObject | null | undefined),
  };
}

export class DashScopeClient {
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

  getChatCompletionsUrl(): string {
    return this.baseURL;
  }

  getChatCompletionsBody(messages: PackedChatMessage[], params: ChatCompletionParams = {}, stream = true): JsonObject {
    const { webSearch, stream: _stream, stream_options, reasoningBoost, ...restParams } = params || {};

    const dashScopeParams: JsonObject = { ...restParams, result_format: "message" };
    if (stream) {
      dashScopeParams.incremental_output = true;
    }
    if (webSearch) {
      dashScopeParams.enable_search = true;
    }

    return {
      model: this.model,
      input: { messages },
      parameters: dashScopeParams,
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
          if (callback) await callback(responseFromDashScopeChunk(chunk));
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
      return responseFromDashScopeCompletion(response);
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
    if (params.stream !== false) {
      await this.chatStream(messages, params, callback, options);
      return;
    }

    const response = await this.chatSync(messages, params, options);
    if (callback) await callback(response);
  }
}
