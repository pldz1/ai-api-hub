import store from "@/store";
import { dsAlert } from "@/utils";
import {
  buildChatCompletionParams,
  getChatModelInfo,
  getModelDeployment,
  getModelFromSnapshot,
  isAnthropicChatModel,
  isAzureChatModel,
  isOpenAIChatModel,
} from "@/models";
import { tr } from "@/i18n";
import type { ChatModelSettings, ConversationModelSnapshot } from "@/types";
import type { ChatCallback, ChatCompletionParams, ChatModelCapabilities, ChatModelConfig, ChatPromptMessage, PackedChatMessage } from "@/services/chat/types";

import { packMessageV1, packMessageV2 } from "./message";
import { createChatExecutor, createChatProviderConfig, type ChatExecutor } from "./providers";

interface ChatRequestContext {
  conversation?: { modelSnapshot?: ConversationModelSnapshot | null } | null;
  model?: ChatModelConfig | null;
  settings?: ChatModelSettings | null;
}

/**
 * Runtime bridge between UI chat messages and provider clients.
 *
 * It resolves the active conversation model, packs messages for the selected
 * protocol version, applies turn-level capabilities, and delegates the actual
 * network call to a provider-specific executor.
 */
export class ChatProxy {
  executor: ChatExecutor | null;
  abortController: AbortController | null;

  constructor() {
    this.executor = null;
    this.abortController = null;
  }

  resolveModel(context: ChatRequestContext = {}): ChatModelConfig | null {
    return (
      getModelFromSnapshot(context?.conversation?.modelSnapshot) ||
      context?.model ||
      getModelFromSnapshot(store.state.curConversation?.modelSnapshot) ||
      store.state.curChatModel
    );
  }

  init(context: ChatRequestContext = {}): void {
    const actModel = this.resolveModel(context);
    if (!actModel) return;

    if (isOpenAIChatModel(actModel) || isAzureChatModel(actModel) || isAnthropicChatModel(actModel)) {
      const config = createChatProviderConfig(actModel as ChatModelConfig);
      this.executor = config ? createChatExecutor(config) : null;
    }
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
    const hasRequestTarget = isAzureChatModel(model) ? Boolean(getModelDeployment(model)) : Boolean(model?.model);
    if (!this.executor || !model?.name || !model?.apiKey || !hasRequestTarget) {
      dsAlert({
        type: "warn",
        message: tr("toast.modelInitRetry"),
      });
      callback({
        content: tr("toast.modelInitCheck"),
        reasoning_content: "",
      });
      return false;
    }

    const modelInfo = getChatModelInfo(model.model, model.provider);
    const turnCapabilities: Partial<ChatModelCapabilities> = data[data.length - 1]?.meta?.usedCapabilities || {};

    let abortController: AbortController | null = null;

    try {
      this.abort();
      this.init({ ...context, model });
      abortController = new AbortController();
      this.abortController = abortController;
      const messages = this.getChatMessages(data, context?.settings, modelInfo.msgTypeVersion);
      await this.executor.chat(messages, this.getChatParams(model, context?.settings, turnCapabilities), callback, { signal: abortController.signal });
      return true;
    } catch (err) {
      if (abortController?.signal.aborted) return false;
      dsAlert({ type: "warn", message: tr("toast.modelRequestFailed", { error: String(err) }) });
      callback({
        content: tr("toast.modelRequestFailed", { error: String(err) }),
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
  getChatMessages(data: ChatPromptMessage[], settings: ChatModelSettings | null = null, msgTypeVersion: "v1" | "v2" = "v2"): PackedChatMessage[] {
    const cms = settings || store.state.curChatModelSettings;
    const combineData = cms?.prompts?.[0]?.content?.[0]?.text ? [...cms.prompts, ...data] : data;
    if (msgTypeVersion == "v1") {
      return packMessageV1(combineData);
    }
    return packMessageV2(combineData);
  }

  /**
   * Build request parameters for the active chat model.
   */
  getChatParams(
    model: ChatModelConfig | null = null,
    settings: ChatModelSettings | null = null,
    turnCapabilities: Partial<ChatModelCapabilities> = {},
  ): ChatCompletionParams {
    const activeModel = model || this.resolveModel({});
    return {
      ...buildChatCompletionParams(activeModel, settings || store.state.curChatModelSettings),
      webSearch: Boolean(turnCapabilities.webSearch),
    };
  }
}
