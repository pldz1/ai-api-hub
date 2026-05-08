// @ts-nocheck
import { OpenAI } from "openai";
import { normalizeUsage } from "./usage";
import type { ChatCallback, ChatProviderResponse, PackedChatMessage } from "@/services/types";

/**
 * OpenAI chat provider client.
 *
 * Wraps OpenAI chat completions and Responses web-search calls behind the
 * `ChatExecutor` contract used by `ChatProxy`.
 */
export class OpenAIClient {
  constructor(baseURL: string, apiKey: string, model: string) {
    this.init(baseURL, apiKey, model);
  }

  getResponsesParams(messages: PackedChatMessage[], params: Record<string, unknown> = {}): Record<string, unknown> {
    const { max_completion_tokens, max_tokens, reasoning_effort, reasoningBoost, verbosity } = params || {};
    const input = messages
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

    const responseParams = {
      model: this.model,
      input,
      tools: [{ type: "web_search" }],
    };

    if (max_completion_tokens || max_tokens) responseParams.max_output_tokens = max_completion_tokens || max_tokens;
    if (reasoningBoost || reasoning_effort) responseParams.reasoning = { effort: reasoningBoost ? "high" : reasoning_effort };
    if (verbosity) responseParams.text = { verbosity };

    return responseParams;
  }

  async chatWithWebSearch(messages: PackedChatMessage[], params: Record<string, unknown> = {}, callback: ChatCallback | null = null): Promise<void> {
    if (this.client == null) {
      if (callback) await callback({ flag: false, content: "模型初始化失败, 无法向服务器发送消息.", reasoning_content: "" });
      return;
    }

    try {
      const response = await this.client.responses.create(this.getResponsesParams(messages, params));
      if (callback) {
        await callback({
          flag: true,
          content: response.output_text || "",
          reasoning_content: "",
          usage: normalizeUsage(response.usage),
        });
      }
    } catch (err) {
      if (callback) await callback({ flag: false, content: String(err), reasoning_content: "" });
    }
  }

  init(baseURL: string, apiKey: string, model: string): void {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
    this.model = model;
    this.client = null;

    if (apiKey)
      this.client = new OpenAI({
        baseURL: baseURL,
        apiKey: apiKey,
        dangerouslyAllowBrowser: true,
      });
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
    this.client = null;
  }

  /**
   * Stream chat completion chunks from the OpenAI client.
   */
  async *chatStream(messages: PackedChatMessage[], params: Record<string, unknown>): AsyncGenerator<ChatProviderResponse | string> {
    if (this.client == null) {
      yield "模型初始化失败, 无法向服务器发送消息.";
      return;
    }

    try {
      const { webSearch, reasoningBoost, ...requestParams } = params || {};
      if (reasoningBoost && "reasoning_effort" in requestParams) requestParams.reasoning_effort = "high";
      const results = await this.client.chat.completions.create({
        model: this.model,
        messages: messages,
        ...requestParams,
      });

      for await (const chunk of results) {
        yield {
          flag: true,
          content: chunk.choices[0]?.delta?.content || "",
          reasoning_content: chunk.choices[0]?.delta?.reasoning_content || "",
          usage: normalizeUsage(chunk.usage),
        };
      }
    } catch (err) {
      yield { flag: false, content: String(err), reasoning_content: "" };
      return;
    }
  }

  /**
   * Request a non-streaming chat completion.
   */
  async chatSync(messages: PackedChatMessage[], params: Record<string, unknown>): Promise<ChatProviderResponse | string> {
    if (this.client == null) {
      return "模型初始化失败, 无法向服务器发送消息.";
    }

    try {
      const { webSearch, reasoningBoost, ...requestParams } = params || {};
      if (reasoningBoost && "reasoning_effort" in requestParams) requestParams.reasoning_effort = "high";
      const results = await this.client.chat.completions.create({
        model: this.model,
        messages: messages,
        ...requestParams,
      });

      return {
        flag: true,
        content: results.choices[0]?.message?.content || "",
        reasoning_content: results.choices[0]?.message?.reasoning_content || "",
        usage: normalizeUsage(results.usage),
      };
    } catch (err) {
      return { flag: false, content: String(err), reasoning_content: "" };
    }
  }

  /**
   * Run a chat request and forward responses to the callback.
   */
  async chat(messages: PackedChatMessage[], params: Record<string, unknown> = {}, callback: ChatCallback | null = null): Promise<void> {
    const { webSearch, ...nextParams } = params || {};
    if (webSearch) {
      await this.chatWithWebSearch(messages, nextParams, callback);
      return;
    }

    if (nextParams?.stream) {
      for await (const response of this.chatStream(messages, nextParams)) {
        if (callback) await callback(response);
      }
    } else {
      const response = await this.chatSync(messages, nextParams);
      if (callback) await callback(response);
    }
  }

}
