import type { ChatCompletionParams, ChatProviderResponse, PackedChatMessage } from "../types";
import { normalizeUsage, BaseChatClient, type JsonObject } from "../../common";

const DEFAULT_BASE_URL = "https://api.deepseek.com/chat/completions";

function toTextMessages(messages: PackedChatMessage[]): PackedChatMessage[] {
  return messages.map((item) => {
    if (typeof item.content === "string") return item;

    return {
      role: item.role,
      content: item.content?.[0]?.type === "text" ? item.content[0].text || "" : "",
    };
  });
}

function normalizeDeepSeekParams(params: ChatCompletionParams = {}, stream = true): JsonObject {
  const { stream: _stream, stream_options, webSearch, reasoningBoost, ...requestParams } = params || {};
  if (reasoningBoost && "reasoning_effort" in requestParams) requestParams.reasoning_effort = "high";
  if (stream && stream_options) requestParams.stream_options = stream_options;
  if (webSearch) requestParams.tools = [{ type: "web_search" }];
  return requestParams;
}

export class DeepSeekClient extends BaseChatClient {
  getUrl(): string {
    return this.baseURL || DEFAULT_BASE_URL;
  }

  getBody(messages: PackedChatMessage[], params: ChatCompletionParams = {}, stream = true): JsonObject {
    return {
      model: this.model,
      messages: toTextMessages(messages),
      ...normalizeDeepSeekParams(params, stream),
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
