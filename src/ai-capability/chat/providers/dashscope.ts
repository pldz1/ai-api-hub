import type { ChatCompletionParams, ChatProviderResponse, ChatPromptContent, PackedChatMessage } from "../types";
import { normalizeUsage, BaseChatClient, type JsonObject } from "../../common";

const DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

function toCompatibleContentPart(part: ChatPromptContent, role: PackedChatMessage["role"]): JsonObject | null {
  if (part.type === "text") {
    return {
      type: "text",
      text: part.text,
    };
  }

  if (part.type === "image_url") {
    if (role !== "user") return null;
    return {
      type: "image_url",
      image_url: part.image_url,
    };
  }

  return null;
}

function toCompatibleMessages(messages: PackedChatMessage[]): JsonObject[] {
  return messages.map((item) => {
    if (typeof item.content === "string") {
      return {
        role: item.role,
        content: item.content,
      };
    }

    const text = item.content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n");
    const hasImage = item.role === "user" && item.content.some((part) => part.type === "image_url");

    if (!hasImage) {
      return {
        role: item.role,
        content: text,
      };
    }

    const content = item.content.reduce<JsonObject[]>((parts, part) => {
      const nextPart = toCompatibleContentPart(part, item.role);
      if (nextPart?.type === "image_url") parts.unshift(nextPart);
      else if (nextPart) parts.push(nextPart);
      return parts;
    }, []);

    return {
      role: item.role,
      content,
    };
  });
}

function isDashScopeDeepSeekV4(model = ""): boolean {
  return /^deepseek-v4-(pro|flash)$/i.test(model.trim());
}

function normalizeDashScopeReasoningEffort(value: unknown): "high" | "max" | undefined {
  const effort = String(value || "").toLowerCase();
  if (effort === "max" || effort === "xhigh") return "max";
  if (effort === "high" || effort === "medium" || effort === "low") return "high";
  return undefined;
}

function normalizeCompatibleParams(params: ChatCompletionParams = {}, stream = true, model = ""): JsonObject {
  const { webSearch, stream: _stream, stream_options, reasoningBoost, max_output_tokens, reasoning_effort, thinking: _thinking, ...restParams } = params || {};
  const requestParams: JsonObject = { ...restParams };

  if (max_output_tokens !== undefined && requestParams.max_tokens === undefined) {
    requestParams.max_tokens = max_output_tokens;
  }
  if (isDashScopeDeepSeekV4(model)) {
    const effort = normalizeDashScopeReasoningEffort(reasoningBoost ? "high" : reasoning_effort);
    if (effort) requestParams.reasoning_effort = effort;
  }
  if (stream && stream_options) {
    requestParams.stream_options = stream_options;
  }
  if (webSearch) {
    requestParams.enable_search = true;
  }

  return requestParams;
}

export class DashScopeClient extends BaseChatClient {
  getUrl(): string {
    return this.baseURL || DEFAULT_BASE_URL;
  }

  getBody(messages: PackedChatMessage[], params: ChatCompletionParams = {}, stream = true): JsonObject {
    return {
      model: this.model,
      messages: toCompatibleMessages(messages),
      ...normalizeCompatibleParams(params, stream, this.model),
      stream,
    };
  }

  responseFromChunk(chunk: JsonObject): ChatProviderResponse {
    const choice = Array.isArray(chunk.choices) ? (chunk.choices[0] as JsonObject | undefined) : undefined;
    const delta = (choice?.delta || {}) as JsonObject;

    return {
      flag: true,
      content: String(delta.content || ""),
      reasoning_content: String(delta.reasoning_content || ""),
      usage: normalizeUsage(chunk.usage as JsonObject | null | undefined),
    };
  }

  responseFromCompletion(data: JsonObject): ChatProviderResponse {
    const choice = Array.isArray(data.choices) ? (data.choices[0] as JsonObject | undefined) : undefined;
    const message = (choice?.message || {}) as JsonObject;

    return {
      flag: true,
      content: String(message.content || ""),
      reasoning_content: String(message.reasoning_content || ""),
      usage: normalizeUsage(data.usage as JsonObject | null | undefined),
    };
  }
}
