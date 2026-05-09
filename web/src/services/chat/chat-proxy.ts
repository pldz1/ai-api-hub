import store from "@/store";
import { dsAlert } from "@/utils";
import {
  buildChatCompletionParams,
  getChatModelInfo,
  getModelDeployment,
  getModelFromSnapshot,
  getModelRequestId,
  isAnthropicChatModel,
  isAzureChatModel,
  isOpenAIChatModel,
} from "@/constants";
import { tr } from "@/i18n";
import type { ChatModelConfig, ModelCapabilities } from "@/types/model";
import type { ChatCallback, ChatPromptMessage, PackedChatMessage } from "@/services/types";

import { packMessageV1, packMessageV2 } from "./message";
import { createChatExecutor, createChatProviderConfig, type ChatExecutor } from "./providers";

/**
 * Runtime bridge between UI chat messages and provider clients.
 *
 * It resolves the active conversation model, packs messages for the selected
 * protocol version, applies turn-level capabilities, and delegates the actual
 * network call to a provider-specific executor.
 */
export class ChatProxy {
  executor: ChatExecutor | null;

  constructor() {
    this.executor = null;

    this.init();
  }

  init(model: ChatModelConfig | null = null): void {
    const actModel = model || getModelFromSnapshot(store.state.curConversation?.modelSnapshot) || store.state.curChatModel;
    if (!actModel) return;

    if (isOpenAIChatModel(actModel) || isAzureChatModel(actModel) || isAnthropicChatModel(actModel)) {
      const config = createChatProviderConfig(actModel as ChatModelConfig);
      this.executor = config ? createChatExecutor(config) : null;
    }
  }

  resolveModelId(model: Partial<ChatModelConfig>): string {
    return getModelRequestId(model);
  }

  async chat(data: ChatPromptMessage[], callback: ChatCallback = (response) => console.log(response)): Promise<boolean> {
    const model = getModelFromSnapshot(store.state.curConversation?.modelSnapshot) || store.state.curChatModel;
    const hasRequestTarget = isAzureChatModel(model) ? Boolean(getModelDeployment(model)) : Boolean(getModelRequestId(model));
    if (!this.executor || !model.name || !model.apiKey || !hasRequestTarget) {
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

    const modelInfo = getChatModelInfo(model.modelType, model.provider);
    const turnCapabilities: Partial<ModelCapabilities> = data[data.length - 1]?.meta?.usedCapabilities || {};

    try {
      const messages = this.getChatMessages(data, modelInfo.msgTypeVersion);
      await this.executor.chat(messages, this.getChatParams(model, turnCapabilities), callback);
      return true;
    } catch (err) {
      dsAlert({ type: "warn", message: tr("toast.modelRequestFailed", { error: String(err) }) });
      callback({
        content: tr("toast.modelRequestFailed", { error: String(err) }),
        reasoning_content: "",
      });
      return false;
    }
  }

  /**
   * Build provider-ready chat messages with the active system prompt.
   */
  getChatMessages(data: ChatPromptMessage[], msgTypeVersion: "v1" | "v2" = "v2"): PackedChatMessage[] {
    const cms = store.state.curChatModelSettings;
    const combineData = cms.prompts[0].content[0].text ? [...cms.prompts, ...data] : data;
    if (msgTypeVersion == "v1") {
      const messages = packMessageV1(combineData);
      return messages;
    } else {
      const messages = packMessageV2(combineData);
      return messages;
    }
  }

  /**
   * Build request parameters for the active chat model.
   */
  getChatParams(model: ChatModelConfig | null = null, turnCapabilities: Partial<ModelCapabilities> = {}): Record<string, unknown> {
    const activeModel = model || getModelFromSnapshot(store.state.curConversation?.modelSnapshot) || store.state.curChatModel;
    return {
      ...buildChatCompletionParams(activeModel, store.state.curChatModelSettings),
      webSearch: Boolean(turnCapabilities.webSearch),
      reasoningBoost: Boolean(turnCapabilities.reasoning),
    };
  }
}
