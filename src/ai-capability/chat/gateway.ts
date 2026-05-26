import type { ChatCallback, ChatCompletionParams, ChatModelCapabilities, ChatModelConfig, ChatPromptMessage, PackedChatMessage } from "./types";
import { packPartMessages, packTextMessages } from "./message";
import { createChatExecutor, createChatProviderConfig, type ChatExecutor } from "./providers";

export type ChatMessageFormat = "text" | "parts";

export interface ChatPromptSettings {
  prompts?: ChatPromptMessage[];
  [key: string]: unknown;
}

export interface ChatRequestContext {
  model?: ChatModelConfig | null;
  settings?: ChatPromptSettings | null;
  messageFormat?: ChatMessageFormat;
  buildParams?: (model: ChatModelConfig | null, settings: ChatPromptSettings | null) => ChatCompletionParams;
}

/**
 * Runtime bridge between normalized chat messages and provider clients.
 *
 * It packs messages for the selected message format, applies turn-level
 * capabilities, and delegates the actual network call to a provider executor.
 */
export class ChatGateway {
  executor: ChatExecutor | null;
  abortController: AbortController | null;

  constructor() {
    this.executor = null;
    this.abortController = null;
  }

  resolveModel(context: ChatRequestContext = {}): ChatModelConfig | null {
    return context?.model || null;
  }

  init(context: ChatRequestContext = {}): void {
    const actModel = this.resolveModel(context);
    if (!actModel) return;

    const config = createChatProviderConfig(actModel);
    this.executor = config ? createChatExecutor(config) : null;
  }

  resolveModelId(model: Partial<ChatModelConfig>): string {
    return model?.model;
  }

  abort(): void {
    if (!this.abortController) return;
    this.abortController.abort();
    this.abortController = null;
  }

  async chat(data: ChatPromptMessage[], context: ChatRequestContext = {}, callback: ChatCallback = (response) => console.log(response)): Promise<boolean> {
    const model = this.resolveModel(context);
    const hasRequestTarget = model?.provider === "Azure OpenAI" ? Boolean(model.deployment || model.model) : Boolean(model?.model);
    if (!this.executor || !model?.name || !model?.apiKey || !hasRequestTarget) {
      callback({
        flag: false,
        content: "Chat model is not configured.",
        reasoning_content: "",
      });
      return false;
    }

    const turnCapabilities: Partial<ChatModelCapabilities> = data[data.length - 1]?.meta?.usedCapabilities || {};

    let abortController: AbortController | null = null;

    try {
      this.abort();
      this.init({ ...context, model });
      abortController = new AbortController();
      this.abortController = abortController;
      const messages = this.getChatMessages(data, context?.settings, context.messageFormat);
      await this.executor.chat(messages, this.getChatParams(model, context?.settings, turnCapabilities, context.buildParams), callback, {
        signal: abortController.signal,
      });
      return true;
    } catch (err) {
      if (abortController?.signal.aborted) return false;
      callback({
        flag: false,
        content: String(err),
        reasoning_content: "",
      });
      return false;
    } finally {
      if (this.abortController === abortController) this.abortController = null;
    }
  }

  /**
   * Build provider-ready chat messages with the active system prompt.
   */
  getChatMessages(data: ChatPromptMessage[], settings: ChatPromptSettings | null = null, messageFormat: ChatMessageFormat = "parts"): PackedChatMessage[] {
    const cms = settings;
    const firstPromptContent = cms?.prompts?.[0]?.content?.[0];
    const hasSystemPrompt = firstPromptContent?.type === "text" && Boolean(firstPromptContent.text);
    const combineData = hasSystemPrompt ? [...(cms?.prompts || []), ...data] : data;
    if (messageFormat == "text") {
      return packTextMessages(combineData);
    }
    return packPartMessages(combineData);
  }

  /**
   * Build request parameters for the active chat model.
   */
  getChatParams(
    model: ChatModelConfig | null = null,
    settings: ChatPromptSettings | null = null,
    turnCapabilities: Partial<ChatModelCapabilities> = {},
    buildParams: ChatRequestContext["buildParams"] = undefined,
  ): ChatCompletionParams {
    return {
      ...(buildParams ? buildParams(model, settings) : {}),
      webSearch: Boolean(turnCapabilities.webSearch),
    };
  }
}
