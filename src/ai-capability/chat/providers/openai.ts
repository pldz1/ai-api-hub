import type { ChatCallback, ChatCompletionParams, ChatProviderResponse, ChatRequestOptions, PackedChatMessage, ChatPromptContent } from "../types";
import { normalizeUsage, requestJson, streamJsonEvents, type JsonObject } from "../../common";

const PROVIDER_NOT_READY_MESSAGE = "Chat provider is not configured.";

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

function toResponsesContentPart(part: ChatPromptContent, role: PackedChatMessage["role"]): JsonObject | null {
  if (part.type === "text") {
    return {
      type: role === "assistant" ? "output_text" : "input_text",
      text: part.text,
    };
  }

  if (part.type === "image_url") {
    if (role === "assistant") return null;
    return {
      type: "input_image",
      image_url: part.image_url.url,
      detail: part.image_url.detail,
    };
  }

  return null;
}

function toResponsesInput(messages: PackedChatMessage[]): JsonObject[] {
  return messages.map((item) => {
    const content =
      typeof item.content === "string"
        ? [{ type: item.role === "assistant" ? "output_text" : "input_text", text: item.content }]
        : item.content.reduce<JsonObject[]>((parts, part) => {
            const nextPart = toResponsesContentPart(part, item.role);
            if (nextPart) parts.push(nextPart);
            return parts;
          }, []);
    return {
      role: item.role,
      content,
    };
  });
}

function collectOutputText(output: unknown): string {
  if (!Array.isArray(output)) return "";

  return output
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const content = (item as Record<string, unknown>).content;
      if (!Array.isArray(content)) return [];
      return content
        .map((contentItem) => {
          if (!contentItem || typeof contentItem !== "object") return "";
          const record = contentItem as Record<string, unknown>;
          return String(record.text || record.output_text || "");
        })
        .filter(Boolean);
    })
    .join("");
}

function collectReasoningSummary(output: unknown): string {
  if (!Array.isArray(output)) return "";

  return output
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const summary = (item as Record<string, unknown>).summary;
      if (!Array.isArray(summary)) return [];
      return summary
        .map((summaryItem) => {
          if (!summaryItem || typeof summaryItem !== "object") return "";
          return String((summaryItem as Record<string, unknown>).text || "");
        })
        .filter(Boolean);
    })
    .join("");
}

function responseFromResponsesChunk(chunk: JsonObject): ChatProviderResponse | null {
  const chunkType = String(chunk.type || "");

  if (chunkType === "response.output_text.delta") {
    return {
      flag: true,
      content: String(chunk.delta || ""),
      reasoning_content: "",
    };
  }

  if (chunkType === "response.reasoning_summary_text.delta") {
    return {
      flag: true,
      content: "",
      reasoning_content: String(chunk.delta || ""),
    };
  }

  if (chunkType === "response.completed") {
    const response = (chunk.response || {}) as JsonObject;
    return {
      flag: true,
      content: "",
      reasoning_content: "",
      usage: normalizeUsage((response.usage || chunk.usage) as JsonObject | null | undefined),
    };
  }

  return null;
}

function responseFromResponsesCompletion(data: JsonObject): ChatProviderResponse {
  return {
    flag: true,
    content: String(data.output_text || collectOutputText(data.output)),
    reasoning_content: collectReasoningSummary(data.output),
    usage: normalizeUsage(data.usage as JsonObject | null | undefined),
  };
}

function normalizeOpenAIResponsesParams(params: ChatCompletionParams = {}): JsonObject {
  const {
    stream: _stream,
    stream_options: _streamOptions,
    webSearch,
    reasoningBoost,
    reasoning_effort,
    verbosity,
    max_tokens,
    max_output_tokens,
    thinking: _thinking,
    ...restParams
  } = params || {};

  const requestParams: JsonObject = { ...restParams };
  const nextReasoningEffort = reasoningBoost ? "high" : reasoning_effort;
  const nextMaxOutputTokens = max_output_tokens ?? max_tokens;

  if (nextMaxOutputTokens !== undefined) {
    requestParams.max_output_tokens = nextMaxOutputTokens;
  }

  if (nextReasoningEffort) {
    requestParams.reasoning = {
      effort: nextReasoningEffort,
      summary: "auto",
    };
  }

  if (verbosity) {
    requestParams.text = {
      verbosity,
    };
  }

  if (webSearch) {
    requestParams.tools = [{ type: "web_search_preview" }];
  }

  return requestParams;
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

  getResponsesUrl(): string {
    return this.baseURL || "https://api.openai.com/v1/responses";
  }

  getResponsesBody(messages: PackedChatMessage[], params: ChatCompletionParams = {}, stream = true): JsonObject {
    return {
      model: this.model,
      input: toResponsesInput(messages),
      ...normalizeOpenAIResponsesParams(params),
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
      await streamJsonEvents(this.getResponsesUrl(), {
        headers: this.getHeaders(),
        body: this.getResponsesBody(messages, params, true),
        async onEvent(chunk) {
          const response = responseFromResponsesChunk(chunk);
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

  async chatSync(messages: PackedChatMessage[], params: ChatCompletionParams, options: ChatRequestOptions = {}): Promise<ChatProviderResponse> {
    if (!this.isConfigured()) return { flag: false, content: PROVIDER_NOT_READY_MESSAGE, reasoning_content: "" };

    try {
      const response = await requestJson<JsonObject>(this.getResponsesUrl(), {
        headers: this.getHeaders(),
        body: this.getResponsesBody(messages, params, false),
        signal: options.signal,
      });
      return responseFromResponsesCompletion(response);
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
