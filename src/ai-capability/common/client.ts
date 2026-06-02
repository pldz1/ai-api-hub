import type { ChatCallback, ChatCompletionParams, ChatProviderResponse, ChatRequestOptions, PackedChatMessage } from "../chat/types";
import { requestJson, streamJsonEvents } from "./sse-client";
import type { JsonObject } from "./types";

// -- shared helpers -------------------------------------------------------

export const PROVIDER_NOT_READY_MESSAGE = "Chat provider is not configured.";

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

// -- abstract base class --------------------------------------------------

/**
 * Abstract base for chat provider clients.
 *
 * Subclasses implement four hook points that capture everything
 * provider-specific (URL shape, request body, response parsing).
 * The template methods (chatStream / chatSync / chat) and lifecycle
 * (init / update / destroy / isConfigured) live here once.
 */
export abstract class BaseChatClient {
  baseURL = "";
  apiKey = "";
  model = "";

  constructor(baseURL: string, apiKey: string, model: string) {
    this.init(baseURL, apiKey, model);
  }

  // -- lifecycle -----------------------------------------------------------

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

  // -- overridable ---------------------------------------------------------

  getHeaders(): Record<string, string> {
    return {
      authorization: `Bearer ${this.apiKey}`,
    };
  }

  // -- abstract (subclass contract) ----------------------------------------

  abstract getUrl(): string;
  abstract getBody(messages: PackedChatMessage[], params: ChatCompletionParams, stream: boolean): JsonObject;
  abstract responseFromChunk(chunk: JsonObject): ChatProviderResponse | null;
  abstract responseFromCompletion(data: JsonObject): ChatProviderResponse;

  // -- template methods ----------------------------------------------------

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
      await streamJsonEvents(this.getUrl(), {
        headers: this.getHeaders(),
        body: this.getBody(messages, params, true),
        onEvent: async (chunk) => {
          const response = this.responseFromChunk(chunk);
          if (callback && response && (response.content || response.reasoning_content || response.usage)) {
            await callback(response);
          }
        },
        signal: options.signal,
      });
    } catch (err) {
      if (isAbortError(err)) return;
      if (callback) await callback({ flag: false, content: String(err), reasoning_content: "" });
    }
  }

  async chatSync(
    messages: PackedChatMessage[],
    params: ChatCompletionParams,
    options: ChatRequestOptions = {},
  ): Promise<ChatProviderResponse> {
    if (!this.isConfigured()) return { flag: false, content: PROVIDER_NOT_READY_MESSAGE, reasoning_content: "" };

    try {
      const response = await requestJson<JsonObject>(this.getUrl(), {
        headers: this.getHeaders(),
        body: this.getBody(messages, params, false),
        signal: options.signal,
      });
      return this.responseFromCompletion(response);
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
