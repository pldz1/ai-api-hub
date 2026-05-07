// @ts-nocheck
import store from "@/store";
import { dsAlert } from "@/utils";
import { buildChatCompletionParams, getChatModelInfo, getModelDeployment, getModelFromSnapshot, getModelRequestId, isAzureChatModel, isOpenAIChatModel } from "@/constants";
import { tr } from "@/i18n";

import { OpenAIClient } from "./openai";
import { AzureOpenAIClient } from "./azure-openai";
import { packMessageV1, packMessageV2 } from "../chat/message";

export class AIGCClient {
  /**
   * @param {"chat" | "image" | "rt_audio"} type
   */
  constructor(type) {
    this.type = type;
    this.client = null;

    this.init(null);
  }

  init(model = null) {
    const actModel = this.type == "chat" ? getModelFromSnapshot(store.state.curConversation?.modelSnapshot) || store.state.curChatModel : model;
    if (!actModel) return;

    if (isOpenAIChatModel(actModel) && actModel.apiType == "OpenAI") {
      this.client = new OpenAIClient(actModel.baseURL, actModel.apiKey, getModelRequestId(actModel));
    }

    else if (isAzureChatModel(actModel)) {
      this.client = new AzureOpenAIClient(actModel.endpoint, actModel.apiKey, getModelDeployment(actModel), actModel.apiVersion);
    }
  }

  resolveModelId(model) {
    return getModelRequestId(model);
  }

  async chat(data, callback = (response) => console.log(response)) {
    const model = getModelFromSnapshot(store.state.curConversation?.modelSnapshot) || store.state.curChatModel;
    const hasRequestTarget = isAzureChatModel(model) ? Boolean(getModelDeployment(model)) : Boolean(getModelRequestId(model));
    if (!this.client || !model.name || !model.apiKey || !hasRequestTarget) {
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

    const modelInfo = getChatModelInfo(model.modelType, model.apiType);
    const turnCapabilities = data[data.length - 1]?.meta?.usedCapabilities || {};
    // 对于思考模型, 不要上下文并且要保证拿到的消息的格式
    if (modelInfo.isReasonModel) {
      try {
        const messages = this.getChatMessages(data, modelInfo.msgTypeVersion);
        await this.client.chat(messages, this.getChatParams(model, turnCapabilities), callback);
        return true;
      } catch (err) {
        dsAlert({ type: "warn", message: tr("toast.modelRequestFailed", { error: String(err) }) });
        callback({
          content: tr("toast.modelRequestFailed", { error: String(err) }),
          reasoning_content: "",
        });
        return false;
      }
    } else {
      // 对于对话类型的模型, 要拿系统的指令和对话的参数去做请求
      try {
        const messages = this.getChatMessages(data, modelInfo.msgTypeVersion);
        const params = this.getChatParams(model, turnCapabilities);
        await this.client.chat(messages, params, callback);
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
  }

  /**
   * 从store里拿出对话模型要的系统指令, 并且针对不同模型的格式, 包装好要对话的内容
   */
  getChatMessages(data, msgTypeVersion = "v2") {
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
   * 从store里拿出基本的对话模型要的参数
   */
  getChatParams(model = null, turnCapabilities = {}) {
    const activeModel = model || getModelFromSnapshot(store.state.curConversation?.modelSnapshot) || store.state.curChatModel;
    return {
      ...buildChatCompletionParams(activeModel, store.state.curChatModelSettings),
      webSearch: Boolean(turnCapabilities.webSearch),
      reasoningBoost: Boolean(turnCapabilities.reasoning),
    };
  }

  /**
   * 发送图像请求的接口
   *
   * @return {Promise<Blob>} res: 图像的Blob的原始.
   */
  async generateImage(prompt, size, n) {
    const res = await this.client.generateImage(prompt, size, n);
    return res;
  }
}
