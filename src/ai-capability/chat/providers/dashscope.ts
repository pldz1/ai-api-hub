import type { ChatCompletionParams, ChatProviderResponse, PackedChatMessage } from "../types";
import { normalizeUsage, BaseChatClient, type JsonObject } from "../../common";

const DEFAULT_BASE_URL = "https://api.dashscope.com/v1/chat/completions";

export class DashScopeClient extends BaseChatClient {
  getUrl(): string {
    return this.baseURL || DEFAULT_BASE_URL;
  }

  getBody(messages: PackedChatMessage[], params: ChatCompletionParams = {}, stream = true): JsonObject {
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

  responseFromChunk(chunk: JsonObject): ChatProviderResponse {
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

  responseFromCompletion(data: JsonObject): ChatProviderResponse {
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
}
