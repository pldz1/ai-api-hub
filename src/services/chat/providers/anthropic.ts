import { normalizeUsage } from "./usage";
import { requestJson, streamJsonEvents, type JsonObject } from "./sse-client";
import { tr } from "@/i18n";
import type { ChatCallback, ChatCompletionParams, ChatProviderResponse, ChatRequestOptions, PackedChatMessage } from "@/services/chat/types";

type AnthropicProviderKind = "Anthropic" | "Azure AI Foundry";

function trimTrailingSlash(value = ""): string {
  return String(value || "").replace(/\/+$/, "");
}

function normalizeAnthropicBaseURL(baseURL = ""): string {
  const normalized = trimTrailingSlash(baseURL || "https://api.anthropic.com");
  return normalized.replace(/\/v\d+\/messages$/i, "").replace(/\/v\d+$/i, "");
}

function normalizeFoundryBaseURL(baseURL = ""): string {
  const normalized = normalizeAnthropicBaseURL(baseURL);
  if (!normalized) return "";
  if (!/^https?:\/\//i.test(normalized)) return `https://${normalized}.services.ai.azure.com/anthropic`;
  if (/\/anthropic$/i.test(normalized)) return normalized;
  if (/\.services\.ai\.azure\.com$/i.test(normalized)) return `${normalized}/anthropic`;
  return normalized;
}

function getTextFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (part?.type === "text") return part.text || "";
      if (part?.type === "image_url") return "[Image input attached]";
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function toAnthropicImageBlock(url = ""): JsonObject | null {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(url);
  if (!match) return null;
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: match[1],
      data: match[2],
    },
  };
}

function toAnthropicContent(content: unknown): string | JsonObject[] {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  const blocks = content
    .map((part) => {
      if (part?.type === "text") return { type: "text", text: part.text || "" };
      if (part?.type === "image_url") return toAnthropicImageBlock(part.image_url?.url || "");
      return null;
    })
    .filter((item): item is JsonObject => Boolean(item && (item.type !== "text" || item.text)));

  return blocks.length > 0 ? blocks : getTextFromContent(content);
}

function messageToText(message: JsonObject): string {
  return Array.isArray(message?.content)
    ? message.content
        .filter((item) => item?.type === "text")
        .map((item) => item.text || "")
        .join("")
    : "";
}

function streamEventToResponse(event: JsonObject): ChatProviderResponse | null {
  const delta = event.delta as JsonObject | undefined;
  if ((event.type === "content_block_delta" || event.type === "content_block_delta_event") && delta?.type === "text_delta") {
    return { flag: true, content: String(delta.text || ""), reasoning_content: "" };
  }

  if (event.type === "message_delta" && event.usage) {
    return { flag: true, content: "", reasoning_content: "", usage: normalizeUsage(event.usage as JsonObject) };
  }

  if (event.type === "message_stop") {
    return { flag: true, content: "", reasoning_content: "" };
  }

  if (event.type === "error") {
    const error = event.error as JsonObject | undefined;
    return { flag: false, content: String(error?.message || JSON.stringify(error || event)), reasoning_content: "" };
  }

  return null;
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

export class AnthropicClient {
  baseURL = "";
  apiKey = "";
  model = "";
  provider: AnthropicProviderKind = "Anthropic";

  constructor(baseURL: string, apiKey: string, model: string, provider: AnthropicProviderKind = "Anthropic") {
    this.init(baseURL, apiKey, model, provider);
  }

  init(baseURL: string, apiKey: string, model: string, provider: AnthropicProviderKind = "Anthropic"): void {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
    this.model = model;
    this.provider = provider;
  }

  update(baseURL: string, apiKey: string, model: string, provider: AnthropicProviderKind = "Anthropic"): void {
    if (baseURL !== this.baseURL || apiKey !== this.apiKey || model !== this.model || provider !== this.provider) {
      this.init(baseURL, apiKey, model, provider);
    }
  }

  destroy(): void {
    this.baseURL = "";
    this.apiKey = "";
    this.model = "";
  }

  getMessagesUrl(): string {
    const baseURL = this.provider === "Azure AI Foundry" ? normalizeFoundryBaseURL(this.baseURL) : normalizeAnthropicBaseURL(this.baseURL);
    return `${trimTrailingSlash(baseURL)}/v1/messages`;
  }

  getHeaders(): Record<string, string> {
    return {
      "x-api-key": this.apiKey,
      "anthropic-version": "2023-06-01",
    };
  }

  buildPayload(messages: PackedChatMessage[], params: ChatCompletionParams = {}, stream = false): JsonObject {
    const system = messages
      .filter((message) => message.role === "system")
      .map((message) => getTextFromContent(message.content))
      .filter(Boolean)
      .join("\n\n");

    const nextMessages = messages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({
        role: message.role,
        content: toAnthropicContent(message.content),
      }));

    const { stream: _stream, stream_options, webSearch, reasoningBoost, frequency_penalty, presence_penalty, ...requestParams } = params || {};
    const payload: JsonObject = {
      model: this.model,
      max_tokens: 2000,
      ...requestParams,
      messages: nextMessages,
      stream,
    };

    if (system) payload.system = system;
    return payload;
  }

  async chatStream(
    messages: PackedChatMessage[],
    params: ChatCompletionParams,
    callback: ChatCallback | null = null,
    options: ChatRequestOptions = {},
  ): Promise<void> {
    if (!this.apiKey || !this.model) {
      if (callback) await callback({ flag: false, content: tr("toast.chatProviderNotReady"), reasoning_content: "" });
      return;
    }

    try {
      await streamJsonEvents(this.getMessagesUrl(), {
        headers: this.getHeaders(),
        body: this.buildPayload(messages, params, true),
        async onEvent(event) {
          const next = streamEventToResponse(event);
          if (next && callback) await callback(next);
        },
        signal: options.signal,
      });
    } catch (err) {
      if (isAbortError(err)) return;
      if (callback) await callback({ flag: false, content: String(err), reasoning_content: "" });
    }
  }

  async chatSync(messages: PackedChatMessage[], params: ChatCompletionParams, options: ChatRequestOptions = {}): Promise<ChatProviderResponse> {
    if (!this.apiKey || !this.model) return { flag: false, content: tr("toast.chatProviderNotReady"), reasoning_content: "" };

    try {
      const message = await requestJson<JsonObject>(this.getMessagesUrl(), {
        headers: this.getHeaders(),
        body: this.buildPayload(messages, params, false),
        signal: options.signal,
      });
      return {
        flag: true,
        content: messageToText(message),
        reasoning_content: "",
        usage: normalizeUsage(message?.usage as JsonObject | null | undefined),
      };
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
    if (params?.stream !== false) {
      await this.chatStream(messages, params, callback, options);
      return;
    }

    const response = await this.chatSync(messages, params, options);
    if (callback) await callback(response);
  }
}
