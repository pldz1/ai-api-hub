// @ts-nocheck
import { AzureOpenAI, OpenAI } from "openai";

export class AzureOpenAIClient {
  constructor(endpoint, apiKey, deployment, apiVersion) {
    this.init(endpoint, apiKey, deployment, apiVersion);
  }

  init(endpoint, apiKey, deployment, apiVersion) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.deployment = deployment;
    this.apiVersion = apiVersion;

    this.client = null;
    this.responsesClient = null;

    if (apiKey && apiVersion) {
      this.client = new AzureOpenAI({
        endpoint,
        apiKey,
        deployment,
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

  update(endpoint, apiKey, deployment, apiVersion) {
    if (endpoint !== this.endpoint || apiKey !== this.apiKey || deployment !== this.deployment || apiVersion != this.apiVersion) {
      this.init(endpoint, apiKey, deployment, apiVersion);
    }
  }

  destroy() {
    this.endpoint = "";
    this.apiKey = "";
    this.deployment = "";
    this.apiVersion = "";
    this.client = null;
    this.responsesClient = null;
  }

  getResponsesParams(messages, params = {}) {
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

  async chatWithWebSearch(messages, params = {}, callback = null) {
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
        });
      }
    } catch (err) {
      if (callback) await callback({ flag: false, content: String(err), reasoning_content: "" });
    }
  }

  /**
   * 处理输入的消息并返回流内容
   * @param {Array<{role: string, content: string}>} message - 输入的消息数组，每个对象包含 `role` 和 `content`
   * @returns {string} 处理后的流内容
   */
  async *chatStream(messages, params) {
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
        };
      }
    } catch (err) {
      yield { flag: false, content: String(err), reasoning_content: "" };
    }
  }

  /**
   * 处理对话模型的输入的消息并返回响应，支持回调
   * @param {Array<{role: string, content: string}>} message - 输入的消息数组，每个对象包含 `role` 和 `content`
   * @returns {string} 处理后的流内容
   */
  async chatSync(messages, params) {
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
      };
    } catch (err) {
      return { flag: false, content: String(err), reasoning_content: "" };
    }
  }

  /**
   * 处理对话模型的输入的消息并返回流式响应，并支持回调
   * @param {Array<{role: string, content: string}>} messages - 输入的消息数组，每个对象包含 `role` 和 `content`
   * @param {function(string): Promise<void> | function(string): void} [callback=null] - 用于处理流响应的回调函数。每次接收到新的响应内容时，都会调用该回调，并将其作为参数传递给回调函数。如果提供回调，返回的流将逐步发送给回调（可选，默认值 `null`）。
   * @returns {Promise<void>} - 处理完成后返回 `Promise<void>`
   * @example
   * const client = new AzureOpenAIClient("OpenAI", "https://xxx", "xxx", "gpt-4o-mini");
   * const messages = [{ role: "user", content: "Hello!" }];
   *
   * await client.chat(messages, params={}, callback = async (response) => {
   *   console.log("AI:", response);
   * });
   */
  async chat(messages, params = {}, callback = null) {
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

  /**
   * 生成图片
   * @param {string} prompt - 图片生成的提示词
   * @param {string} size - 图片尺寸
   * @param {number} n - 生成图片的数量
   * @returns {Promise<Array<{ type: string, data: string }>>} 返回包含图片 URL 或错误信息的数组
   */
  async generateImage(prompt, size, n) {
    if (this.client == null) {
      return [{ type: "text", data: "模型无效" }];
    }

    try {
      const res = await this.client.images.generate({
        prompt: prompt,
        size: size,
        n: n,
      });
      const urls = res.data.map((item) => ({ type: "url", data: item.url }));
      return urls;
    } catch (err) {
      return [{ type: "text", data: String(err) }];
    }
  }
}
