import {
  buildDefaultChatSettings,
  chatTurnCapabilityKeys,
  createConversationModelSnapshot,
  defaultModelCapabilities,
  getModelFromSnapshot,
  mergeChatSettingsWithModel,
  normalizeModelCapabilities,
} from "@/constants";

/**
 * 表示聊天信息存储的对象。
 */
export const ChatState = {
  /**
   * 对话路由列表
   */
  chatList: [],

  /**
   * 当前对话绑定的模型快照。会话创建后不再允许切换模型。
   */
  curConversation: null,

  /**
   * 单次输入启用的能力开关。最终能力还会被模型支持能力和配置启用能力约束。
   */
  inputCapabilities: {
    ...defaultModelCapabilities,
    textInput: true,
  },

  /**
   * 配置聊天模型的设置参数。
   */
  curChatModelSettings: buildDefaultChatSettings(null),

  /**
   * 全部的对话信息
   * @type {PromptContent[]}
   */

  messages: [],

  /**
   * 设置对话的列表
   */
  resetChatList(data) {
    this.chatList = [...data];
  },

  /**
   * 设置当前对话模型参数
   */

  setCurChatModelSettings(data) {
    const model = getModelFromSnapshot(this.curConversation?.modelSnapshot) || this.curChatModel;
    this.curChatModelSettings = mergeChatSettingsWithModel(model, data);
  },

  /**
   * 设置当前对话绑定的模型快照。
   */
  setCurConversation(data) {
    this.curConversation = data || null;
    const model = getModelFromSnapshot(this.curConversation?.modelSnapshot);
    if (model) {
      this.curChatModel = model;
      this.curChatModelSettings = mergeChatSettingsWithModel(model, this.curChatModelSettings);
    }
    this.resetInputCapabilities();
  },

  /**
   * 从模型配置创建当前对话快照。
   */
  setCurConversationFromModel(data) {
    const snapshot = createConversationModelSnapshot(data);
    if (!snapshot) {
      this.curConversation = null;
      return;
    }
    this.setCurConversation({
      id: this.curChatId || "",
      title: "",
      modelSnapshot: snapshot,
    });
  },

  setInputCapability(data) {
    const key = data?.key;
    if (!key || !(key in this.inputCapabilities)) return;
    this.inputCapabilities[key] = Boolean(data.value);
  },

  resetInputCapabilities() {
    const supported = this.curConversation?.modelSnapshot?.supportedCapabilities || defaultModelCapabilities;
    const enabled = this.curConversation?.modelSnapshot?.enabledCapabilities || defaultModelCapabilities;
    this.inputCapabilities = normalizeModelCapabilities(enabled, supported);
    this.inputCapabilities.textInput = true;
    chatTurnCapabilityKeys.forEach((key) => {
      this.inputCapabilities[key] = false;
    });
  },

  /**
   * 向对话数组末尾添加消息
   */
  pushMessages(msg) {
    this.messages.push(msg);
  },

  /**
   * 删除某个特定位置的消息
   */
  spliceMessages(index) {
    this.messages.splice(index, 1);
  },

  /**
   * 重置消息
   */

  resetMessages() {
    this.messages = [];
  },
};
