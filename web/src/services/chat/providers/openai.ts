import { normalizeUsage } from "./usage";
import { requestJson, streamJsonEvents, type JsonObject } from "./sse-client";
import { tr } from "@/i18n";
import type { ChatCallback, ChatProviderResponse, PackedChatMessage } from "@/services/types";

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

function normalizeOpenAIParams(params: Record<string, unknown> = {}, stream = true): JsonObject {
  const { stream: _stream, stream_options, webSearch, reasoningBoost, ...requestParams } = params || {};
  if (reasoningBoost && "reasoning_effort" in requestParams) requestParams.reasoning_effort = "high";
  if (stream && stream_options) requestParams.stream_options = stream_options;
  return requestParams;
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

  getResponsesParams(messages: PackedChatMessage[], params: Record<string, unknown> = {}): JsonObject {
    const { max_completion_tokens, max_tokens, reasoning_effort, reasoningBoost, verbosity } = params || {};
    const responseParams: JsonObject = {
      model: this.model,
      input: messagesToResponsesInput(messages),
      tools: [{ type: "web_search" }],
    };

    if (max_completion_tokens || max_tokens) responseParams.max_output_tokens = max_completion_tokens || max_tokens;
    if (reasoningBoost || reasoning_effort) responseParams.reasoning = { effort: reasoningBoost ? "high" : reasoning_effort };
    if (verbosity) responseParams.text = { verbosity };

    return responseParams;
  }

  async chatWithWebSearch(messages: PackedChatMessage[], params: Record<string, unknown> = {}, callback: ChatCallback | null = null): Promise<void> {
    if (!this.apiKey || !this.model) {
      if (callback) await callback({ flag: false, content: tr("toast.chatProviderNotReady"), reasoning_content: "" });
      return;
    }

    try {
      const response = await requestJson<JsonObject>(this.getResponsesUrl(), {
        headers: this.getHeaders(),
        body: this.getResponsesParams(messages, params),
      });
      if (callback) {
        await callback({
          flag: true,
          content: String(response.output_text || ""),
          reasoning_content: "",
          usage: normalizeUsage(response.usage as JsonObject | null | undefined),
        });
      }
    } catch (err) {
      if (callback) await callback({ flag: false, content: String(err), reasoning_content: "" });
    }
  }

  async chatStream(messages: PackedChatMessage[], params: Record<string, unknown>, callback: ChatCallback | null = null): Promise<void> {
    if (!this.apiKey || !this.model) {
      if (callback) await callback({ flag: false, content: tr("toast.chatProviderNotReady"), reasoning_content: "" });
      return;
    }

    try {
      await streamJsonEvents(this.getChatCompletionsUrl(), {
        headers: this.getHeaders(),
        body: {
          model: this.model,
          messages,
          ...normalizeOpenAIParams(params, true),
          stream: true,
        },
        async onEvent(chunk) {
          if (callback) await callback(responseFromChatChunk(chunk));
        },
      });
    } catch (err) {
      if (callback) await callback({ flag: false, content: String(err), reasoning_content: "" });
    }
  }

  async chatSync(messages: PackedChatMessage[], params: Record<string, unknown>): Promise<ChatProviderResponse> {
    if (!this.apiKey || !this.model) return { flag: false, content: tr("toast.chatProviderNotReady"), reasoning_content: "" };

    try {
      const response = await requestJson<JsonObject>(this.getChatCompletionsUrl(), {
        headers: this.getHeaders(),
        body: {
          model: this.model,
          messages,
          ...normalizeOpenAIParams(params, false),
          stream: false,
        },
      });
      return responseFromChatCompletion(response);
    } catch (err) {
      return { flag: false, content: String(err), reasoning_content: "" };
    }
  }

  async chat(messages: PackedChatMessage[], params: Record<string, unknown> = {}, callback: ChatCallback | null = null): Promise<void> {
    const { webSearch, ...nextParams } = params || {};
    if (webSearch) {
      await this.chatWithWebSearch(messages, nextParams, callback);
      return;
    }

    if (nextParams.stream !== false) {
      await this.chatStream(messages, nextParams, callback);
      return;
    }

    const response = await this.chatSync(messages, nextParams);
    if (callback) await callback(response);
  }
}
