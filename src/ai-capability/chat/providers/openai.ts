import type { ChatCompletionParams, ChatProviderResponse, PackedChatMessage, ChatPromptContent } from "../types";
import { normalizeUsage, BaseChatClient, type JsonObject } from "../../common";

const DEFAULT_BASE_URL = "https://api.openai.com/v1/responses";

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
    requestParams.tools = [{ type: "web_search" }];
  }

  return requestParams;
}

export class OpenAIClient extends BaseChatClient {
  getUrl(): string {
    return this.baseURL || DEFAULT_BASE_URL;
  }

  getBody(messages: PackedChatMessage[], params: ChatCompletionParams = {}, stream = true): JsonObject {
    return {
      model: this.model,
      input: toResponsesInput(messages),
      ...normalizeOpenAIResponsesParams(params),
      stream,
    };
  }

  responseFromChunk(chunk: JsonObject): ChatProviderResponse | null {
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

  responseFromCompletion(data: JsonObject): ChatProviderResponse {
    return {
      flag: true,
      content: String(data.output_text || collectOutputText(data.output)),
      reasoning_content: collectReasoningSummary(data.output),
      usage: normalizeUsage(data.usage as JsonObject | null | undefined),
    };
  }
}
