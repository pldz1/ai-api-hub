// @ts-nocheck
import { AzureOpenAI, OpenAI } from "openai";
import { normalizeUsage } from "./usage";
import type { ChatCallback, ChatProviderResponse, PackedChatMessage } from "@/services/types";

/**
 * Azure OpenAI chat provider client.
 *
 * Uses Azure chat completions for normal turns and an OpenAI-compatible
 * Responses client for web-search-enabled turns.
 */
export class AzureOpenAIClient {
  constructor(endpoint: string, apiKey: string, deploymentName: string, apiVersion: string) {
    this.init(endpoint, apiKey, deploymentName, apiVersion);
  }

  init(endpoint: string, apiKey: string, deploymentName: string, apiVersion: string): void {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.deployment = deploymentName;
    this.apiVersion = apiVersion;

    this.client = null;
    this.responsesClient = null;

    if (apiKey && apiVersion) {
      this.client = new AzureOpenAI({
        endpoint,
        apiKey,
        deployment: deploymentName,
        apiVersion,
        dangerouslyAllowBrowser: true,
      });
      this.responsesClient = new OpenAI({
        baseURL: `${String(endpoint || "").replace(/\/+$/, "")}/openai/v1/`,
        apiKey,
        dangerouslyAllowBrowser: true,
      });
    }
  }

  update(endpoint: string, apiKey: string, deploymentName: string, apiVersion: string): void {
    if (endpoint !== this.endpoint || apiKey !== this.apiKey || deploymentName !== this.deployment || apiVersion != this.apiVersion) {
      this.init(endpoint, apiKey, deploymentName, apiVersion);
    }
  }

  destroy(): void {
    this.endpoint = "";
    this.apiKey = "";
    this.deployment = "";
    this.apiVersion = "";
    this.client = null;
    this.responsesClient = null;
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
      model: this.deployment,
      input,
      tools: [{ type: "web_search" }],
    };

    if (max_completion_tokens || max_tokens) responseParams.max_output_tokens = max_completion_tokens || max_tokens;
    if (reasoningBoost || reasoning_effort) responseParams.reasoning = { effort: reasoningBoost ? "high" : reasoning_effort };
    if (verbosity) responseParams.text = { verbosity };

    return responseParams;
  }

  async chatWithWebSearch(messages: PackedChatMessage[], params: Record<string, unknown> = {}, callback: ChatCallback | null = null): Promise<void> {
    if (this.responsesClient == null) {
      if (callback) await callback({ flag: false, content: "模型初始化失败, 无法向服务器发送消息.", reasoning_content: "" });
      return;
    }

    try {
      const response = await this.responsesClient.responses.create(this.getResponsesParams(messages, params));
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

  /**
   * Stream chat completion chunks from the Azure OpenAI client.
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
