import { normalizeUsage } from "./usage";
import { requestJson, streamJsonEvents, type JsonObject } from "./sse-client";
import { tr } from "@/i18n";
import type { ChatCallback, ChatCompletionParams, ChatProviderResponse, ChatRequestOptions, PackedChatMessage } from "@/services/chat/types";

function trimTrailingSlash(value = ""): string {
  return String(value || "").replace(/\/+$/, "");
}

function appendApiVersion(url: string, apiVersion: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}api-version=${encodeURIComponent(apiVersion)}`;
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

function normalizeAzureParams(params: ChatCompletionParams = {}, stream = true): JsonObject {
  const { stream: _stream, stream_options, webSearch, reasoningBoost, ...requestParams } = params || {};
  if (reasoningBoost && "reasoning_effort" in requestParams) requestParams.reasoning_effort = "high";
  if (stream && stream_options) requestParams.stream_options = stream_options;
  return requestParams;
}

function normalizeAzureResponsesParams(params: ChatCompletionParams = {}): JsonObject {
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

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

export class AzureOpenAIClient {
  endpoint = "";
  apiKey = "";
  deployment = "";
  apiVersion = "";

  constructor(endpoint: string, apiKey: string, deploymentName: string, apiVersion: string) {
    this.init(endpoint, apiKey, deploymentName, apiVersion);
  }

  init(endpoint: string, apiKey: string, deploymentName: string, apiVersion: string): void {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.deployment = deploymentName;
    this.apiVersion = apiVersion;
  }

  update(endpoint: string, apiKey: string, deploymentName: string, apiVersion: string): void {
    if (endpoint !== this.endpoint || apiKey !== this.apiKey || deploymentName !== this.deployment || apiVersion !== this.apiVersion) {
      this.init(endpoint, apiKey, deploymentName, apiVersion);
    }
  }

  destroy(): void {
    this.endpoint = "";
    this.apiKey = "";
    this.deployment = "";
    this.apiVersion = "";
  }

  getHeaders(): Record<string, string> {
    return {
      "api-key": this.apiKey,
    };
  }

  getChatCompletionsUrl(): string {
    const path = `${trimTrailingSlash(this.endpoint)}/openai/deployments/${encodeURIComponent(this.deployment)}/chat/completions`;
    return appendApiVersion(path, this.apiVersion);
  }

  getResponsesUrl(): string {
    const path = `${trimTrailingSlash(this.endpoint)}/openai/v1/responses`;
    return appendApiVersion(path, this.apiVersion);
  }

  getResponsesParams(messages: PackedChatMessage[], params: ChatCompletionParams = {}): JsonObject {
    return {
      model: this.deployment,
      input: messagesToResponsesInput(messages),
      tools: [{ type: "web_search" }],
      ...normalizeAzureResponsesParams(params),
    };
  }

  async chatWithWebSearch(
    messages: PackedChatMessage[],
    params: ChatCompletionParams = {},
    callback: ChatCallback | null = null,
    options: ChatRequestOptions = {},
  ): Promise<void> {
    if (!this.apiKey || !this.deployment || !this.apiVersion) {
      if (callback) await callback({ flag: false, content: tr("toast.chatProviderNotReady"), reasoning_content: "" });
      return;
    }

    try {
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
    if (!this.apiKey || !this.deployment || !this.apiVersion) {
      if (callback) await callback({ flag: false, content: tr("toast.chatProviderNotReady"), reasoning_content: "" });
      return;
    }

    try {
      await streamJsonEvents(this.getChatCompletionsUrl(), {
        headers: this.getHeaders(),
        body: {
          messages,
          ...normalizeAzureParams(params, true),
          stream: true,
        },
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
    if (!this.apiKey || !this.deployment || !this.apiVersion) return { flag: false, content: tr("toast.chatProviderNotReady"), reasoning_content: "" };

    try {
      const response = await requestJson<JsonObject>(this.getChatCompletionsUrl(), {
        headers: this.getHeaders(),
        body: {
          messages,
          ...normalizeAzureParams(params, false),
          stream: false,
        },
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
