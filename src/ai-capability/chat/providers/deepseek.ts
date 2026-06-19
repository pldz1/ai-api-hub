import type { ChatCompletionParams, ChatProviderResponse, ChatPromptContent, PackedChatMessage } from "../types";
import { normalizeUsage, BaseChatClient, type JsonObject } from "../../common";

const DEFAULT_BASE_URL = "https://api.deepseek.com/anthropic";
const MESSAGES_PATH = "/v1/messages";

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

function toDeepSeekMessagesUrl(baseUrl: string): string {
  const url = (baseUrl || DEFAULT_BASE_URL).trim();
  if (/\/v\d+\/messages\/?$/i.test(url)) return url;
  if (/\/messages\/?$/i.test(url)) return url;
  return joinUrl(url, MESSAGES_PATH);
}

function toAnthropicContentPart(part: ChatPromptContent, role: PackedChatMessage["role"]): JsonObject | null {
  if (part.type !== "text") return null;

  return {
    type: "text",
    text: part.text,
  };
}

function toAnthropicTextContent(content: PackedChatMessage["content"], role: PackedChatMessage["role"]): JsonObject[] {
  if (typeof content === "string") {
    return [{ type: "text", text: content }];
  }

  return content.reduce<JsonObject[]>((parts, part) => {
    const nextPart = toAnthropicContentPart(part, role);
    if (nextPart) parts.push(nextPart);
    return parts;
  }, []);
}

function toAnthropicMessages(messages: PackedChatMessage[]): { system: string; messages: JsonObject[] } {
  const system: string[] = [];
  const nextMessages: JsonObject[] = [];

  messages.forEach((item) => {
    const content = toAnthropicTextContent(item.content, item.role);
    if (!content.length) return;

    if (item.role === "system") {
      system.push(content.map((part) => String(part.text || "")).join("\n"));
      return;
    }

    nextMessages.push({
      role: item.role,
      content,
    });
  });

  return {
    system: system.join("\n\n"),
    messages: nextMessages,
  };
}

function normalizeDeepSeekEffort(value: unknown): "high" | "max" | undefined {
  const effort = String(value || "").toLowerCase();
  if (effort === "max" || effort === "xhigh") return "max";
  if (effort === "high" || effort === "medium" || effort === "low") return "high";
  return undefined;
}

function normalizeDeepSeekParams(params: ChatCompletionParams = {}): JsonObject {
  const {
    stream: _stream,
    stream_options: _streamOptions,
    webSearch,
    reasoningBoost,
    reasoning_effort,
    max_output_tokens,
    max_tokens,
    thinking: _thinking,
    frequency_penalty: _frequencyPenalty,
    presence_penalty: _presencePenalty,
    ...restParams
  } = params || {};
  const requestParams: JsonObject = { ...restParams };
  const nextMaxTokens = max_tokens ?? max_output_tokens;
  const effort = normalizeDeepSeekEffort(reasoningBoost ? "high" : reasoning_effort);

  requestParams.max_tokens = nextMaxTokens ?? 2000;

  if (effort) {
    requestParams.output_config = { effort };
  }

  if (webSearch) {
    requestParams.tools = [{ type: "web_search_20250305", name: "web_search" }];
  }

  return requestParams;
}

function collectAnthropicText(content: unknown): string {
  if (!Array.isArray(content)) return "";

  return content
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const record = item as Record<string, unknown>;
      if (record.type !== "text") return "";
      return String(record.text || "");
    })
    .join("");
}

function collectAnthropicReasoning(content: unknown): string {
  if (!Array.isArray(content)) return "";

  return content
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const record = item as Record<string, unknown>;
      if (record.type !== "thinking" && record.type !== "reasoning") return "";
      return String(record.thinking || record.text || "");
    })
    .join("");
}

export class DeepSeekClient extends BaseChatClient {
  getHeaders(): Record<string, string> {
    return {
      "x-api-key": this.apiKey,
      "anthropic-version": "2023-06-01",
    };
  }

  getUrl(): string {
    return toDeepSeekMessagesUrl(this.baseURL);
  }

  getBody(messages: PackedChatMessage[], params: ChatCompletionParams = {}, stream = true): JsonObject {
    const anthropicInput = toAnthropicMessages(messages);
    const body: JsonObject = {
      model: this.model,
      messages: anthropicInput.messages,
      ...normalizeDeepSeekParams(params),
      stream,
    };

    if (anthropicInput.system) {
      body.system = anthropicInput.system;
    }

    return body;
  }

  responseFromChunk(chunk: JsonObject): ChatProviderResponse | null {
    const chunkType = String(chunk.type || "");

    if (chunkType === "content_block_delta") {
      const delta = (chunk.delta || {}) as JsonObject;
      const deltaType = String(delta.type || "");

      if (deltaType === "text_delta") {
        return {
          flag: true,
          content: String(delta.text || ""),
          reasoning_content: "",
        };
      }

      if (deltaType === "thinking_delta" || deltaType === "reasoning_delta") {
        return {
          flag: true,
          content: "",
          reasoning_content: String(delta.thinking || delta.text || ""),
        };
      }
    }

    if (chunkType === "message_delta" || chunkType === "message_start" || chunkType === "message_stop") {
      return {
        flag: true,
        content: "",
        reasoning_content: "",
        usage: normalizeUsage(chunk.usage as JsonObject | null | undefined),
      };
    }

    return null;
  }

  responseFromCompletion(data: JsonObject): ChatProviderResponse {
    return {
      flag: true,
      content: collectAnthropicText(data.content),
      reasoning_content: collectAnthropicReasoning(data.content),
      usage: normalizeUsage(data.usage as JsonObject | null | undefined),
    };
  }
}
