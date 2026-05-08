// @ts-nocheck
import { OpenAI } from "openai";
import type { ChatCallback, ChatProviderResponse, PackedChatMessage } from "@/services/types";

/**
 * DeepSeek-compatible chat provider client.
 *
 * DeepSeek is accessed through the OpenAI SDK compatibility layer and supports
 * the chat streaming contract used by older model configurations.
 */
export class DeepSeekClient {
  constructor(baseURL: string, apiKey: string, model: string) {
    this.init(baseURL, apiKey, model);
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
   * Stream chat completion chunks from the DeepSeek-compatible client.
   */
  async *chatStream(messages: PackedChatMessage[], params: Record<string, unknown>): AsyncGenerator<ChatProviderResponse | string> {
    if (this.client == null) {
      yield "模型初始化失败, 无法向服务器发送消息.";
      return;
    }

    try {
      const results = await this.client.chat.completions.create({
        model: this.model,
        messages: messages,
        ...params,
      });

      for await (const chunk of results) {
        yield {
          flag: true,
          content: chunk.choices[0]?.delta?.content || "",
          reasoning_content: chunk.choices[0]?.delta?.reasoning_content || "",
        };
      }
    } catch (err) {
      yield { flag: false, content: String(err), reasoning_content: "" };
      return;
    }
  }

  /**
   * Run a streaming chat request and forward chunks to the callback.
   */
  async chat(data: PackedChatMessage[], params: Record<string, unknown> = {}, callback: ChatCallback | null = null): Promise<void> {
    const messages = data.map((item) => {
      if (typeof item.content === "string") {
        return {
          role: item.role,
          content: item.content,
        };
      }

      return {
        role: item.role,
        content: item.content?.[0]?.text || "",
      };
    });
    for await (const response of this.chatStream(messages, {
      ...params,
      stream: true,
    })) {
      if (callback) await callback(response);
    }
  }

}
