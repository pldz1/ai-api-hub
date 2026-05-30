import type { ChatCallback, ChatCompletionParams, ChatProviderResponse, ChatRequestOptions, PackedChatMessage } from "../types";
import { normalizeUsage, requestJson, streamJsonEvents, type JsonObject } from "../../common";

const PROVIDER_NOT_READY_MESSAGE = "Chat provider is not configured.";

function trimTrailingSlash(value = ""): string {
  return String(value || "").replace(/\/+$/, "");
}

function resolveOpenAIUrl(baseURL = "", path: string): string {
  const trimmed = trimTrailingSlash(baseURL || "https://api.openai.com/v1");
  if (new RegExp(`${path.replace("/", "\\/")}$`).test(trimmed)) return trimmed;
  return `${trimmed}${path}`;
}

function messagesToResponsesInput(messages: PackedChatMessage[]): string {
  return messages
    .map((message) => {
      const text = Array.isArray(message.content)
        ? message.content
            .map((part) => {
              if (part.type === "text") return part.text || "";
              if (part.type === "image_url") return "[Image input attached]";
              return "";
            })
            .filter(Boolean)
            .join("\n")
        : String(message.content || "");
      return `${message.role}: ${text}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

function normalizeOpenAIParams(params: ChatCompletionParams = {}, stream = true): JsonObject {
  const { stream: _stream, stream_options, webSearch, reasoningBoost, ...requestParams } = params || {};
  if (reasoningBoost && "reasoning_effort" in requestParams) requestParams.reasoning_effort = "high";
  if (stream && stream_options) requestParams.stream_options = stream_options;
  return requestParams;
}

function normalizeOpenAIResponsesParams(params: ChatCompletionParams = {}): JsonObject {
  const {
    stream: _stream,
    stream_options,
    webSearch,
    reasoningBoost,
    max_completion_tokens,
    reasoning_effort,
    verbosity,
    frequency_penalty,
    presence_penalty,
    ...requestParams
  } = params || {};

  const responseParams: JsonObject = { ...requestParams };
  if (max_completion_tokens) responseParams.max_output_tokens = max_completion_tokens;
  if (reasoningBoost || reasoning_effort) responseParams.reasoning = { effort: reasoningBoost ? "high" : reasoning_effort };
  if (verbosity) responseParams.text = { verbosity };

  return responseParams;
}

function extractResponsesOutputText(response: JsonObject): string {
  if (typeof response.output_text === "string" && response.output_text) return response.output_text;

  if (!Array.isArray(response.output)) return "";

  return response.output
    .filter((item) => item && typeof item === "object" && item.type === "message")
    .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
    .map((content) => {
      if (!content || typeof content !== "object") return "";
      if (content.type === "output_text") return String(content.text || "");
      if (content.type === "text") return String(content.text || "");
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

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

function responseFromResponsesStreamEvent(event: JsonObject): ChatProviderResponse | null {
  const type = String(event.type || "");

  if (type === "response.output_text.delta" || type === "response.refusal.delta") {
    return { flag: true, content: String(event.delta || ""), reasoning_content: "" };
  }

  if (type === "response.reasoning_text.delta" || type === "response.reasoning_summary_text.delta") {
    return { flag: true, content: "", reasoning_content: String(event.delta || "") };
  }

  if (type === "response.completed") {
    const response = event.response as JsonObject | undefined;
    return { flag: true, content: "", reasoning_content: "", usage: normalizeUsage(response?.usage as JsonObject | null | undefined) };
  }

  if (type === "error" || type === "response.failed") {
    const error = (event.error || (event.response as JsonObject | undefined)?.error || event) as JsonObject;
    return { flag: false, content: String(error?.message || JSON.stringify(error)), reasoning_content: "" };
  }

  return null;
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

  getChatCompletionsUrl(): string {
    return resolveOpenAIUrl(this.baseURL, "/chat/completions");
  }

  getResponsesUrl(): string {
    return resolveOpenAIUrl(this.baseURL, "/responses");
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

  getResponsesParams(messages: PackedChatMessage[], params: ChatCompletionParams = {}): JsonObject {
    return {
      model: this.model,
      input: messagesToResponsesInput(messages),
      tools: [{ type: "web_search" }],
      ...normalizeOpenAIResponsesParams(params),
    };
  }

  async chatWithWebSearch(
    messages: PackedChatMessage[],
    params: ChatCompletionParams = {},
    callback: ChatCallback | null = null,
    options: ChatRequestOptions = {},
  ): Promise<void> {
    if (!this.isConfigured()) {
      if (callback) await callback({ flag: false, content: PROVIDER_NOT_READY_MESSAGE, reasoning_content: "" });
      return;
    }

    try {
      if (params.stream !== false) {
        await streamJsonEvents(this.getResponsesUrl(), {
          headers: this.getHeaders(),
          body: {
            ...this.getResponsesParams(messages, params),
            stream: true,
          },
          async onEvent(event) {
            const next = responseFromResponsesStreamEvent(event);
            if (next && callback) await callback(next);
          },
          signal: options.signal,
        });
        return;
      }

      const response = await requestJson<JsonObject>(this.getResponsesUrl(), {
        headers: this.getHeaders(),
        body: this.getResponsesParams(messages, params),
        signal: options.signal,
      });
      if (callback) {
        await callback({
          flag: true,
          content: extractResponsesOutputText(response),
          reasoning_content: "",
          usage: normalizeUsage(response.usage as JsonObject | null | undefined),
        });
      }
    } catch (err) {
      if (isAbortError(err)) return;
      if (callback) await callback({ flag: false, content: String(err), reasoning_content: "" });
    }
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
    const { webSearch, ...nextParams } = params || {};
    if (webSearch) {
      await this.chatWithWebSearch(messages, nextParams, callback, options);
      return;
    }

    if (nextParams.stream !== false) {
      await this.chatStream(messages, nextParams, callback, options);
      return;
    }

    const response = await this.chatSync(messages, nextParams, options);
    if (callback) await callback(response);
  }
}
